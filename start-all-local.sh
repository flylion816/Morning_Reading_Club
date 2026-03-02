#!/bin/bash

################################################################################
# 本地开发环境一键启动脚本
# 用途：启动所有本地开发服务（后端、管理后台、Redis、MongoDB）
# 执行：bash start-all-local.sh
################################################################################

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   晨读营 - 本地开发环境一键启动                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# 清理旧进程
echo -e "${YELLOW}🧹 清理旧的后台进程...${NC}"
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "node src/server" 2>/dev/null || true
sleep 1

# 检查必要的服务
echo -e "${YELLOW}🔍 检查依赖服务...${NC}"

# 检查 Redis
if ! command -v redis-server &> /dev/null; then
    echo -e "${RED}❌ Redis 未安装${NC}"
    echo "   请先安装：brew install redis"
    exit 1
fi

# 检查 MongoDB
if ! command -v mongosh &> /dev/null; then
    echo -e "${RED}❌ MongoDB 未安装${NC}"
    echo "   请先安装：brew install mongodb-community"
    exit 1
fi

echo -e "${GREEN}✅ 依赖检查通过${NC}"
echo ""

# 启动 Redis
echo -e "${YELLOW}🚀 启动 Redis...${NC}"
redis-server --daemonize yes --port 6379 2>/dev/null
sleep 1
if redis-cli ping &> /dev/null; then
    echo -e "${GREEN}✅ Redis 已启动${NC}"
else
    echo -e "${RED}❌ Redis 启动失败${NC}"
    exit 1
fi

# 启动 MongoDB（如果未启动）
echo -e "${YELLOW}🚀 启动 MongoDB...${NC}"
if ! mongosh --eval "db.runCommand({ping:1})" &> /dev/null; then
    if command -v brew &> /dev/null; then
        brew services start mongodb-community 2>/dev/null || true
        sleep 2
    fi
fi

if mongosh --eval "db.runCommand({ping:1})" &> /dev/null; then
    echo -e "${GREEN}✅ MongoDB 已启动${NC}"
else
    echo -e "${RED}⚠️  MongoDB 未在运行，请手动启动${NC}"
fi

echo ""

# 启动后端
echo -e "${YELLOW}🚀 启动后端服务...${NC}"
cd "$PROJECT_DIR/backend"
npm start > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
sleep 3

if curl -s http://localhost:3000/api/v1/health &> /dev/null; then
    echo -e "${GREEN}✅ 后端已启动 (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}❌ 后端启动失败${NC}"
    echo "   日志：tail -f /tmp/backend.log"
    exit 1
fi

echo ""

# 启动管理后台
echo -e "${YELLOW}🚀 启动管理后台...${NC}"
cd "$PROJECT_DIR/admin"
npm run dev > /tmp/admin.log 2>&1 &
ADMIN_PID=$!
sleep 5

echo -e "${GREEN}✅ 管理后台已启动${NC}"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}✨ 所有服务已启动！${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}📋 服务地址：${NC}"
echo "  • 后端 API：        ${GREEN}http://localhost:3000${NC}"
echo "  • 管理后台：        ${GREEN}http://localhost:5173${NC}"
echo "  • MongoDB：         ${GREEN}localhost:27017${NC}"
echo "  • Redis：           ${GREEN}localhost:6379${NC}"
echo ""

echo -e "${BLUE}📝 日志查看：${NC}"
echo "  • 后端：   tail -f /tmp/backend.log"
echo "  • 管理后台：tail -f /tmp/admin.log"
echo ""

echo -e "${BLUE}🚀 小程序：${NC}"
echo "  • 用微信开发工具打开 miniprogram/ 目录"
echo ""

echo -e "${BLUE}⛔ 停止所有服务：${NC}"
echo "  bash stop-all-local.sh"
echo ""
