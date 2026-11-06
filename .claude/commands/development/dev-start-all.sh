#!/bin/bash
# 已合并到项目根目录的 start-all-local.sh。
# 旧版本会 kill 掉本机所有 node 进程和 MongoDB，会误伤其他项目，已废弃。
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
exec bash "$ROOT/start-all-local.sh" "$@"
