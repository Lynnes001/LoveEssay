#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "$EUID" -ne 0 ]; then
  echo "请使用 root 用户执行"
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/scripts/deploy_server.sh" ]; then
  echo "未找到 scripts/deploy_server.sh，请在项目根目录执行"
  exit 1
fi

bash "$SCRIPT_DIR/scripts/deploy_server.sh"
