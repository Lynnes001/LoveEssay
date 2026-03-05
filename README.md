# 文书润色助手 (LoveEssay)

基于阿里云百炼工作流的文书润色应用，采用 **前端静态页面 + Node.js 代理服务 + Nginx** 架构。

## 功能
- `index.html`：填写目标学校、学生信息、润色要求
- `result.html`：展示润色结果并支持复制
- `server.js`：服务端代理百炼 API，保护 API Key

## 目录结构

```text
LoveEssay/
├── index.html
├── result.html
├── server.js
├── package.json
├── .env.example
├── deploy.sh
├── deploy/
│   ├── nginx.loveessay.conf
│   └── loveessay.service
├── scripts/
│   └── deploy_server.sh
└── DEPLOY_PLAN.md
```

## 本地运行

要求：Node.js 18+

```bash
npm install
export DASHSCOPE_API_KEY="your-real-key"
npm start
```

默认端口：`6789`

本地访问：
- 页面：[http://127.0.0.1:6789](http://127.0.0.1:6789)
- 健康检查：[http://127.0.0.1:6789/api/health](http://127.0.0.1:6789/api/health)

## API

### `POST /api/polish`

请求体：

```json
{
  "school_name": "斯坦福大学",
  "student_info_str": "学生详细信息...",
  "query": "突出领导力"
}
```

成功响应：

```json
{
  "text": "润色后的文书内容...",
  "request_id": "xxx"
}
```

失败响应：

```json
{
  "error": "错误信息",
  "request_id": "xxx"
}
```

## 生产部署

在服务器项目目录执行：

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
- 配置 Nginx 监听 `6788`（HTTP），并代理 `/api/` 到 `127.0.0.1:6789`

## 环境变量

参考 `.env.example`，核心变量：
- `DASHSCOPE_API_KEY`：百炼 Key（仅服务器保存）
- `WORKFLOW_APP_ID`：应用 ID
- `PORT`：代理服务端口，默认 `6789`
- `RATE_LIMIT_PER_MINUTE`：单 IP 每分钟请求上限
- `BASIC_AUTH_USER`：页面/API 访问用户名
- `BASIC_AUTH_PASS`：页面/API 访问密码

## 安全说明
- 不要把真实 API Key 提交到仓库。
- 前端仅访问同域 `/api/polish`，避免暴露 Key。
- 线上通过 Nginx Basic Auth 保护页面和 API。

## GitHub Actions 自动部署（阿里云 ECS）

已提供工作流文件：
- `.github/workflows/deploy-aliyun.yml`

触发方式：
- push 到 `main`
- 手动触发 `workflow_dispatch`

请在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 中配置以下 Secrets：
- `ALIYUN_HOST`：服务器公网 IP（例如 `8.137.71.205`）
- `ALIYUN_USER`：SSH 用户（通常 `root`）
- `ALIYUN_SSH_PORT`：SSH 端口（默认 `22`）
- `ALIYUN_SSH_PRIVATE_KEY`：用于登录服务器的私钥全文（PEM）
- `DASHSCOPE_API_KEY`：百炼 API Key
- `WORKFLOW_APP_ID`：应用 ID（例如 `6e42604f098e49de9ac0536571b47926`）
- `BASIC_AUTH_USER`：页面访问用户名
- `BASIC_AUTH_PASS`：页面访问密码

工作流会自动：
- 上传代码到 `/root/LoveEssay`
- 更新 `/etc/loveessay/loveessay.env`
- 执行 `./deploy.sh`
- 检查 `loveessay/nginx` 状态并做本地健康检查
