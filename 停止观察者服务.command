#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/meeting-assistant"
PORT="5173"
PID_FILE="$APP_DIR/.local/dev-server.pid"

echo "停止：韧性之树晨读营·观察者视角"
echo ""

stopped="false"

if [ -f "$PID_FILE" ]; then
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    stopped="true"
    echo "已停止记录中的服务进程：$pid"
  fi
  rm -f "$PID_FILE"
fi

port_pids="$(lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "$port_pids" ]; then
  for pid in ${(f)port_pids}; do
    cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if echo "$cmd" | grep -q "meeting-assistant"; then
      kill "$pid" 2>/dev/null || true
      stopped="true"
      echo "已停止 5173 上的观察者服务进程：$pid"
    else
      echo "5173 上还有其他服务占用，未处理："
      echo "$cmd"
    fi
  done
fi

if [ "$stopped" = "false" ]; then
  echo "没有发现正在运行的观察者服务。"
fi

echo ""
read -k 1 "?按任意键关闭..."
