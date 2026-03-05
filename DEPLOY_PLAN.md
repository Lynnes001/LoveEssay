# LoveEssay 部署与验收手册

## 1. 架构
- Nginx 作为公网访问入口（HTTP）
- 前端静态资源：`/var/www/loveessay`
- Node 服务：本机回环地址
- API 路由：`/api/polish`（Nginx 反向代理到 Node）
- 页面与 API 统一走 Nginx Basic Auth（用户名/密码）

## 2. 服务器准备
推荐：阿里云轻量应用服务器（Ubuntu 22.04，1C1G）。

需要开放网络入口：
- SSH 入口（用于运维登录）
- 业务入口（用于页面和 API 访问）

## 3. 发布步骤

### 3.1 上传代码
将本仓库上传到服务器，例如：

```bash
scp -r ./LoveEssay root@<server-host>:/root/
```

### 3.2 执行部署脚本

```bash
cd /root/LoveEssay
chmod +x deploy.sh scripts/deploy_server.sh
sudo ./deploy.sh
```

### 3.3 配置 API Key 和访问账号
编辑 `/etc/loveessay/loveessay.env`：

```bash
DASHSCOPE_API_KEY=your-real-key
PORT=<按部署环境配置>
WORKFLOW_MODEL=workflow-6e42604f098e49de9ac0536571b47926
RATE_LIMIT_PER_MINUTE=30
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=change-me-now
```

重启服务（会重建认证密码文件）：

```bash
sudo ./deploy.sh
sudo systemctl restart loveessay
```

## 4. 验收清单

### 4.1 服务状态

```bash
systemctl status loveessay
systemctl status nginx
```

### 4.2 健康检查

```bash
curl http://localhost:<本地服务端口>/api/health
```

预期：返回 `{"ok":true,...}`。

### 4.3 页面检查
浏览器访问：

- `http://<server-host>:<业务入口端口>`

预期：浏览器先弹出用户名密码认证框。认证后提交测试数据，确认可跳转到结果页并显示润色文本。

### 4.4 API 检查

```bash
curl -X POST http://<server-host>:<业务入口端口>/api/polish \
  -u '<BASIC_AUTH_USER>:<BASIC_AUTH_PASS>' \
  -H 'Content-Type: application/json' \
  -d '{
    "school_name":"斯坦福大学",
    "student_info_str":"学生参与机器人竞赛并获奖",
    "query":"突出科研和领导力"
  }'
```

## 5. 常见故障排查

1. `服务端未配置 DASHSCOPE_API_KEY`
- 检查 `/etc/loveessay/loveessay.env`
- 修改后重启：`systemctl restart loveessay`

2. `502 Bad Gateway`
- Node 服务异常，检查：`journalctl -u loveessay -n 200 --no-pager`
- 确认本机 Node 服务正常监听

3. `429 请求过于频繁`
- 触发限流，调大 `RATE_LIMIT_PER_MINUTE`

4. 页面可开但提交失败
- 检查 Nginx 代理配置：`/etc/nginx/sites-available/loveessay`
- 检查浏览器网络请求是否命中 `/api/polish`

5. 一直弹认证框/认证失败
- 检查 `/etc/loveessay/loveessay.env` 的 `BASIC_AUTH_USER/BASIC_AUTH_PASS`
- 重新执行 `sudo ./deploy.sh` 以重建 `/etc/nginx/.loveessay_htpasswd`

## 6. 运维命令

```bash
# 重启服务
sudo systemctl restart loveessay
sudo systemctl restart nginx

# 查看日志
journalctl -u loveessay -f

# 校验 Nginx
nginx -t
```
