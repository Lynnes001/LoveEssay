#!/bin/bash

set -euo pipefail

APP_DIR="/var/www/loveessay"
ENV_DIR="/etc/loveessay"
ENV_FILE="$ENV_DIR/loveessay.env"

if [ "$EUID" -ne 0 ]; then
  echo "请使用 root 用户执行"
  exit 1
fi

echo "[1/8] 安装系统依赖..."
apt update
apt install -y nginx nodejs npm openssl

echo "[2/8] 创建目录..."
mkdir -p "$APP_DIR" "$ENV_DIR"

echo "[3/8] 复制项目文件..."
cp -f index.html result.html server.js package.json "$APP_DIR"/
cp -rf deploy "$APP_DIR"/

if [ -f package-lock.json ]; then
  cp -f package-lock.json "$APP_DIR"/
fi

echo "[4/8] 安装 Node 依赖..."
cd "$APP_DIR"
npm install --omit=dev

echo "[5/8] 写入环境文件..."
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" << 'EOT'
DASHSCOPE_API_KEY=please-set-real-key
PORT=6789
WORKFLOW_APP_ID=6e42604f098e49de9ac0536571b47926
RATE_LIMIT_PER_MINUTE=30
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=change-me
EOT
  chmod 600 "$ENV_FILE"
  echo "已生成 $ENV_FILE，请立即替换 DASHSCOPE_API_KEY / BASIC_AUTH_PASS"
fi

echo "[6/8] 部署 systemd 服务..."
cp -f "$APP_DIR/deploy/loveessay.service" /etc/systemd/system/loveessay.service
systemctl daemon-reload
systemctl enable loveessay
systemctl restart loveessay

echo "[7/8] 部署 Nginx 配置..."
set -a
. "$ENV_FILE"
set +a

# 向后兼容：历史环境变量 WORKFLOW_MODEL 自动映射到 WORKFLOW_APP_ID
if [ -z "${WORKFLOW_APP_ID:-}" ] && [ -n "${WORKFLOW_MODEL:-}" ]; then
  WORKFLOW_APP_ID="$WORKFLOW_MODEL"
  if grep -q '^WORKFLOW_APP_ID=' "$ENV_FILE"; then
    sed -i "s|^WORKFLOW_APP_ID=.*|WORKFLOW_APP_ID=${WORKFLOW_APP_ID}|" "$ENV_FILE"
  else
    echo "WORKFLOW_APP_ID=${WORKFLOW_APP_ID}" >> "$ENV_FILE"
  fi
fi

if [ -z "${BASIC_AUTH_USER:-}" ] || [ -z "${BASIC_AUTH_PASS:-}" ]; then
  echo "缺少 BASIC_AUTH_USER 或 BASIC_AUTH_PASS，请先编辑 $ENV_FILE"
  exit 1
fi

if [ "$BASIC_AUTH_PASS" = "change-me" ]; then
  echo "BASIC_AUTH_PASS 仍为默认值，已阻止部署。请先修改 $ENV_FILE 后重试。"
  exit 1
fi

AUTH_HASH="$(openssl passwd -apr1 "$BASIC_AUTH_PASS")"
printf "%s:%s\n" "$BASIC_AUTH_USER" "$AUTH_HASH" > /etc/nginx/.loveessay_htpasswd
chown root:www-data /etc/nginx/.loveessay_htpasswd
chmod 640 /etc/nginx/.loveessay_htpasswd

cp -f "$APP_DIR/deploy/nginx.loveessay.conf" /etc/nginx/sites-available/loveessay
ln -sf /etc/nginx/sites-available/loveessay /etc/nginx/sites-enabled/loveessay
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo "[8/8] 放通端口..."
ufw allow 6788/tcp 2>/dev/null || true

echo "部署完成。请验证："
echo "1) systemctl status loveessay"
echo "2) curl http://localhost:6789/api/health"
echo "3) curl http://<server-host>:6788"
