#!/bin/bash
# 完整的开发环境启动脚本
# 启动顺序：MongoDB → 后端 → Admin Vue → 显示信息
# 小程序通过微信开发工具启动，不需要脚本启动

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 获取项目根目录 - 向上查找直到找到 backend 目录
PROJECT_ROOT="$(pwd)"
while [ ! -d "$PROJECT_ROOT/backend" ] && [ "$PROJECT_ROOT" != "/" ]; do
    PROJECT_ROOT="$(dirname "$PROJECT_ROOT")"
done

# 如果还没找到，尝试使用脚本目录
if [ ! -d "$PROJECT_ROOT/backend" ] && [ -n "${BASH_SOURCE[0]}" ]; then
    PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)"
fi

cd "$PROJECT_ROOT" 2>/dev/null || exit 1

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🚀 晨读营开发环境启动${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# 检查项目结构
if [ ! -d "backend" ] || [ ! -d "admin" ] || [ ! -d "miniprogram" ]; then
    echo -e "${RED}❌ 错误: 未找到项目目录结构${NC}"
    echo "请在项目根目录运行此脚本"
    exit 1
fi

echo -e "${YELLOW}📋 启动配置：${NC}"
echo "  项目根目录: $PROJECT_ROOT"
echo "  MongoDB: mongodb://localhost:27017"
echo "  后端: http://localhost:3000"
echo "  Admin: http://localhost:5173"
echo ""

# ============================================
# 第1步：清理所有旧进程
# ============================================
echo -e "${YELLOW}🧹 第1步: 清理所有旧进程...${NC}"
pkill -9 -f "npm.*run dev" 2>/dev/null || true
pkill -9 -f "node" 2>/dev/null || true
sleep 1
echo -e "${GREEN}✓ 旧进程已清理${NC}"
echo ""

# ============================================
# 第2步：启动 MongoDB
# ============================================
echo -e "${YELLOW}🐘 第2步: 启动 MongoDB...${NC}"

# 检查 MongoDB 是否已运行
if pgrep -f "mongod" > /dev/null; then
    echo -e "${GREEN}✓ MongoDB 已在运行${NC}"
    MONGO_PID=$(pgrep -f "mongod" | head -1)
else
    # 检查 MongoDB 是否安装
    if ! command -v mongod &> /dev/null; then
        echo -e "${YELLOW}⚠️  MongoDB 未安装或不在 PATH 中${NC}"
        echo -e "${YELLOW}💡 可通过以下方式启动 MongoDB:${NC}"
        echo "   • Docker: docker run -d -p 27017:27017 mongo"
        echo "   • Homebrew: brew services start mongodb-community"
        echo "   • 手动: mongod --config /usr/local/etc/mongod.conf"
        echo ""
        echo -e "${YELLOW}⚠️  继续启动其他服务，但后端可能会连接失败${NC}"
    else
        echo -e "${YELLOW}⏳ 启动 MongoDB...${NC}"
        mongod --fork --logpath /tmp/mongod.log 2>/dev/null || true
        sleep 2
        if pgrep -f "mongod" > /dev/null; then
            echo -e "${GREEN}✓ MongoDB 启动成功${NC}"
        else
            echo -e "${YELLOW}⚠️  MongoDB 启动失败，继续启动其他服务${NC}"
        fi
    fi
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

echo -e "${YELLOW}⏳ 启动后端服务 (PID 将显示在下方)...${NC}"
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ 后端进程ID: $BACKEND_PID${NC}"

# 等待后端启动
sleep 4

# 检查后端是否启动成功
if ps -p $BACKEND_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 后端服务启动成功${NC}"
else
    echo -e "${RED}❌ 后端服务启动失败${NC}"
    echo -e "${YELLOW}📋 查看日志: tail -f /tmp/backend.log${NC}"
fi
echo ""

# ============================================
# 第4步：启动 Admin Vue
# ============================================
echo -e "${YELLOW}🎨 第4步: 启动 Admin Vue...${NC}"
cd "$PROJECT_ROOT/admin" || exit 1

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 安装 Admin 依赖...${NC}"
    npm install --silent > /dev/null 2>&1 || npm install
    echo ""
fi

echo -e "${YELLOW}⏳ 启动 Admin 服务 (PID 将显示在下方)...${NC}"
npm run dev > /tmp/admin.log 2>&1 &
ADMIN_PID=$!
echo -e "${GREEN}✓ Admin 进程ID: $ADMIN_PID${NC}"

# 等待 Admin 启动
sleep 3

# 检查 Admin 是否启动成功
if ps -p $ADMIN_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Admin Vue 启动成功${NC}"
else
    echo -e "${RED}❌ Admin Vue 启动失败${NC}"
    echo -e "${YELLOW}📋 查看日志: tail -f /tmp/admin.log${NC}"
fi
echo ""

# ============================================
# 启动完成 - 显示服务信息
# ============================================
cd "$PROJECT_ROOT" || exit 1

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 所有服务启动完成!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${PURPLE}📊 运行中的服务：${NC}"
echo ""
echo -e "${CYAN}1️⃣  后端服务 (Node.js)${NC}"
echo "   地址: http://localhost:3000"
echo "   API: http://localhost:3000/api/v1"
echo "   PID: $BACKEND_PID"
echo "   日志: tail -f /tmp/backend.log"
echo ""

echo -e "${CYAN}2️⃣  Admin 管理后台 (Vue 3)${NC}"
echo "   地址: http://localhost:5173"
echo "   PID: $ADMIN_PID"
echo "   日志: tail -f /tmp/admin.log"
echo ""

echo -e "${CYAN}3️⃣  小程序${NC}"
echo "   位置: $PROJECT_ROOT/miniprogram"
echo "   启动: 在微信开发工具中导入 miniprogram 目录"
echo "   后端地址: http://localhost:3000/api/v1"
echo ""

echo -e "${CYAN}4️⃣  MongoDB 数据库${NC}"
if pgrep -f "mongod" > /dev/null; then
    echo "   状态: ✓ 已启动"
    echo "   地址: mongodb://localhost:27017"
else
    echo "   状态: ✗ 未启动"
    echo "   启动方法: docker run -d -p 27017:27017 mongo"
fi
echo ""

echo -e "${YELLOW}💡 常用命令：${NC}"
echo "   • 停止所有服务: pkill -9 -f 'npm run dev'; pkill -9 -f 'node'"
echo "   • 查看后端日志: tail -f /tmp/backend.log"
echo "   • 查看 Admin 日志: tail -f /tmp/admin.log"
echo "   • 停止后端: kill $BACKEND_PID"
echo "   • 停止 Admin: kill $ADMIN_PID"
echo "   • 重启所有: Ctrl+C 然后重新运行此脚本"
echo ""

echo -e "${YELLOW}🔗 快速链接：${NC}"
echo "   • 后端 API 文档: http://localhost:3000"
echo "   • Admin 管理后台: http://localhost:5173"
echo "   • 小程序文档: https://developers.weixin.qq.com/miniprogram/dev/framework/"
echo ""

echo -e "${YELLOW}📝 开发指南：${NC}"
echo "   1. 打开微信开发工具，导入 miniprogram 目录"
echo "   2. 访问 http://localhost:5173 打开 Admin 后台"
echo "   3. 后端 API 地址已配置为 http://localhost:3000/api/v1"
echo "   4. 修改代码后，HMR 会自动热更新"
echo ""

# 保持进程运行
wait
