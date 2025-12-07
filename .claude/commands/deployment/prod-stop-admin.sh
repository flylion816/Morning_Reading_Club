#!/bin/bash

# 生产环境停止脚本 - Admin Vue 前端
# 功能：停止 Admin Vue 前端服务
# 用途：线上服务器停止 Admin 前端服务

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}🛑 停止 Admin Vue 服务${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

# 查找 Admin 进程（preview 服务）
ADMIN_PID=$(pgrep -f "vite.*preview|npm.*preview" | head -1)

if [ -z "$ADMIN_PID" ]; then
    echo -e "${YELLOW}⚠️  没有找到运行中的 Admin Vue 服务${NC}"
    echo ""

    # 尝试查找其他可能的相关进程
    echo -e "${YELLOW}🔍 尝试查找其他可能的进程...${NC}"
    ps aux | grep -E "preview|admin" | grep -v grep
    echo ""
    exit 0
fi

echo -e "${YELLOW}📋 找到 Admin Vue 进程：${NC}"
echo "  PID: $ADMIN_PID"
ps aux | grep $ADMIN_PID | grep -v grep
echo ""

# 停止进程
echo -e "${YELLOW}⏳ 停止 Admin Vue 服务...${NC}"
kill -TERM $ADMIN_PID

# 等待进程关闭（最多10秒）
WAIT_COUNT=0
MAX_WAIT=10

while kill -0 $ADMIN_PID 2>/dev/null; do
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))

    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        echo -e "${YELLOW}⚠️  进程未在规定时间内关闭，强制杀死...${NC}"
        kill -9 $ADMIN_PID
        sleep 1
        break
    fi
done

# 验证进程已停止
if ! kill -0 $ADMIN_PID 2>/dev/null; then
    echo -e "${GREEN}✓ Admin Vue 服务已停止${NC}"
else
    echo -e "${RED}❌ 无法停止 Admin Vue 服务，请手动检查${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Admin Vue 停止完成${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}💡 后续操作：${NC}"
echo "  • 重启服务：bash .claude/commands/deployment/prod-start-admin.sh"
echo "  • 查看进程：ps aux | grep preview"
echo "  • 重新构建：cd admin && npm run build"
echo ""
