#!/bin/bash
# 已合并到项目根目录的 stop-all-local.sh（只停止本项目启动的进程）。
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
exec bash "$ROOT/stop-all-local.sh" "$@"
