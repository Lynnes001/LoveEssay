## Context

Currently `docker compose up --build` runs on the Aliyun ECS server during every deployment. The server must pull `python:3.12-slim` from a mirror (`docker.1ms.run`) and run `pip install` against PyPI — both are slow and unreliable from within China's network. The GitHub Actions runner (`ubuntu-latest`) runs on GitHub's infrastructure outside China and has fast, unrestricted access to Docker Hub and PyPI.

Aliyun Container Registry (ACR) is already in use: `POSTGRES_IMAGE`, `REDIS_IMAGE`, and `NGINX_IMAGE` are all pulled from ACR. Credentials (`ACR_USERNAME`, `ACR_PASSWORD`) are already stored as GitHub secrets. Only one new ACR repository needs to be created for the app image.

## Goals / Non-Goals

**Goals:**
- Move `docker build` from ECS to GitHub Actions (outside China)
- Push the built image to ACR; ECS pulls from ACR (same-region, fast)
- Enable Docker layer caching on CI to keep subsequent builds fast (~10-20s)
- Remove the `docker.1ms.run` mirror hack from `Dockerfile`
- Tag images with the git SHA for traceability and easy rollback

**Non-Goals:**
- Multi-architecture builds (amd64 only is fine)
- Changing the deployment topology (still Docker Compose on single ECS)
- Adding staging environments
- Automated rollback — manual `docker pull <sha>` is sufficient for now

## Decisions

### D1: Tag strategy — git SHA, not `latest`

Use `${{ github.sha }}` as the image tag. This means every push produces a uniquely-tagged image in ACR, making rollback trivial (`APP_IMAGE=<acr>/admissioncraft:<prev-sha> docker compose up -d`).

Alternatives considered:
- `latest` tag: simple but makes rollback hard — you'd have to re-push a previous image
- Branch tag (`main`): same problem as `latest` for rollback; also ambiguous for future multi-branch workflows

### D2: Layer caching via GitHub Actions cache (`type=gha`)

Use `docker/build-push-action` with `cache-from: type=gha` and `cache-to: type=gha,mode=max`. This stores layer cache in GitHub's cache storage between runs.

Alternatives considered:
- No cache: first build is 3-5 min every time, defeats the purpose
- ACR as cache registry: works but adds complexity and ACR storage cost; GHA cache is free and simpler

### D3: Single image for both `web` and `worker`

Both services already use the same `Dockerfile`. They share the `APP_IMAGE` variable in `docker-compose.yml`, differentiated only by the `command:` override. No change needed here.

### D4: Reduce SCP payload

Currently the entire repo (including `node_modules`) is SCP'd to ECS. After this change, ECS no longer needs source code to run — only `docker-compose.yml`, `nginx/`, `scripts/`, and `frontend/` (static assets served by nginx). The SCP step in the workflow should be scoped accordingly.

### D5: ACR login in both CI and deploy steps

CI needs ACR login to push. ECS deploy needs ACR login to pull. The existing `deploy_server.sh` already handles ECS-side ACR login. CI-side login is added as a new step in the workflow using the same credentials.

## Risks / Trade-offs

- **ACR repo must be created manually first** → One-time console action; document in deploy README. If skipped, the push step fails with a clear error.
- **CI build failure blocks deploy** → Previously a build failure would surface on ECS; now it surfaces earlier in CI, which is actually better. No mitigation needed.
- **Layer cache miss on dep changes** → When `requirements.txt` changes, layers 1-3 all rebuild (~3-5 min). This is expected and unavoidable; it only happens on dependency bumps.
- **Image accumulation in ACR** → Each SHA push adds an image. ACR free tier has storage limits. Mitigation: set ACR lifecycle rule to keep only the last N images (can be done via Aliyun console).
- **`frontend/` still SCP'd** → Static frontend assets are served by nginx from the host filesystem (volume mount), not baked into the image. This means frontend changes still require SCP. Acceptable for now; baking frontend into nginx image is a future option.

## Migration Plan

1. Create `admissioncraft` repo in existing ACR namespace (one-time, manual)
2. Add `APP_IMAGE_REPO` GitHub variable (the ACR repo URL without tag)
3. Update `Dockerfile`: remove `docker.1ms.run` mirror from `FROM`
4. Update `docker-compose.yml`: replace `build:` with `image: ${APP_IMAGE}`
5. Update `.github/workflows/deploy-aliyun.yml`: add build/push steps, pass `APP_IMAGE` to deploy
6. Update `scripts/deploy_server.sh`: remove `--build`, add `docker compose pull`
7. Push to `main` — first run will be slow (cold cache), subsequent runs fast

**Rollback**: `ssh` to ECS, set `APP_IMAGE=<acr>/admissioncraft:<prev-sha>` in `.env`, run `docker compose up -d`. No code changes needed.

## Open Questions

- Should `frontend/` eventually be baked into the nginx image to eliminate the SCP step entirely? (Out of scope for this change, but a natural follow-on.)
- ACR lifecycle policy: how many old images to retain? (Suggested: 10)
