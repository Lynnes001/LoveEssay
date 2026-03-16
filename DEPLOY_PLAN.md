# LoveEssay Docker 部署与验收手册

## 1. 服务组成

- `nginx`：对外入口，监听宿主机 `6788`
- `web`：Express API 与静态页面
- `worker`：BullMQ Worker，执行 LangGraph 工作流
- `postgres`：任务、结果、事件日志
- `redis`：队列与调度

## 2. 部署步骤

### 2.1 准备环境变量

```bash
cp .env.example .env
```

至少填写：

```bash
DASHSCOPE_API_KEY=your-real-key
APP_LOGIN_USER=admin
APP_LOGIN_PASS=change-me-now
AUTH_SESSION_SECRET=change-session-secret
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your-langsmith-api-key
LANGSMITH_PROJECT=loveessay
EXTRACT_MODEL=qwen3.5-plus
DRAFT_MODEL=qwen3.5-plus
REWRITE_MODEL=qwen3-14b-81bba393c391
CHECK_MODEL=qwen3.5-plus
```

### 2.2 启动服务

```bash
docker compose up --build -d
```

### 2.3 查看状态

```bash
docker compose ps
docker compose logs --tail=100 web worker
```

## 3. 验收清单

### 3.1 健康检查

```bash
curl http://127.0.0.1:6788/api/health
```

预期：返回 `{"ok":true,...}`。

### 3.2 页面检查

打开：

- `http://127.0.0.1:6788`

预期：

- 可以填写目标学校
- 可以上传 `.docx`
- 可以提交任务并跳转到结果页
- 结果页能看到任务状态和最终文书

### 3.3 API 检查

```bash
curl -X POST http://127.0.0.1:6788/api/tasks \
  -F 'school_name=Stanford University' \
  -F 'query=Highlight leadership and research curiosity' \
  -F 'notes=Do not invent school-specific programs.' \
  -F 'material_file=@./sample.docx'
```

拿到 `task_id` 后：

```bash
curl http://127.0.0.1:6788/api/tasks/<task_id>
```

取消任务：

```bash
curl -X POST http://127.0.0.1:6788/api/tasks/<task_id>/cancel
```

## 4. 常见问题

1. `服务端未配置 DASHSCOPE_API_KEY`
- 检查 `.env`
- 重启：`docker compose up --build -d`

2. 登录失败
- 检查 `.env` 中 `APP_LOGIN_USER / APP_LOGIN_PASS`
- 重启 `web`：`docker compose up -d web`

3. `Word 文件解析成功，但未提取到文本内容`
- 检查上传的 `.docx` 是否为真实 Word 文件
- 检查文件是否主要由图片组成

4. `任务一直停留在 queued`
- 检查 `worker` 是否启动
- 查看：`docker compose logs worker`

5. `健康检查失败`
- 查看 `postgres` / `redis` 是否 healthy
- 运行：`docker compose ps`

6. LangSmith 没有 trace
- 确认 `.env` 中 `LANGSMITH_TRACING=true`
- 确认 `LANGSMITH_API_KEY` 正确
- 查看 `worker` 日志是否有 LangSmith 上报错误

## 5. 旧部署说明

仓库内仍保留了早期的 `deploy.sh` / `scripts/deploy_server.sh` systemd 部署脚本，但它们对应的是旧版“静态前端 + 单进程代理 + 百炼工作流 App”方案，不再是当前推荐部署方式。
