# AdmissionCraft Phase 1

FastAPI + Celery + Redis + PostgreSQL + Nginx 的最小流式文书生成链路。当前实现只覆盖 Phase 1：提交一份 PS 生成请求，后台异步跑三阶段模型链路 `extraction -> draft -> rewrite`，并通过 SSE 把生成状态和内容流式推回前端。

## 本地运行

1. 创建环境变量：

```bash
cp .env.example .env
```

2. 至少填写这些值：

```bash
DRAFT_MODEL_API_KEY=your-draft-model-key
DRAFT_MODEL_BASE_URL=https://your-draft-endpoint/v1
POLISH_MODEL_API_KEY=your-polish-model-key
POLISH_MODEL_BASE_URL=https://your-polish-endpoint/v1
POSTGRES_PASSWORD=change-me
DATABASE_URL=postgresql+psycopg://loveessay:change-me@postgres:5432/loveessay
REDIS_URL=redis://redis:6379/0
```

所有模型调用都走 OpenAI 兼容接口。环境变量只保留两套模型配置：基础模型使用 `DRAFT_MODEL_*`，改写模型使用 `POLISH_MODEL_*`。若只是本地演示，也可以不填模型密钥，服务会退回 mock 流式内容。

3. 启动整套服务：

```bash
./scripts/dev/up.sh
```

4. 初始化数据库：

```bash
docker compose exec -T web python -m alembic upgrade head
```

5. 访问：

- 前端：[http://127.0.0.1:8000](http://127.0.0.1:8000)
- 健康检查：[http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

## 测试

```bash
./scripts/dev/test.sh
```

## GitHub Actions 自动部署到阿里云 ECS

工作流文件是 [deploy-aliyun.yml](/Users/sid/Repos/LoveEssay/.github/workflows/deploy-aliyun.yml)，部署脚本是 [deploy_server.sh](/Users/sid/Repos/LoveEssay/scripts/deploy_server.sh)。

### 必填 GitHub Secrets

- `DEPLOY_SSH_HOST` 或 `ALIYUN_HOST`
- `DEPLOY_SSH_PRIVATE_KEY` 或 `ALIYUN_SSH_PRIVATE_KEY`
- `DRAFT_MODEL_API_KEY`
- `POLISH_MODEL_API_KEY`
- `POSTGRES_PASSWORD`

### 必填 GitHub Variables

- `DEPLOY_SSH_USER` 或 `ALIYUN_USER`
- `DEPLOY_HOST_PORT` 或 `HOST_PORT`

### 可选 GitHub Variables

- `DEPLOY_DOMAIN`
- `DRAFT_MODEL_BASE_URL`
- `DRAFT_MODEL_NAME`
- `POLISH_MODEL_BASE_URL`
- `POLISH_MODEL_NAME`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `REDIS_HOST`
- `DEPLOY_DIR`
- `BACKEND_SERVICE`
- `WORKER_SERVICE`
- `DB_SERVICE`
- `REDIS_SERVICE`
- `NGINX_SERVICE`

### ECS 前置条件

- 已安装 `docker`
- 已安装 `docker compose`
- 目标端口已在阿里云安全组中放行

部署时，GitHub Actions 会：

1. 校验 secrets / vars
2. 通过 SSH 上传仓库到 ECS
3. 生成 `.env`
4. 执行 `docker compose up -d --build`
5. 运行 Alembic migration
6. 检查外部 `GET /health`

## 安全注意

- 当前工作区存在未跟踪的 `server-access` 明文凭据文件。这个文件已经加入新的 `.gitignore`，但你仍然应该立刻轮换其中凭据并删除本地明文副本。
