# 文书润色助手 (LoveEssay)

基于阿里云百炼工作流的文书润色应用，采用前端静态页面 + Node.js 代理服务 + Nginx。

## 功能
- `index.html`：填写目标学校、学生信息、润色要求
- `result.html`：展示润色结果并支持复制
- `server.js`：服务端代理百炼 API，保护 API Key

## 本地测试

要求：Node.js 18+。

```bash
npm install
export DASHSCOPE_API_KEY="your-real-key"
# 可选：export WORKFLOW_APP_ID="your-app-id"
# 可选：export PORT=6789
npm start
```

访问：
- 页面：`http://127.0.0.1:6789/`
- 健康检查：`http://127.0.0.1:6789/api/health`

接口测试：
```bash
curl -X POST http://127.0.0.1:6789/api/polish \
  -H 'Content-Type: application/json' \
  -d '{"school_name":"斯坦福大学","student_info_str":"学生信息...","query":"突出领导力"}'
```

## API

- `POST /api/polish`：提交润色请求
- `GET /api/health`：健康检查

## 生产部署

```bash
chmod +x deploy.sh scripts/deploy_server.sh
sudo ./deploy.sh
```

部署脚本会：
- 安装 `nginx/nodejs/npm/openssl`
- 发布站点到 `/var/www/loveessay`
- 创建环境文件 `/etc/loveessay/loveessay.env`
- 注册并启动 `loveessay` systemd 服务
- 生成 Nginx Basic Auth 密码文件 `/etc/nginx/.loveessay_htpasswd`
- 配置 Nginx 作为公网入口，并代理 `/api/` 到本机 Node 服务

## 环境变量

- `DASHSCOPE_API_KEY`：百炼 Key（必填）
- `WORKFLOW_APP_ID`：应用 ID（可选）
- `PORT`：服务端口（默认 6789）
- `RATE_LIMIT_PER_MINUTE`：单 IP 每分钟请求上限
- `BASIC_AUTH_USER`：页面/API 访问用户名（线上）
- `BASIC_AUTH_PASS`：页面/API 访问密码（线上）

## 安全说明
- 不要把真实 API Key 提交到仓库。
- 前端仅访问同域 `/api/polish`，避免暴露 Key。

## GitHub Actions 自动部署（阿里云 ECS）

工作流：`.github/workflows/deploy-aliyun.yml`（push 到 `main` 或手动触发）。

Secrets（最小集）：
- `ALIYUN_HOST`
- `ALIYUN_USER`
- `ALIYUN_SSH_PORT`
- `ALIYUN_SSH_PRIVATE_KEY`
- `DASHSCOPE_API_KEY`
- `WORKFLOW_APP_ID`
- `BASIC_AUTH_USER`
- `BASIC_AUTH_PASS`
