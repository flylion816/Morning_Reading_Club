#!/bin/bash
################################################################################
# 晨读营 - 停止本地开发环境
#
# 用法：
#   bash stop-all-local.sh               停止本脚本启动的后端和管理后台
#   bash stop-all-local.sh --mini-prod   同时把小程序 env.js 改回 'prod'（上传前用）
#
# 只停止 start-all-local.sh 启动的进程；MongoDB / Redis 是共用服务，不会停止。
################################################################################

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$PROJECT_DIR/.local-run"
ENV_JS="$PROJECT_DIR/miniprogram/config/env.js"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

MINI_PROD=false
for arg in "$@"; do
  case "$arg" in
    --mini-prod) MINI_PROD=true ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
  esac
done

is_ours() {
  local cwd
  # lsof 会把中文路径转义成 \xHH，用 printf %b 还原后再比较
  cwd=$(printf '%b' "$(lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')")
  [[ "$cwd" == "$PROJECT_DIR"* ]]
}

port_pid() { lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -1; }

# 优先按记录的进程号停止；进程号失效时，再看端口上的进程是否属于本项目
stop_service() {
  local name="$1" label="$2" port="$3" file="$RUN_DIR/$1.pid" pid=""
  [ -f "$file" ] && pid=$(cat "$file")
  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    pid=$(port_pid "$port")
  fi
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && is_ours "$pid"; then
    kill "$pid" 2>/dev/null
    for _ in 1 2 3 4 5; do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
    kill -9 "$pid" 2>/dev/null || true
    echo -e "  ${GREEN}✓${NC} $label 已停止 (PID $pid)"
  else
    echo -e "  ${YELLOW}-${NC} $label 未在运行"
  fi
  rm -f "$file"
}

echo -e "${BLUE}🛑 停止晨读营本地服务${NC}"
ADMIN_PORT=$(cat "$RUN_DIR/admin.port" 2>/dev/null || echo 5174)
stop_service backend "后端" 3000
stop_service admin "管理后台" "$ADMIN_PORT"
rm -f "$RUN_DIR/admin.port"

if $MINI_PROD; then
  sed -i '' -E "s/^const currentEnv = '[a-z]+';.*/const currentEnv = 'prod';/" "$ENV_JS"
  echo -e "  ${GREEN}✓${NC} 小程序 env.js 已改回 'prod'"
elif grep -qE "^const currentEnv = 'dev'" "$ENV_JS"; then
  echo -e "  ${YELLOW}⚠${NC} 小程序 env.js 仍是 'dev'，上传前请运行：bash stop-all-local.sh --mini-prod"
fi

echo -e "  ${YELLOW}-${NC} MongoDB / Redis 是共用服务，未停止"
