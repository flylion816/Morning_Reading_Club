#!/bin/bash
# 快速清理和重启所有服务
# 一键杀掉所有进程并重新启动

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}🔄 快速重启所有服务${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}🧹 清理所有进程...${NC}"

# 第一轮：标准杀死
pkill -9 -f "npm.*run dev" 2>/dev/null || true
pkill -9 -f "node" 2>/dev/null || true
sleep 1

# 第二轮：检查是否有顽固进程
REMAINING=$(ps aux | grep -E "(node|npm)" | grep -v grep | wc -l)
if [ "$REMAINING" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  检测到 $REMAINING 个顽固进程，强制清理...${NC}"
    ps aux | grep -E "(node|npm)" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true
    sleep 1
fi

# 第三轮：清理占用的端口
for PORT in 3000 5173 27017; do
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  清理端口 $PORT...${NC}"
        lsof -ti :$PORT | xargs -r kill -9 2>/dev/null || true
    fi
done

sleep 1

echo -e "${GREEN}✓ 所有进程已清理${NC}"
echo ""

# 获取脚本位置并执行 start-all.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/start-all.sh"
