#!/bin/bash

# 生产环境启动脚本 - Admin Vue 前端
# 功能：启动 Admin Vue 前端（生产模式）
# 环境变量：自动设置 NODE_ENV=production, VITE_DEBUG_LOG=false
# 用途：线上服务器启动 Admin 前端服务

set -e  # 任何命令失败就退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT/admin"

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}🚀 启动 Admin Vue（生产环境）${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

# 设置生产环境变量
export NODE_ENV=production
export VITE_DEBUG_LOG=false
export VITE_API_URL=${VITE_API_URL:-http://localhost:3000/api/v1}

echo -e "${YELLOW}📝 环境配置：${NC}"
echo "  NODE_ENV: $NODE_ENV"
echo "  VITE_DEBUG_LOG: $VITE_DEBUG_LOG"
echo "  VITE_API_URL: $VITE_API_URL"
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

# 检查构建文件
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}🔨 构建项目...${NC}"
    npm run build
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 项目构建完成${NC}"
    else
        echo -e "${RED}❌ 项目构建失败${NC}"
        exit 1
    fi
    echo ""
fi

echo -e "${YELLOW}📋 构建信息：${NC}"
if [ -d "dist" ]; then
    BUILD_SIZE=$(du -sh dist | cut -f1)
    FILE_COUNT=$(find dist -type f | wc -l)
    echo "  构建目录大小: $BUILD_SIZE"
    echo "  文件数量: $FILE_COUNT"
fi
echo ""

# 启动预览服务器
echo -e "${YELLOW}⏳ 启动预览服务器...${NC}"
npm run preview

echo ""
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Admin Vue 已启动${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}📊 服务信息：${NC}"
echo "  访问地址: http://localhost:4173"
echo "  环境: 生产环境"
echo "  日志: 仅输出错误日志"
echo ""

echo -e "${YELLOW}💡 常用命令：${NC}"
echo "  停止服务: bash .claude/commands/deployment/prod-stop-admin.sh"
echo "  查看日志: npm run preview 中的输出"
echo "  重新构建: npm run build"
echo ""

echo -e "${YELLOW}⚠️  生产部署建议：${NC}"
echo "  • 使用 Nginx 或 Apache 反向代理（性能更好）"
echo "  • 配置 HTTPS 和 SSL 证书"
echo "  • 使用 PM2 或 systemd 管理进程"
echo "  • 配置日志轮换和备份"
echo ""
