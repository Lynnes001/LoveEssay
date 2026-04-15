## ADDED Requirements

### Requirement: CI builds and pushes app image to ACR
The GitHub Actions workflow SHALL build the app Docker image on the GitHub-hosted runner and push it to Aliyun Container Registry (ACR) before deploying to ECS. The image SHALL be tagged with the full git commit SHA.

#### Scenario: Successful build and push on push to main
- **WHEN** a commit is pushed to the `main` branch
- **THEN** the workflow builds the Docker image using `docker/build-push-action`
- **THEN** the image is pushed to ACR as `<APP_IMAGE_REPO>:<github.sha>`
- **THEN** the deploy step receives `APP_IMAGE=<APP_IMAGE_REPO>:<github.sha>` as an environment variable

#### Scenario: Layer cache is used on subsequent builds
- **WHEN** a commit is pushed and the previous build's cache exists in GitHub Actions cache storage
- **THEN** unchanged layers (base image, apt deps, pip deps) are restored from cache
- **THEN** only the `COPY backend/ prompts/` layer is rebuilt

#### Scenario: Build fails before deploy
- **WHEN** the Docker build step fails (e.g., syntax error, pip install failure)
- **THEN** the workflow exits with a non-zero status
- **THEN** the SSH deploy step does NOT run

### Requirement: ECS pulls pre-built image from ACR
The `deploy_server.sh` script SHALL pull the pre-built image from ACR rather than building on the server. The `docker compose up` command SHALL NOT include the `--build` flag.

#### Scenario: Deploy uses pre-built image
- **WHEN** `deploy_server.sh` runs on ECS
- **THEN** `docker compose pull` is called before `docker compose up`
- **THEN** `docker compose up -d --remove-orphans` runs without `--build`
- **THEN** the running containers use the image tagged with the deployed git SHA

#### Scenario: Rollback to previous image
- **WHEN** an operator sets `APP_IMAGE=<ACR_REPO>:<prev-sha>` in the ECS `.env` file
- **THEN** running `docker compose up -d` pulls and starts the previously-deployed image
- **THEN** no code checkout or rebuild is required

### Requirement: Dockerfile uses upstream base image
The `Dockerfile` SHALL use `python:3.12-slim` as the base image directly (no mirror prefix), since the build now runs on GitHub-hosted infrastructure outside China.

#### Scenario: Dockerfile base image is unmirrored
- **WHEN** the CI build runs
- **THEN** the base image is pulled from Docker Hub as `python:3.12-slim`
- **THEN** no `docker.1ms.run` mirror prefix is used in the `FROM` instruction
