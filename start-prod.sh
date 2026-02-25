#!/bin/bash

# ========================================
# 晨读营 - 生产环境启动脚本
# ========================================
# 启动生产环境所有服务：MongoDB、MySQL、Redis、后端、管理后台

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      晨读营 - 生产环境启动                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# ==================== 1️⃣ 清理旧进程 ====================
echo -e "${YELLOW}🧹 清理旧的后台进程...${NC}"
pkill -f "npm run dev" || true
pkill -f "node.*src/server" || true
sleep 1

# ==================== 2️⃣ 检查环境文件 ====================
echo ""
echo -e "${YELLOW}📋 检查配置文件...${NC}"

if [ ! -f "$PROJECT_ROOT/.env.prod" ]; then
    echo -e "${RED}❌ 错误: .env.prod 文件不存在${NC}"
    echo "   请先创建 .env.prod 文件"
    exit 1
fi
echo -e "${GREEN}✓ .env.prod 文件已找到${NC}"

if [ ! -f "$PROJECT_ROOT/docker-compose.prod.yml" ]; then
    echo -e "${RED}❌ 错误: docker-compose.prod.yml 文件不存在${NC}"
    exit 1
fi
echo -e "${GREEN}✓ docker-compose.prod.yml 文件已找到${NC}"

# ==================== 3️⃣ 检查 Docker ====================
echo ""
echo -e "${YELLOW}🐳 检查 Docker...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ 错误: Docker 未安装${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker 已安装${NC}"

if ! docker ps &>/dev/null; then
    echo -e "${RED}❌ 错误: Docker daemon 未运行${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker daemon 正在运行${NC}"

# ==================== 4️⃣ 启动数据库容器 ====================
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🚀 启动数据库服务...${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"

cd "$PROJECT_ROOT"

# 停止旧容器（如果存在）
docker-compose -f docker-compose.prod.yml --env-file .env.prod down 2>/dev/null || true

# 启动新容器
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d --remove-orphans

echo -e "${GREEN}✓ 数据库容器已启动${NC}"

# 等待数据库启动
echo ""
echo -e "${YELLOW}⏳ 等待数据库启动...${NC}"
sleep 5

# ==================== 5️⃣ 检查数据库连接 ====================
echo ""
echo -e "${YELLOW}🔗 检查数据库连接...${NC}"

# MongoDB
if docker exec morning-reading-mongodb-prod mongosh --eval "db.adminCommand('ping')" &>/dev/null; then
    echo -e "${GREEN}  ✓ MongoDB 连接成功${NC}"
else
    echo -e "${RED}  ✗ MongoDB 连接失败${NC}"
    docker-compose -f docker-compose.prod.yml logs mongodb
    exit 1
fi

# MySQL
if docker exec morning-reading-mysql-prod mysqladmin ping -h localhost &>/dev/null; then
    echo -e "${GREEN}  ✓ MySQL 连接成功${NC}"
else
    echo -e "${RED}  ✗ MySQL 连接失败${NC}"
    docker-compose -f docker-compose.prod.yml logs mysql
    exit 1
fi

# Redis
if docker exec morning-reading-redis-prod redis-cli -a "Prod_Redis@Secure123!" ping &>/dev/null; then
    echo -e "${GREEN}  ✓ Redis 连接成功${NC}"
else
    echo -e "${RED}  ✗ Redis 连接失败${NC}"
    docker-compose -f docker-compose.prod.yml logs redis
    exit 1
fi

# ==================== 6️⃣ 启动后端应用 ====================
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🚀 启动后端应用...${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"

cd "$PROJECT_ROOT/backend"

# 检查并安装依赖
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 安装依赖...${NC}"
    npm install --production
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
fi

# 使用 .env.prod 启动后端
export $(cat "$PROJECT_ROOT/.env.prod" | xargs)
NODE_ENV=production npm run dev > /tmp/backend-prod.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ 后端启动中 (PID: $BACKEND_PID)${NC}"

# ==================== 7️⃣ 启动管理后台 ====================
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🎨 启动管理后台...${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"

cd "$PROJECT_ROOT/admin"

# 检查并安装依赖
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 安装依赖...${NC}"
    npm install
    echo -e "${GREEN}✓ 依赖安装完成${NC}"
fi

# 启动管理后台
export $(cat "$PROJECT_ROOT/.env.prod" | xargs)
npm run dev > /tmp/admin-prod.log 2>&1 &
ADMIN_PID=$!
echo -e "${GREEN}✓ 管理后台启动中 (PID: $ADMIN_PID)${NC}"

# 等待应用启动
sleep 3

# ==================== 8️⃣ 显示启动信息 ====================
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}✅ 所有服务已启动！${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}📌 服务访问地址${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  后端 API:${NC}     http://localhost:3000"
echo -e "${GREEN}  健康检查:${NC}     http://localhost:3000/api/v1/health"
echo -e "${GREEN}  管理后台:${NC}     http://localhost:5173"
echo ""

echo -e "${CYAN}📊 数据库连接信息${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  MongoDB:${NC}      localhost:27017"
echo -e "    用户: ${CYAN}admin${NC}"
echo -e "    密码: ${CYAN}Prod_Mongodb@Secure123!${NC}"
echo ""
echo -e "${GREEN}  MySQL:${NC}        localhost:3306"
echo -e "    用户: ${CYAN}morning_user${NC}"
echo -e "    密码: ${CYAN}Prod_User@Secure123!${NC}"
echo -e "    Root: ${CYAN}Prod_Root@Secure123!${NC}"
echo ""
echo -e "${GREEN}  Redis:${NC}        localhost:6379"
echo -e "    密码: ${CYAN}Prod_Redis@Secure123!${NC}"
echo ""

echo -e "${CYAN}👤 管理员账号${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  邮箱:${NC}     admin@morningreading.com"
echo -e "${GREEN}  密码:${NC}     admin123456"
echo ""

echo -e "${CYAN}📝 日志查看${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  后端日志:${NC}   tail -f /tmp/backend-prod.log"
echo -e "${GREEN}  管理后台:${NC}   tail -f /tmp/admin-prod.log"
echo -e "${GREEN}  容器日志:${NC}   docker-compose -f docker-compose.prod.yml logs -f"
echo ""

echo -e "${CYAN}🛑 停止服务${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  停止数据库:${NC}  docker-compose -f docker-compose.prod.yml down"
echo -e "${GREEN}  停止应用:${NC}    pkill -f 'npm run dev'"
echo ""

echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo ""

# 等待用户中断
wait $BACKEND_PID $ADMIN_PID 2>/dev/null || true

echo ""
echo -e "${YELLOW}👋 所有服务已停止${NC}"
