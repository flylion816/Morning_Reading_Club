#!/bin/bash

################################################################################
# 本地开发环境一键停止脚本
# 用途：停止所有本地开发服务
# 执行：bash stop-all-local.sh
################################################################################

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🛑 停止所有本地开发服务...${NC}"
echo ""

# 停止后端
echo -e "${YELLOW}停止后端服务...${NC}"
pkill -f "node src/server" 2>/dev/null && echo -e "${GREEN}✅ 后端已停止${NC}" || echo -e "${YELLOW}⚠️  后端未运行${NC}"

# 停止管理后台
echo -e "${YELLOW}停止管理后台...${NC}"
pkill -f "npm run dev" 2>/dev/null && echo -e "${GREEN}✅ 管理后台已停止${NC}" || echo -e "${YELLOW}⚠️  管理后台未运行${NC}"

# 停止 Redis
echo -e "${YELLOW}停止 Redis...${NC}"
if command -v redis-cli &> /dev/null; then
    redis-cli shutdown 2>/dev/null && echo -e "${GREEN}✅ Redis 已停止${NC}" || echo -e "${YELLOW}⚠️  Redis 未运行${NC}"
fi

# 停止 MongoDB（可选）
echo -e "${YELLOW}MongoDB（可选停止）...${NC}"
echo "  如需停止 MongoDB，请运行：brew services stop mongodb-community"

echo ""
echo -e "${GREEN}✅ 所有服务已停止${NC}"
