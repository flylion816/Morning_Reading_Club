#!/bin/bash

# ========================================
# 晨读营 - 本地完整环境启动脚本
# ========================================
# 使用此脚本启动所有本地服务（包含数据库和应用）

set -e

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║     晨读营 - 本地开发环境启动                      ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 清理旧进程
echo "🧹 清理旧的后台进程..."
pkill -f "npm run dev" || true
pkill -f "node.*src/server" || true
sleep 1

# 启动 Docker 容器（数据库）
echo ""
echo "🗄️  启动数据库服务..."
cd "$SCRIPT_DIR/backend"
docker-compose --env-file .env.docker up -d --remove-orphans

# 等待数据库启动
echo "⏳ 等待数据库启动..."
sleep 5

# 检查数据库连接
echo ""
echo "✅ 检查服务健康状态..."

# 检查 MongoDB
if docker exec morning-reading-mongodb mongosh --eval "db.adminCommand('ping')" &>/dev/null; then
    echo "  ✓ MongoDB 连接成功 (localhost:27017)"
else
    echo "  ✗ MongoDB 连接失败"
    exit 1
fi

# 检查 MySQL
if docker exec morning-reading-mysql mysqladmin ping -h localhost &>/dev/null; then
    echo "  ✓ MySQL 连接成功 (localhost:3306)"
else
    echo "  ✗ MySQL 连接失败"
    exit 1
fi

# 检查 Redis
if docker exec morning-reading-redis redis-cli -a Redis@Local123! ping &>/dev/null; then
    echo "  ✓ Redis 连接成功 (localhost:6379)"
else
    echo "  ✗ Redis 连接失败"
    exit 1
fi

# 启动后端应用
echo ""
echo "🚀 启动后端应用..."
cd "$SCRIPT_DIR/backend"
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "  后端启动中 (PID: $BACKEND_PID)..."

# 启动管理后台
echo ""
echo "🎨 启动管理后台..."
cd "$SCRIPT_DIR/admin"
npm run dev > /tmp/admin.log 2>&1 &
ADMIN_PID=$!
echo "  管理后台启动中 (PID: $ADMIN_PID)..."

# 等待应用启动
sleep 3

# 检查应用是否启动成功
echo ""
echo "✅ 所有服务已启动！"
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║              📌 服务访问地址                       ║"
echo "╠════════════════════════════════════════════════════╣"
echo "║  后端 API:        http://localhost:3000            ║"
echo "║  健康检查:        http://localhost:3000/api/v1/health"
echo "║  管理后台:        http://localhost:5173            ║"
echo "║                                                    ║"
echo "║              📊 数据库连接信息                     ║"
echo "╠════════════════════════════════════════════════════╣"
echo "║  MongoDB:  localhost:27017                         ║"
echo "║    用户: admin                                     ║"
echo "║    密码: Mongodb@Local123!                         ║"
echo "║                                                    ║"
echo "║  MySQL:    localhost:3306                          ║"
echo "║    用户: morning_user                              ║"
echo "║    密码: Morning@User123!                          ║"
echo "║    Root:  Root@Local123!                           ║"
echo "║                                                    ║"
echo "║  Redis:    localhost:6379                          ║"
echo "║    密码: Redis@Local123!                           ║"
echo "║                                                    ║"
echo "║              📝 查看日志                           ║"
echo "╠════════════════════════════════════════════════════╣"
echo "║  tail -f /tmp/backend.log                          ║"
echo "║  tail -f /tmp/admin.log                            ║"
echo "║                                                    ║"
echo "║              🛑 停止服务                           ║"
echo "╠════════════════════════════════════════════════════╣"
echo "║  docker-compose -f backend/docker-compose.yml down║"
echo "║  pkill -f 'npm run dev'                            ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# 等待用户中断
wait $BACKEND_PID $ADMIN_PID 2>/dev/null || true

echo ""
echo "👋 应用已停止"
