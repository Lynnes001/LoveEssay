## Why

The app image is currently built on the Aliyun ECS server during deployment, which is slow because the server must pull base images and install Python dependencies across China's restricted network. Moving the build to GitHub-hosted CI runners (outside China) and pushing the result to Aliyun Container Registry (ACR) eliminates this bottleneck — ECS then pulls a pre-built image from ACR within the same Aliyun region, which is fast and reliable.

## What Changes

- GitHub Actions workflow gains a build-and-push phase: `docker build` + `docker push` to ACR, before the SSH deploy step
- `docker-compose.yml`: replace `build:` sections with `image: ${APP_IMAGE}` for `web` and `worker` services
- `Dockerfile`: base image changed from `docker.1ms.run/python:3.12-slim` back to `python:3.12-slim` (mirror no longer needed since CI runs outside China)
- `deploy_server.sh`: remove `--build` flag from `docker compose up`; add explicit `docker compose pull` before up
- GitHub Actions workflow passes `APP_IMAGE` (with git SHA tag) as an env var to the deploy script
- SCP step can be reduced to only transfer `docker-compose.yml`, `nginx/`, `scripts/`, and `frontend/` — no need to copy the full source tree to ECS

## Capabilities

### New Capabilities

- `ci-image-build`: GitHub Actions builds the app Docker image and pushes it to ACR with a git-SHA tag before deploying to ECS

### Modified Capabilities

- (none — no spec-level behavior changes)

## Impact

- `.github/workflows/deploy-aliyun.yml`: new build/push steps added
- `docker-compose.yml`: `build:` → `image:` for web and worker
- `Dockerfile`: base image mirror removed
- `scripts/deploy_server.sh`: `--build` flag removed, `docker compose pull` added
- New GitHub Actions secrets/vars needed: `APP_IMAGE_REPO` (ACR repo URL for the app image)
- ACR: one new repository (`admissioncraft`) must be created in the existing namespace (one-time manual step)
