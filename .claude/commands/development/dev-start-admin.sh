#!/bin/bash
# 单独启动 Admin Vue 前端脚本
# 启动顺序：清理进程 → Admin Vue 启动

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
while [ ! -d "$PROJECT_ROOT/admin" ] && [ "$PROJECT_ROOT" != "/" ]; do
    PROJECT_ROOT="$(dirname "$PROJECT_ROOT")"
done

if [ ! -d "$PROJECT_ROOT/admin" ] && [ -n "${BASH_SOURCE[0]}" ]; then
    PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)"
fi

cd "$PROJECT_ROOT" 2>/dev/null || exit 1

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🎨 晨读营 Admin Vue 启动${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# 检查项目结构
if [ ! -d "admin" ]; then
    echo -e "${RED}❌ 错误: 未找到 admin 目录${NC}"
    echo "请在项目根目录运行此脚本"
    exit 1
fi

echo -e "${YELLOW}📋 启动配置：${NC}"
echo "  项目根目录: $PROJECT_ROOT"
echo "  Admin: http://localhost:5173"
echo "  后端 API: http://localhost:3000/api/v1"
echo ""

# ============================================
# 第1步：清理旧进程（可选）
# ============================================
echo -e "${YELLOW}🧹 第1步: 清理旧进程...${NC}"

# 只杀死本地启动的 admin 进程
pkill -9 -f "admin.*npm.*run dev" 2>/dev/null || true
pkill -9 -f "cd.*admin" 2>/dev/null || true
sleep 1

# 检查端口 5173 是否被占用
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  端口 5173 被占用，强制释放...${NC}"
    lsof -ti :5173 | xargs -r kill -9 2>/dev/null || true
    sleep 1
fi

echo -e "${GREEN}✓ 进程清理完成${NC}"
echo ""

# ============================================
# 第2步：启动 Admin Vue
# ============================================
echo -e "${YELLOW}🎨 第2步: 启动 Admin Vue...${NC}"
cd "$PROJECT_ROOT/admin" || exit 1

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 安装 Admin 依赖...${NC}"
    npm install --silent > /dev/null 2>&1 || npm install
    echo ""
fi

echo -e "${YELLOW}⏳ 启动 Admin 服务...${NC}"
npm run dev > /tmp/admin.log 2>&1 &
ADMIN_PID=$!
echo -e "${GREEN}✓ Admin 进程ID: $ADMIN_PID${NC}"

# 等待 Admin 启动并检查健康状态
ADMIN_HEALTHY=0
for i in {1..30}; do
    if ! ps -p $ADMIN_PID > /dev/null 2>&1; then
        echo -e "${RED}❌ Admin 进程已崩溃 (尝试 $i/30)${NC}"
        sleep 1
        continue
    fi

    # 尝试连接到 Admin 服务
    if curl -s http://localhost:5173 > /dev/null 2>&1 || \
       nc -z localhost 5173 > /dev/null 2>&1; then
        ADMIN_HEALTHY=1
        echo -e "${GREEN}✓ Admin 服务健康检查通过 (第 $i 次尝试)${NC}"
        break
    fi

    if [ $((i % 5)) -eq 0 ]; then
        echo -e "${YELLOW}⏳ 等待 Admin 编译就绪... ($i/30)${NC}"
    fi
    sleep 1
done

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"

if [ $ADMIN_HEALTHY -eq 1 ]; then
    echo -e "${GREEN}✅ Admin Vue 启动成功!${NC}"
else
    echo -e "${RED}❌ Admin Vue 启动失败或无法访问${NC}"
    echo -e "${YELLOW}📋 错误日志 (最后10行):${NC}"
    tail -n 10 /tmp/admin.log | sed 's/^/    /'
fi

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${PURPLE}📊 服务信息：${NC}"
echo -e "${CYAN}Admin 管理后台 (Vue 3)${NC}"
echo "  地址: http://localhost:5173"
echo "  PID: $ADMIN_PID"
echo "  日志: tail -f /tmp/admin.log"
echo ""

echo -e "${YELLOW}💡 常用命令：${NC}"
echo "  • 查看实时日志: tail -f /tmp/admin.log"
echo "  • 停止 Admin: kill $ADMIN_PID"
echo "  • 重启 Admin: pkill -9 -f 'admin.*npm run dev' && bash $0"
echo "  • 清理依赖: rm -rf node_modules package-lock.json && npm install"
echo ""

echo -e "${YELLOW}✅ 脚本执行完毕${NC}"
echo ""
