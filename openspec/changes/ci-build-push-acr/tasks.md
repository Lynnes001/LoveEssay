## 1. One-time Manual Setup (ACR + GitHub)

- [x] 1.1 Create `admissioncraft` repository in your existing ACR namespace via Aliyun console
- [x] 1.2 Add GitHub Actions variable `APP_IMAGE_REPO` with value `<registry>/<namespace>/admissioncraft` (no tag)

## 2. Dockerfile

- [x] 2.1 Change base image from `docker.1ms.run/python:3.12-slim` to `python:3.12-slim`

## 3. docker-compose.yml

- [x] 3.1 Replace `build: { context: ., dockerfile: Dockerfile }` on `web` service with `image: ${APP_IMAGE}`
- [x] 3.2 Replace `build: { context: ., dockerfile: Dockerfile }` on `worker` service with `image: ${APP_IMAGE}`

## 4. deploy_server.sh

- [x] 4.1 Add `[ -n "${APP_IMAGE:-}" ] || die "APP_IMAGE must be set."` validation near the top
- [x] 4.2 Add `APP_IMAGE=${APP_IMAGE}` to the `.env` write block
- [x] 4.3 Replace `docker compose up -d --build --remove-orphans` with `docker compose pull && docker compose up -d --remove-orphans`

## 5. GitHub Actions Workflow

- [x] 5.1 Add `APP_IMAGE_REPO` to the workflow env or steps (read from `vars.APP_IMAGE_REPO`)
- [x] 5.2 Add step: `docker/login-action` to log in to ACR (using existing `ACR_USERNAME` / `ACR_PASSWORD` secrets)
- [x] 5.3 Add step: `docker/setup-buildx-action` to enable BuildKit
- [x] 5.4 Add step: `docker/build-push-action` with `push: true`, `tags: ${{ vars.APP_IMAGE_REPO }}:${{ github.sha }}`, and `cache-from/cache-to: type=gha`
- [x] 5.5 Add `APP_IMAGE` to the `envs:` list passed to the deploy SSH step
- [x] 5.6 Add `APP_IMAGE=${{ vars.APP_IMAGE_REPO }}:${{ github.sha }}` to the `env:` block of the deploy SSH step
- [x] 5.7 Narrow the SCP `source:` to exclude source code (e.g. `docker-compose.yml,nginx,scripts,frontend`) instead of copying the entire repo

## 6. Verify

- [ ] 6.1 Push to `main` and confirm the build/push step completes successfully in GitHub Actions
- [ ] 6.2 Confirm the image appears in ACR console with the git SHA tag
- [ ] 6.3 Confirm the deploy step pulls the image from ACR and health check passes
- [ ] 6.4 Confirm a second push is faster (layer cache hit visible in CI logs)
