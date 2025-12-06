#!/bin/bash
# 停止所有开发服务脚本
# 快速停止 MongoDB、后端、Admin 等所有服务

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}🛑 停止所有开发服务${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}⏳ 停止 npm 开发服务...${NC}"
pkill -9 -f "npm.*run dev" 2>/dev/null
NPM_COUNT=$(ps aux | grep -E "npm.*run dev" | grep -v grep | wc -l)
if [ "$NPM_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ npm 服务已停止${NC}"
else
    echo -e "${YELLOW}⚠️  npm 进程仍在运行，进行强制清理...${NC}"
fi

echo -e "${YELLOW}⏳ 停止 Node.js 进程...${NC}"
pkill -9 -f "node" 2>/dev/null
NODE_COUNT=$(ps aux | grep -E "\bnode\b" | grep -v grep | wc -l)
if [ "$NODE_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ Node.js 进程已停止${NC}"
else
    echo -e "${YELLOW}⚠️  Node.js 进程仍在运行，进行强制清理...${NC}"
    ps aux | grep -E "\bnode\b" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true
fi

echo -e "${YELLOW}⏳ 停止 MongoDB...${NC}"
pkill -9 -f "mongod" 2>/dev/null
if pgrep -f "mongod" > /dev/null; then
    echo -e "${YELLOW}⚠️  MongoDB 仍在运行${NC}"
else
    echo -e "${GREEN}✓ MongoDB 已停止${NC}"
fi

echo -e "${YELLOW}🔌 清理占用的端口...${NC}"
for PORT in 3000 5173 27017; do
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}  • 清理端口 $PORT...${NC}"
        lsof -ti :$PORT | xargs -r kill -9 2>/dev/null || true
    fi
done

sleep 1

# 最终验证
REMAINING=$(ps aux | grep -E "(node|npm)" | grep -v grep | wc -l)
echo ""
echo -e "${BLUE}════════════════════════════════════════════${NC}"
if [ "$REMAINING" -eq 0 ]; then
    echo -e "${GREEN}✅ 所有服务已停止 (0个遗留进程)${NC}"
else
    echo -e "${YELLOW}⚠️  仍有 $REMAINING 个进程未停止${NC}"
fi
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

if [ "$REMAINING" -gt 0 ]; then
    echo -e "${YELLOW}运行中的进程:${NC}"
    ps aux | grep -E "node|npm" | grep -v grep
fi

echo ""
echo -e "${YELLOW}💡 提示:${NC}"
echo "  • 重启服务: ./.claude/commands/development/dev-start-all.sh"
echo "  • 快速重启: ./.claude/commands/development/dev-restart-all.sh"
echo ""
