# LoveEssay

基于阿里云 DashScope 兼容模式、LangGraph、BullMQ、Redis、Postgres 的文书生成应用。当前产品形态仍是表单式：填写目标学校、上传一份 `.docx` Word 材料、补充润色要求，然后异步生成英文个人陈述。

## 当前架构

- `index.html` / `result.html`：静态表单页与结果页
- `src/app.js`：Express Web API，负责上传、建任务、查询状态、取消任务
- `src/worker.js`：BullMQ Worker，执行 LangGraph 工作流
- `src/workflow/`：Word 解析、事实抽取、初稿生成、风格优化、事实核查、修复
- `docker-compose.yml`：`web + worker + redis + postgres + nginx`

工作流主线：

1. 上传 `.docx` 材料
2. 解析 Word 文本
3. 按段落切分并做材料分类
4. 抽取结构化学生事实
5. 第一个模型写英文初稿
6. 第二个模型做风格改写
7. 事实核查与约束修复
8. 输出最终结果

## 运行要求

- Node.js 20+
- Docker / Docker Compose（推荐）
- 阿里云 DashScope API Key
- LangSmith API Key（如果要开 tracing）
- 应用登录用户名密码（部署环境建议开启）

## 本地开发

1. 安装依赖

```bash
npm install
```

2. 复制环境变量

```bash
cp .env.example .env
```

3. 启动基础设施

```bash
docker compose up -d postgres redis
```

4. 启动 Web 与 Worker

```bash
npm start
npm run worker
```

默认访问：

- 页面：[http://127.0.0.1:6789](http://127.0.0.1:6789)
- 健康检查：[http://127.0.0.1:6789/api/health](http://127.0.0.1:6789/api/health)

## Docker 部署

前提：

- 目标 ECS 机器已安装 `docker`
- 目标 ECS 机器已安装 `docker compose`
- GitHub Actions 只负责通过 SSH 推送代码并执行 `docker compose up`，不会自动安装 Docker

1. 配置环境变量

```bash
cp .env.example .env
```

至少填写：

- `DASHSCOPE_API_KEY`
- `APP_LOGIN_USER`
- `APP_LOGIN_PASS`
- 如果 ECS 不能稳定访问 Docker Hub，建议同时填写：
  - `ACR_USERNAME`
  - `ACR_PASSWORD`
  - `NODE_BASE_IMAGE`
  - `POSTGRES_IMAGE`
  - `REDIS_IMAGE`
  - `NGINX_IMAGE`
- 如果要看 tracing，再填写：
  - `LANGSMITH_TRACING=true`
  - `LANGSMITH_API_KEY`
  - 可选 `LANGSMITH_PROJECT`
- 可选模型：
  - `EXTRACT_MODEL`，默认 `qwen3.5-plus`
  - `DRAFT_MODEL`，默认 `qwen3.5-plus`
  - `REWRITE_MODEL`，默认 `qwen3-14b-81bba393c391`
  - `CHECK_MODEL`，默认 `qwen3.5-plus`

2. 启动整套服务

```bash
docker compose up --build -d
```

3. 访问入口

- 页面：[http://127.0.0.1:6788](http://127.0.0.1:6788)
- 健康检查：[http://127.0.0.1:6788/api/health](http://127.0.0.1:6788/api/health)
- PostgreSQL 管理后台：[http://127.0.0.1:6788/pgadmin/](http://127.0.0.1:6788/pgadmin/)
- 如果宿主机 `6788` 已被占用，可在 `.env` 中改 `HOST_PORT`，并同步调整 `PUBLIC_BASE_URL`

### PostgreSQL 管理后台

- 访问路径：`/pgadmin/`
- 推荐通过同一台 ECS 上的 `nginx` 反代访问，避免直接暴露 PostgreSQL `5432` 到公网
- 生产环境务必修改 `POSTGRES_PASSWORD` 和 `PGADMIN_DEFAULT_PASSWORD`
- 建议在阿里云安全组里只允许你的固定公网 IP 访问管理入口

首次登录 `pgAdmin` 使用：

- `PGADMIN_DEFAULT_EMAIL`
- `PGADMIN_DEFAULT_PASSWORD`

容器会预置一个名为 `loveessay-postgres` 的连接，默认指向：

- Host：`postgres`
- Port：`5432`
- Maintenance DB：`loveessay`
- Username：`loveessay`

如果你改了 `POSTGRES_DB` 或 `POSTGRES_USER`，请在 `pgAdmin` 里手动更新这个连接，或新建一个连接并填入新的值。数据库密码不会预置在 `pgAdmin` 中，首次连接时手动输入即可。

## API

- `POST /api/tasks`
  - `multipart/form-data`
  - 字段：
    - `school_name`
    - `query`
    - `notes`
    - `material_file`（仅 `.docx`）
- `GET /api/tasks/:taskId`
- `POST /api/tasks/:taskId/cancel`
- `GET /api/health`

示例：

```bash
curl -X POST http://127.0.0.1:6788/api/tasks \
  -H 'Cookie: <登录后浏览器自动携带>' \
  -F 'school_name=Stanford University' \
  -F 'query=Highlight leadership and research curiosity' \
  -F 'notes=Avoid overclaiming school-specific details unless they appear in the material.' \
  -F 'material_file=@./sample.docx'
```

## 环境变量

- `PORT`：Web 服务端口，默认 `6789`
- `HOST_PORT`：Docker Nginx 绑定的宿主机端口，默认 `6788`
- `PUBLIC_BASE_URL`：对外访问地址
- `DASHSCOPE_API_KEY`：阿里云 DashScope Key
- `APP_LOGIN_USER`：应用登录用户名
- `APP_LOGIN_PASS`：应用登录密码
- `AUTH_SESSION_SECRET`：应用登录会话签名密钥，默认回退到 `APP_LOGIN_PASS`
- `AUTH_SESSION_TTL_SECONDS`：登录会话有效期，默认 7 天
- `AUTH_SECURE_COOKIE`：是否对登录 Cookie 启用 `Secure`
- `LANGSMITH_TRACING`：是否开启 LangSmith tracing
- `LANGSMITH_API_KEY`：LangSmith API Key
- `LANGSMITH_PROJECT`：LangSmith 项目名，默认 `loveessay`
- `LANGSMITH_ENDPOINT`：自建或 EU 区域 LangSmith 才需要
- `LANGSMITH_WORKSPACE_ID`：一个 API Key 绑定多个 workspace 时使用
- `DASHSCOPE_BASE_URL`：默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`
- `EXTRACT_MODEL`：事实抽取模型，默认 `qwen3.5-plus`
- `DRAFT_MODEL`：初稿模型，默认 `qwen3.5-plus`
- `REWRITE_MODEL`：第二阶段润色模型，默认 `qwen3-14b-81bba393c391`
- `CHECK_MODEL`：事实核查模型，默认 `qwen3.5-plus`
- `DATABASE_URL`
- `REDIS_URL`
- `QUEUE_NAME`
- `UPLOAD_DIR`
- `MAX_UPLOAD_SIZE_MB`
- `RATE_LIMIT_PER_MINUTE`
- `POSTGRES_DB`：Compose 中 Postgres 初始化库名，默认 `loveessay`
- `POSTGRES_USER`：Compose 中 Postgres 初始化用户名，默认 `loveessay`
- `POSTGRES_PASSWORD`：Compose 中 Postgres 初始化密码
- `ACR_USERNAME`：可选，部署时用于自动登录 ACR
- `ACR_PASSWORD`：可选，部署时用于自动登录 ACR
- `DOCKER_PLATFORM`：可选，本地通常留空；云端部署可设为 `linux/amd64`
- `NODE_BASE_IMAGE`：`web/worker` 构建使用的 Node 基础镜像，默认 `node:20-bookworm-slim`
- `POSTGRES_IMAGE`：Postgres 基础镜像，默认 `postgres:16`
- `REDIS_IMAGE`：Redis 基础镜像，默认 `redis:7`
- `NGINX_IMAGE`：Nginx 基础镜像，默认 `nginx:1.27-alpine`
- `PGADMIN_IMAGE`：pgAdmin 镜像，默认 `crpi-n8xq04c9r8533fv2.cn-chengdu.personal.cr.aliyuncs.com/sid729/pgadmin:latest`
- `PGADMIN_DEFAULT_EMAIL`：pgAdmin 初始管理员邮箱
- `PGADMIN_DEFAULT_PASSWORD`：pgAdmin 初始管理员密码

## 注意事项

- 当前版本只支持 `.docx`，不支持 `.doc` / `.pdf`
- 取消任务为可靠的“排队即时取消 + 执行中节点间取消”
- 打开 LangSmith 后，可以在 trace 中看到工作流入口和模型调用子节点
- 生产部署默认通过固定 `/login` 页面保护页面和任务 API，替代浏览器原生 Basic Auth 弹窗
- 兼容旧配置：如果环境里仍使用 `BASIC_AUTH_USER / BASIC_AUTH_PASS`，应用仍可读取，但新部署建议改用 `APP_LOGIN_USER / APP_LOGIN_PASS`
- GitHub Actions 部署前，ECS 必须预装 `docker` 和 `docker compose`
- 当前默认 `PGADMIN_IMAGE` 已指向阿里云 ACR；如果 ECS 无法稳定访问 Docker Hub，继续把 `NODE_BASE_IMAGE / POSTGRES_IMAGE / REDIS_IMAGE / NGINX_IMAGE` 也指到你自己的 ACR 镜像
- 如果 `docker compose up` 提示 `failed to bind host port ... 6788 ... address already in use`，通常是宿主机上旧版 `nginx` 或其他进程占用了 `6788`。处理方式是停掉旧服务，或改用新的 `HOST_PORT`
- 旧的 `deploy.sh` / `scripts/deploy_server.sh` 是上一版 systemd 部署方式，不再代表当前推荐路径
