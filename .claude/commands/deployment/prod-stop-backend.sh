#!/bin/bash

# 生产环境停止脚本 - 后端服务
# 功能：优雅停止后端服务（不丢失现有请求）
# 用途：线上服务器停止后端服务

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}🛑 停止后端服务${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

# 查找后端进程
BACKEND_PID=$(pgrep -f "node.*src/server.js" | head -1)

if [ -z "$BACKEND_PID" ]; then
    echo -e "${YELLOW}⚠️  没有找到运行中的后端服务${NC}"
    echo ""

    # 尝试查找其他可能的Node进程
    echo -e "${YELLOW}🔍 尝试查找其他Node进程...${NC}"
    ps aux | grep -E "node|npm" | grep -v grep
    echo ""
    exit 0
fi

echo -e "${YELLOW}📋 找到后端进程：${NC}"
echo "  PID: $BACKEND_PID"
ps aux | grep $BACKEND_PID | grep -v grep
echo ""

# 优雅停止（SIGTERM 信号）
echo -e "${YELLOW}⏳ 发送停止信号（SIGTERM）...${NC}"
kill -TERM $BACKEND_PID

# 等待进程关闭（最多30秒）
WAIT_COUNT=0
MAX_WAIT=30

while kill -0 $BACKEND_PID 2>/dev/null; do
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))

    if [ $WAIT_COUNT -eq 10 ]; then
        echo -e "${YELLOW}⏳ 等待进程优雅关闭... ($WAIT_COUNT/30秒)${NC}"
    fi

    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        echo -e "${RED}⚠️  进程未在规定时间内关闭，强制杀死...${NC}"
        kill -9 $BACKEND_PID
        sleep 1
        break
    fi
done

# 验证进程已停止
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${GREEN}✓ 后端服务已停止${NC}"
else
    echo -e "${RED}❌ 无法停止后端服务，请手动检查${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 后端服务停止完成${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}💡 后续操作：${NC}"
echo "  • 检查日志：tail -f logs/combined.log"
echo "  • 重启服务：bash .claude/commands/deployment/prod-start-backend.sh"
echo "  • 查看进程：ps aux | grep node"
echo ""
