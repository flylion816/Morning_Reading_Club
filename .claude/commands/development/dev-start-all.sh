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

# 第一轮：标准杀死
pkill -9 -f "npm.*run dev" 2>/dev/null || true
pkill -9 -f "node" 2>/dev/null || true
sleep 1

# 第二轮：检查是否有顽固进程，如果有则用更激进的方式
REMAINING_PROCS=$(ps aux | grep -E "(node|npm)" | grep -v grep | wc -l)
if [ "$REMAINING_PROCS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  检测到 $REMAINING_PROCS 个顽固进程，进行强制清理...${NC}"
    ps aux | grep -E "(node|npm)" | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true
    sleep 1
fi

# 第三轮：清理占用的端口
echo -e "${YELLOW}🔌 检查占用的端口...${NC}"
for PORT in 3000 5173 27017; do
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  端口 $PORT 被占用，强制释放...${NC}"
        lsof -ti :$PORT | xargs -r kill -9 2>/dev/null || true
        sleep 1
    fi
done

# 最终验证
REMAINING=$(ps aux | grep -E "(node|npm)" | grep -v grep | wc -l)
if [ "$REMAINING" -eq 0 ]; then
    echo -e "${GREEN}✓ 所有进程已清理 (0个遗留进程)${NC}"
else
    echo -e "${YELLOW}⚠️  仍有 $REMAINING 个进程未清理（可能是系统进程，继续执行）${NC}"
fi
echo ""

# ============================================
# 第2步：启动 MongoDB
# ============================================
echo -e "${YELLOW}🐘 第2步: 启动 MongoDB...${NC}"

# 检查 MongoDB 是否已运行
if pgrep -f "mongod" > /dev/null; then
    echo -e "${GREEN}✓ MongoDB 已在运行${NC}"
    MONGO_PID=$(pgrep -f "mongod" | head -1)
    MONGO_HEALTHY=1
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
        MONGO_HEALTHY=0
    else
        # 清理 MongoDB 锁文件（防止上次未正确关闭导致启动失败）
        MONGO_DATA_DIR="${MONGO_DATA_DIR:-/opt/homebrew/var/mongodb}"
        if [ -f "$MONGO_DATA_DIR/mongod.lock" ]; then
            echo -e "${YELLOW}🧹 清理 MongoDB 锁文件...${NC}"
            rm -f "$MONGO_DATA_DIR/mongod.lock"
        fi

        echo -e "${YELLOW}⏳ 启动 MongoDB...${NC}"
        # 使用后台启动而不是 --fork（macOS 不支持 --fork）
        mongod --dbpath "$MONGO_DATA_DIR" > /tmp/mongod.log 2>&1 &
        MONGO_PID=$!
        sleep 2

        # 检查 MongoDB 是否成功启动并可连接
        MONGO_HEALTHY=0
        for i in {1..30}; do
            if ! ps -p $MONGO_PID > /dev/null 2>&1; then
                echo -e "${RED}❌ MongoDB 进程已崩溃 (尝试 $i/30)${NC}"
                sleep 1
                continue
            fi

            # 尝试连接 MongoDB
            if nc -z localhost 27017 > /dev/null 2>&1; then
                MONGO_HEALTHY=1
                echo -e "${GREEN}✓ MongoDB 启动成功 (PID: $MONGO_PID, 第 $i 次尝试)${NC}"
                break
            fi

            if [ $((i % 5)) -eq 0 ]; then
                echo -e "${YELLOW}⏳ 等待 MongoDB 就绪... ($i/30)${NC}"
            fi
            sleep 1
        done

        if [ $MONGO_HEALTHY -eq 0 ]; then
            echo -e "${YELLOW}⚠️  MongoDB 启动失败或无法连接，继续启动其他服务${NC}"
            echo -e "${YELLOW}📋 错误日志 (最后10行):${NC}"
            tail -n 10 /tmp/mongod.log | sed 's/^/    /'
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

if [ $BACKEND_HEALTHY -eq 1 ]; then
    echo -e "${GREEN}✓ 后端服务启动成功 (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}❌ 后端服务启动失败或无法访问${NC}"
    echo -e "${YELLOW}📋 错误日志 (最后10行):${NC}"
    tail -n 10 /tmp/backend.log | sed 's/^/    /'
    echo -e "${YELLOW}📋 查看完整日志: tail -f /tmp/backend.log${NC}"
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

if [ $ADMIN_HEALTHY -eq 1 ]; then
    echo -e "${GREEN}✓ Admin Vue 启动成功 (PID: $ADMIN_PID)${NC}"
else
    echo -e "${RED}❌ Admin Vue 启动失败或无法访问${NC}"
    echo -e "${YELLOW}📋 错误日志 (最后10行):${NC}"
    tail -n 10 /tmp/admin.log | sed 's/^/    /'
    echo -e "${YELLOW}📋 查看完整日志: tail -f /tmp/admin.log${NC}"
fi
echo ""

# ============================================
# 启动完成 - 显示服务信息与状态汇总
# ============================================
cd "$PROJECT_ROOT" || exit 1

echo ""

# 计算启动状态
OVERALL_STATUS="✅"
if [ $BACKEND_HEALTHY -ne 1 ] || [ $ADMIN_HEALTHY -ne 1 ]; then
    OVERALL_STATUS="⚠️"
fi

if [ $BACKEND_HEALTHY -eq 1 ] && [ $ADMIN_HEALTHY -eq 1 ]; then
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ 所有服务启动完成!${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
else
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}⚠️  启动完成，但部分服务可能未就绪${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
fi

echo ""
echo -e "${PURPLE}📊 服务状态汇总：${NC}"
echo -n "   后端服务: "
if [ $BACKEND_HEALTHY -eq 1 ]; then
    echo -e "${GREEN}✓ 正常${NC}"
else
    echo -e "${RED}✗ 异常${NC}"
fi
echo -n "   Admin Vue: "
if [ $ADMIN_HEALTHY -eq 1 ]; then
    echo -e "${GREEN}✓ 正常${NC}"
else
    echo -e "${RED}✗ 异常${NC}"
fi
echo -n "   MongoDB:   "
if pgrep -f "mongod" > /dev/null; then
    echo -e "${GREEN}✓ 正常${NC}"
else
    echo -e "${YELLOW}⚠ 未运行${NC}"
fi
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

echo -e "${YELLOW}✅ 脚本执行完毕，所有服务已启动（后台运行）${NC}"
echo ""
