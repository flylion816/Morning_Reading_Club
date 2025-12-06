#!/bin/bash
# 快速重启所有服务
# 直接调用 start-all.sh（内部包含完整的清理逻辑）

# 颜色定义
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}🔄 快速重启所有服务${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${YELLOW}(会自动清理旧进程，然后启动所有服务)${NC}"
echo ""

# 获取脚本位置并执行 start-all.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/start-all.sh"
