#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/meeting-assistant"
PORT="5173"
URL="http://127.0.0.1:${PORT}/"
LOG_FILE="$APP_DIR/.local/dev-server.log"
PID_FILE="$APP_DIR/.local/dev-server.pid"

echo "启动：韧性之树晨读营·观察者视角"
echo "固定地址：$URL"
echo ""

if [ ! -d "$APP_DIR" ]; then
  echo "没有找到应用目录：$APP_DIR"
  echo "请确认这个启动脚本还在「七个习惯晨读营」项目目录里。"
  read -k 1 "?按任意键关闭..."
  exit 1
fi

cd "$APP_DIR"
mkdir -p .local

if ! command -v npm >/dev/null 2>&1; then
  echo "没有找到 npm。请先安装 Node.js，然后再双击启动。"
  read -k 1 "?按任意键关闭..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "首次启动，需要先安装依赖，请稍等..."
  npm install
fi

existing_pid="$(lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null | head -1 || true)"
if [ -n "$existing_pid" ]; then
  existing_cmd="$(ps -p "$existing_pid" -o command= 2>/dev/null || true)"
  if echo "$existing_cmd" | grep -q "meeting-assistant"; then
    echo "观察者服务已经在运行，直接打开页面。"
    open "$URL"
    echo ""
    echo "可以关闭这个窗口。"
    read -k 1 "?按任意键关闭..."
    exit 0
  fi

  echo "端口 ${PORT} 已被其他服务占用，将自动结束占用进程并启动观察者服务。"
  echo ""
  echo "占用进程："
  echo "$existing_cmd"
  echo ""
  kill "$existing_pid" 2>/dev/null || true
  sleep 1
  if lsof -tiTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; then
    echo "普通结束失败，尝试强制结束占用进程。"
    kill -9 "$existing_pid" 2>/dev/null || true
    sleep 1
  fi
  if lsof -tiTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; then
    echo "端口仍被占用，无法继续启动。"
    read -k 1 "?按任意键关闭..."
    exit 1
  fi
fi

echo "正在启动本地服务..."
nohup npm run dev -- --host 127.0.0.1 --port "$PORT" --strictPort > "$LOG_FILE" 2>&1 &
server_pid="$!"
echo "$server_pid" > "$PID_FILE"

for i in {1..30}; do
  if curl -s "$URL" >/dev/null 2>&1; then
    echo "服务已启动。"
    open "$URL"
    echo ""
    echo "页面已打开：$URL"
    echo "日志文件：$LOG_FILE"
    echo ""
    echo "可以关闭这个窗口，服务会继续在后台运行。"
    read -k 1 "?按任意键关闭..."
    exit 0
  fi
  sleep 0.5
done

echo "服务启动超时，请查看日志：$LOG_FILE"
read -k 1 "?按任意键关闭..."
exit 1
