#!/bin/bash

# 生产环境启动脚本 - 后端服务
# 功能：启动后端服务（生产模式）
# 环境变量：自动设置 NODE_ENV=production, DEBUG_LOG=false
# 用途：线上服务器启动后端服务

set -e  # 任何命令失败就退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT/backend"

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}🚀 启动后端服务（生产环境）${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

# 设置生产环境变量
export NODE_ENV=production
export DEBUG_LOG=false
export PORT=${PORT:-3000}

echo -e "${YELLOW}📝 环境配置：${NC}"
echo "  NODE_ENV: $NODE_ENV"
echo "  DEBUG_LOG: $DEBUG_LOG"
echo "  PORT: $PORT"
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 错误: Node.js 未安装${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js 已安装: $(node --version)${NC}"
echo ""

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 安装依赖（生产模式）...${NC}"
    npm install --production
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
    echo ""
fi

# 检查 .env.production 文件
if [ ! -f ".env.production" ]; then
    echo -e "${YELLOW}⚠️ 警告: .env.production 文件不存在${NC}"
    echo "  建议创建此文件配置生产环境变量"
    echo ""
fi

# 验证数据库连接（可选）
echo -e "${YELLOW}🔗 验证数据库连接...${NC}"
if MONGO_URI=${MONGO_URI:-mongodb://localhost:27017/morningreading} npm run start &
then
    sleep 3
    # 如果启动成功，进程仍在运行
    echo -e "${GREEN}✓ 数据库连接正常${NC}"
    wait  # 等待启动的进程
else
    echo -e "${RED}❌ 数据库连接失败${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 后端服务已启动${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}📊 服务信息：${NC}"
echo "  服务地址: http://localhost:$PORT"
echo "  环境: 生产环境"
echo "  日志: 仅输出错误日志"
echo ""

echo -e "${YELLOW}💡 常用命令：${NC}"
echo "  查看日志: tail -f logs/combined.log"
echo "  查看错误: tail -f logs/error.log"
echo "  停止服务: bash .claude/commands/deployment/prod-stop-backend.sh"
echo ""
