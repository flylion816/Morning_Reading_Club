#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "切换小程序租户"
echo "可输入租户 slug，例如：fanren 或 starry"
echo "直接回车将切回默认租户 fanren"
echo

if ! command -v npm >/dev/null 2>&1; then
  echo "没有找到 npm。请先安装 Node.js，然后再执行。"
  echo
  echo "按回车关闭窗口。"
  read -r _
  exit 1
fi

npm run tenant:switch

echo
echo "切换完成。请到微信开发者工具里重新编译；如果仍看到旧租户，请清缓存后再编译。"
echo
echo "按回车关闭窗口。"
read -r _
