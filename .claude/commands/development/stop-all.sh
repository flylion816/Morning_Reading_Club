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
pkill -f "npm.*run dev" 2>/dev/null || echo "没有运行中的 npm 服务"

echo -e "${YELLOW}⏳ 停止 Node.js 进程...${NC}"
pkill -f "node" 2>/dev/null || echo "没有运行中的 Node.js 进程"

echo -e "${YELLOW}⏳ 停止 MongoDB...${NC}"
pkill -f "mongod" 2>/dev/null || echo "MongoDB 未运行"

sleep 1

echo ""
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 所有服务已停止${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo "运行中的 Node 相关进程:"
ps aux | grep -E "node|npm" | grep -v grep || echo "无运行中的进程"

echo ""
echo -e "${YELLOW}💡 提示:${NC}"
echo "  • 重启服务: ./.claude/commands/development/start-all.sh"
echo "  • 快速重启: ./.claude/commands/development/restart-all.sh"
echo ""
