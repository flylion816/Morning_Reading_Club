#!/bin/bash
# 单独启动后端服务脚本
# 启动顺序：清理进程 → MongoDB 检查 → 后端启动

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 获取项目根目录
PROJECT_ROOT="$(pwd)"
while [ ! -d "$PROJECT_ROOT/backend" ] && [ "$PROJECT_ROOT" != "/" ]; do
    PROJECT_ROOT="$(dirname "$PROJECT_ROOT")"
done

if [ ! -d "$PROJECT_ROOT/backend" ] && [ -n "${BASH_SOURCE[0]}" ]; then
    PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)"
fi

cd "$PROJECT_ROOT" 2>/dev/null || exit 1

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🚀 晨读营后端服务启动${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# 检查项目结构
if [ ! -d "backend" ]; then
    echo -e "${RED}❌ 错误: 未找到 backend 目录${NC}"
    echo "请在项目根目录运行此脚本"
    exit 1
fi

echo -e "${YELLOW}📋 启动配置：${NC}"
echo "  项目根目录: $PROJECT_ROOT"
echo "  MongoDB: mongodb://localhost:27017"
echo "  后端: http://localhost:3000"
echo ""

# ============================================
# 第1步：清理旧进程（可选）
# ============================================
echo -e "${YELLOW}🧹 第1步: 清理旧进程...${NC}"

# 只杀死本地启动的后端进程
pkill -9 -f "backend.*npm.*run dev" 2>/dev/null || true
pkill -9 -f "cd.*backend" 2>/dev/null || true
sleep 1

# 检查端口 3000 是否被占用
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  端口 3000 被占用，强制释放...${NC}"
    lsof -ti :3000 | xargs -r kill -9 2>/dev/null || true
    sleep 1
fi

echo -e "${GREEN}✓ 进程清理完成${NC}"
echo ""

# ============================================
# 第2步：检查 MongoDB
# ============================================
echo -e "${YELLOW}🐘 第2步: 检查 MongoDB...${NC}"

if pgrep -f "mongod" > /dev/null; then
    echo -e "${GREEN}✓ MongoDB 已在运行${NC}"
else
    echo -e "${YELLOW}⚠️  MongoDB 未运行${NC}"
    echo -e "${YELLOW}💡 启动 MongoDB 的方式：${NC}"
    echo "   • Docker: docker run -d -p 27017:27017 mongo"
    echo "   • Homebrew: brew services start mongodb-community"
    echo "   • 手动: mongod"
    echo ""
    echo -e "${YELLOW}⚠️  继续启动后端，但可能会连接失败${NC}"
fi
echo ""

# ============================================
# 第3步：启动后端服务
# ============================================
echo -e "${YELLOW}⚙️  第3步: 启动后端服务...${NC}"
cd "$PROJECT_ROOT/backend" || exit 1

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 安装后端依赖...${NC}"
    npm install --silent > /dev/null 2>&1 || npm install
    echo ""
fi

echo -e "${YELLOW}⏳ 启动后端服务...${NC}"
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ 后端进程ID: $BACKEND_PID${NC}"

# 等待后端启动并检查健康状态
BACKEND_HEALTHY=0
for i in {1..30}; do
    if ! ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo -e "${RED}❌ 后端进程已崩溃 (尝试 $i/30)${NC}"
        sleep 1
        continue
    fi

    # 尝试连接到后端 API
    if curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1 || \
       curl -s http://localhost:3000/api/v1/stats/dashboard > /dev/null 2>&1 || \
       nc -z localhost 3000 > /dev/null 2>&1; then
        BACKEND_HEALTHY=1
        echo -e "${GREEN}✓ 后端服务健康检查通过 (第 $i 次尝试)${NC}"
        break
    fi

    if [ $((i % 5)) -eq 0 ]; then
        echo -e "${YELLOW}⏳ 等待后端就绪... ($i/30)${NC}"
    fi
    sleep 1
done

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"

if [ $BACKEND_HEALTHY -eq 1 ]; then
    echo -e "${GREEN}✅ 后端服务启动成功!${NC}"
else
    echo -e "${RED}❌ 后端服务启动失败或无法访问${NC}"
    echo -e "${YELLOW}📋 错误日志 (最后10行):${NC}"
    tail -n 10 /tmp/backend.log | sed 's/^/    /'
fi

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${PURPLE}📊 服务信息：${NC}"
echo -e "${CYAN}后端服务 (Node.js)${NC}"
echo "  地址: http://localhost:3000"
echo "  API: http://localhost:3000/api/v1"
echo "  PID: $BACKEND_PID"
echo "  日志: tail -f /tmp/backend.log"
echo ""

echo -e "${YELLOW}💡 常用命令：${NC}"
echo "  • 查看实时日志: tail -f /tmp/backend.log"
echo "  • 停止后端: kill $BACKEND_PID"
echo "  • 重启后端: pkill -9 -f 'backend.*npm run dev' && bash $0"
echo ""

echo -e "${YELLOW}✅ 脚本执行完毕${NC}"
echo ""
