#!/bin/bash
# 重启（重新运行会自动停掉上次启动的服务） —— 已合并到项目根目录的 start-all-local.sh。
# 旧版本用 pkill / kill -9 按名字和端口强杀进程，会误伤其他项目，已废弃。
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
exec bash "$ROOT/start-all-local.sh"  "$@"
