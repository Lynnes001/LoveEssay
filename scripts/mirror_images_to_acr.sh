#!/usr/bin/env bash

set -euo pipefail

log() {
  printf '[mirror] %s\n' "$*"
}

die() {
  printf '[mirror] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

image_name() {
  local image="$1"
  local last_segment

  last_segment="${image##*/}"
  printf '%s\n' "${last_segment%%:*}"
}

image_tag() {
  local image="$1"
  local last_segment

  last_segment="${image##*/}"
  if [ "$last_segment" = "${last_segment%%:*}" ]; then
    printf 'latest\n'
  else
    printf '%s\n' "${last_segment#*:}"
  fi
}

require_cmd docker

platform="${PLATFORM:-linux/amd64}"
acr_registry="${ACR_REGISTRY:-crpi-n8xq04c9r8533fv2.cn-chengdu.personal.cr.aliyuncs.com}"
acr_namespace="${ACR_NAMESPACE:-sid729}"
acr_image_prefix="${ACR_IMAGE_PREFIX:-${acr_registry}/${acr_namespace}}"
acr_username="${ACR_USERNAME:-18943007490}"
default_images="postgres:16 redis:7 nginx:1.27-alpine"

if [ "$#" -gt 0 ]; then
  images="$*"
else
  images="${IMAGES:-$default_images}"
fi

if [ -n "${ACR_PASSWORD:-}" ]; then
  log "Logging in to ACR (${acr_registry})"
  echo "$ACR_PASSWORD" | docker login "$acr_registry" -u "$acr_username" --password-stdin
else
  log "Logging in to ACR (${acr_registry}) as ${acr_username}"
  docker login "$acr_registry" -u "$acr_username"
fi

log "Target platform: ${platform}"
log "Target prefix: ${acr_image_prefix}"

for source_image in $images; do
  repo="$(image_name "$source_image")"
  tag="$(image_tag "$source_image")"
  target_image="${acr_image_prefix}/${repo}:${tag}"

  log "Pulling ${source_image} for ${platform}"
  docker pull --platform "$platform" "$source_image"

  log "Tagging ${source_image} as ${target_image}"
  docker tag "$source_image" "$target_image"

  log "Pushing ${target_image}"
  docker push "$target_image"
done

log "Done"
