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

dump_compose_state() {
  docker compose ps || true
  docker compose logs --no-color --tail=200 postgres redis web worker nginx || true
}

repo_dir="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

require_cmd docker
require_cmd curl

if ! docker compose version >/dev/null 2>&1; then
  die "Docker Compose plugin is not available on the server."
fi

deploy_host_port="${DEPLOY_HOST_PORT:-8000}"
deploy_dir="${DEPLOY_DIR:-/opt/admissioncraft}"
public_base_url="http://127.0.0.1:${deploy_host_port}"

cd "$deploy_dir"

trap 'status=$?; log "Deployment failed at line ${LINENO} with exit code ${status}."; dump_compose_state; exit "$status"' ERR

# Log in to Aliyun Container Registry so Docker can pull private images
if [ -n "${ACR_USERNAME:-}" ] && [ -n "${ACR_PASSWORD:-}" ] && [ -n "${POSTGRES_IMAGE:-}" ]; then
  acr_registry="$(printf '%s' "${POSTGRES_IMAGE}" | cut -d/ -f1)"
  log "Logging in to ACR (${acr_registry})"
  echo "${ACR_PASSWORD}" | docker login "${acr_registry}" -u "${ACR_USERNAME}" --password-stdin
fi

[ -n "${APP_IMAGE:-}" ] || die "APP_IMAGE must be set."
[ -n "${APP_LOGIN_USER:-}" ] || die "APP_LOGIN_USER must be set."
[ -n "${APP_LOGIN_PASS:-}" ] || die "APP_LOGIN_PASS must be set."

log "Deploying app image: ${APP_IMAGE}"

log "Writing .env for the deployment"
cat > .env <<EOF
PORT=8000
HOST_PORT=${deploy_host_port}
PUBLIC_BASE_URL=${public_base_url}
APP_LOGIN_USER=${APP_LOGIN_USER}
APP_LOGIN_PASS=${APP_LOGIN_PASS}
DRAFT_MODEL_API_KEY=${DRAFT_MODEL_API_KEY:-}
DRAFT_MODEL_BASE_URL=${DRAFT_MODEL_BASE_URL:-}
DRAFT_MODEL_NAME=${DRAFT_MODEL_NAME:-}
POLISH_MODEL_API_KEY=${POLISH_MODEL_API_KEY:-}
POLISH_MODEL_BASE_URL=${POLISH_MODEL_BASE_URL:-}
POLISH_MODEL_NAME=${POLISH_MODEL_NAME:-}
POSTGRES_HOST=postgres
REDIS_HOST=redis
DATABASE_URL=postgresql+psycopg://loveessay:loveessay@postgres:5432/loveessay
REDIS_URL=redis://redis:6379/0
POSTGRES_IMAGE=${POSTGRES_IMAGE:-docker.1ms.run/postgres:16}
REDIS_IMAGE=${REDIS_IMAGE:-docker.1ms.run/redis:7}
NGINX_IMAGE=${NGINX_IMAGE:-docker.1ms.run/nginx:1.27-alpine}
APP_IMAGE=${APP_IMAGE}
EOF

log "Resetting database volume for a clean slate"
docker compose down -v --remove-orphans || true

log "Pulling deployment images"
COMPOSE_PROGRESS=plain docker compose pull

log "Bringing the stack up"
COMPOSE_PROGRESS=plain docker compose up -d --remove-orphans

log "Waiting for the database to become ready"
db_ready=0
for _ in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U loveessay -d loveessay >/dev/null 2>&1; then
    db_ready=1
    break
  fi
  sleep 2
done

if [ "$db_ready" -ne 1 ]; then
  dump_compose_state
  die "Database did not become ready in time."
fi

log "Running database migrations"
if ! docker compose exec -T web python -m alembic upgrade head; then
  dump_compose_state
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
  dump_compose_state
  die "Health check failed for ${health_url}."
fi

log "Deployment succeeded — ${health_url}"
