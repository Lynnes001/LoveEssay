#!/usr/bin/env bash

set -euo pipefail

log() {
  printf '[deploy] %s\n' "$*"
}

die() {
  printf '[deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

repo_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

require_cmd docker
require_cmd curl

if ! docker compose version >/dev/null 2>&1; then
  die "Docker Compose plugin is not available on the server."
fi

if [ ! -f docker-compose.yml ] && [ ! -f docker-compose.yaml ] && [ ! -f compose.yml ] && [ ! -f compose.yaml ]; then
  die "No docker compose file found in the repository root."
fi

deploy_host_port="${DEPLOY_HOST_PORT:-8000}"
postgres_db="${POSTGRES_DB:-loveessay}"
postgres_user="${POSTGRES_USER:-loveessay}"
postgres_host="${POSTGRES_HOST:-postgres}"
redis_host="${REDIS_HOST:-redis}"
backend_service="${BACKEND_SERVICE:-web}"
db_service="${DB_SERVICE:-postgres}"
redis_service="${REDIS_SERVICE:-redis}"
nginx_service="${NGINX_SERVICE:-nginx}"
deploy_domain="${DEPLOY_DOMAIN:-}"
deploy_dir="${DEPLOY_DIR:-/opt/admissioncraft}"
public_base_url="${PUBLIC_BASE_URL:-http://127.0.0.1:${deploy_host_port}}"

cd "$deploy_dir"

log "Writing .env for the deployment"
quote_env() {
  local value="${1}"
  local escaped
  escaped="$(printf '%s' "$value" | sed "s/'/'\"'\"'/g")"
  printf "'%s'" "$escaped"
}

cat > .env <<EOF
PORT=$(quote_env "8000")
HOST_PORT=$(quote_env "${deploy_host_port}")
PUBLIC_BASE_URL=$(quote_env "${public_base_url}")
DEPLOY_DOMAIN=$(quote_env "${deploy_domain}")
DRAFT_MODEL_API_KEY=$(quote_env "${DRAFT_MODEL_API_KEY}")
DRAFT_MODEL_BASE_URL=$(quote_env "${DRAFT_MODEL_BASE_URL:-}")
DRAFT_MODEL_NAME=$(quote_env "${DRAFT_MODEL_NAME:-gpt-4o-mini}")
POLISH_MODEL_API_KEY=$(quote_env "${POLISH_MODEL_API_KEY}")
POLISH_MODEL_BASE_URL=$(quote_env "${POLISH_MODEL_BASE_URL:-https://dashscope.aliyuncs.com/compatible-mode/v1}")
POLISH_MODEL_NAME=$(quote_env "${POLISH_MODEL_NAME:-qwen-plus}")
POSTGRES_DB=$(quote_env "${postgres_db}")
POSTGRES_USER=$(quote_env "${postgres_user}")
POSTGRES_PASSWORD=$(quote_env "${POSTGRES_PASSWORD}")
POSTGRES_HOST=$(quote_env "${postgres_host}")
REDIS_HOST=$(quote_env "${redis_host}")
DATABASE_URL=$(quote_env "postgresql+psycopg://${postgres_user}:${POSTGRES_PASSWORD}@${postgres_host}:5432/${postgres_db}")
REDIS_URL=$(quote_env "redis://${redis_host}:6379/0")
EOF

log "Bringing the stack up"

# Configure Aliyun Docker registry mirror if Docker Hub is unreachable.
# This is needed on Aliyun ECS where registry-1.docker.io is blocked/throttled.
daemon_cfg=/etc/docker/daemon.json
mirror_url="https://registry.cn-hangzhou.aliyuncs.com"
if [ "$(curl -sm 5 "https://registry-1.docker.io/v2/" -o /dev/null -w '%{http_code}')" = "000" ]; then
  log "Docker Hub unreachable — configuring Aliyun mirror (${mirror_url})"
  if command -v jq >/dev/null 2>&1; then
    existing="$(cat "$daemon_cfg" 2>/dev/null || echo '{}')"
    updated="$(printf '%s' "$existing" | jq --arg m "$mirror_url" '."registry-mirrors" = ([."registry-mirrors"[]? // empty, $m] | unique)')"
  else
    # Fallback: write a minimal daemon.json (preserves nothing else, but works for a fresh server)
    updated="{\"registry-mirrors\":[\"${mirror_url}\"]}"
  fi
  echo "$updated" | sudo tee "$daemon_cfg" > /dev/null
  sudo systemctl restart docker
  # Wait for Docker to come back
  for _ in $(seq 1 10); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done
  docker info >/dev/null 2>&1 || die "Docker did not recover after daemon restart."
  log "Docker mirror configured and daemon restarted"
fi

docker compose up -d --build --remove-orphans

log "Waiting for the database to become ready"
db_ready=0
for _ in $(seq 1 30); do
  if docker compose exec -T "$db_service" pg_isready -U "$postgres_user" -d "$postgres_db" >/dev/null 2>&1; then
    db_ready=1
    break
  fi
  sleep 2
done

if [ "$db_ready" -ne 1 ]; then
  docker compose ps || true
  docker compose logs --no-color --tail=200 "$db_service" "$redis_service" "$backend_service" "$nginx_service" || true
  die "Database did not become ready in time."
fi

log "Running database migrations"
if ! docker compose exec -T "$backend_service" python -m alembic upgrade head; then
  docker compose ps || true
  docker compose logs --no-color --tail=200 "$backend_service" "$db_service" "$redis_service" "$nginx_service" || true
  die "Database migrations failed."
fi

log "Waiting for the public health endpoint"
health_url="http://127.0.0.1:${deploy_host_port}/health"
health_ready=0
for _ in $(seq 1 30); do
  if curl -fsS "$health_url" >/dev/null 2>&1; then
    health_ready=1
    break
  fi
  sleep 2
done

if [ "$health_ready" -ne 1 ]; then
  docker compose ps || true
  docker compose logs --no-color --tail=200 "$backend_service" "$db_service" "$redis_service" "$nginx_service" || true
  die "Health check failed for ${health_url}."
fi

log "Deployment succeeded"
printf '[deploy] Health check passed: %s\n' "$health_url"
