#!/bin/bash
# 启动所有服务脚本
# 用于启动后端、小程序、管理后台等所有开发服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}🚀 启动所有开发服务${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

# 检查是否在项目根目录
if [ ! -d "backend" ] || [ ! -d "miniprogram" ]; then
    echo -e "${RED}❌ 错误: 未找到项目目录结构${NC}"
    echo "请在项目根目录运行此脚本"
    exit 1
fi

# 清理之前的进程
echo -e "${YELLOW}🧹 清理之前的进程...${NC}"
pkill -f "npm.*run dev" 2>/dev/null || true
pkill -f "node" 2>/dev/null || true
sleep 1

echo -e "${YELLOW}⏳ 启动后端服务...${NC}"
cd backend
npm run dev &
BACKEND_PID=$!
echo -e "${GREEN}✓ 后端进程ID: $BACKEND_PID${NC}"
sleep 3

# 检查后端是否启动成功
if ! ps -p $BACKEND_PID > /dev/null; then
    echo -e "${RED}❌ 后端启动失败${NC}"
    exit 1
fi

cd ..

echo ""
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 所有服务启动成功!${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo "📋 运行中的服务:"
echo "  • 后端: http://localhost:3000"
echo "    API: http://localhost:3000/api/v1"
echo ""

echo "🔍 查看日志:"
echo "  • 后端日志: 在上面的输出中"
echo ""

echo -e "${YELLOW}💡 提示:${NC}"
echo "  • 按 Ctrl+C 停止服务"
echo "  • 使用 'npm run dev' 可在特定目录启动服务"
echo ""

# 保持进程运行
wait
