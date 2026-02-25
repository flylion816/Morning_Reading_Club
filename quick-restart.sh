#!/bin/bash

# 🔥 快速重启脚本 - 解决服务频繁断掉问题

echo "🧹 清理所有孤立进程..."
pkill -9 -f "npm run dev" 2>/dev/null
pkill -9 -f "nodemon" 2>/dev/null
pkill -9 -f "node src/server" 2>/dev/null
sleep 2

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "🚀 启动后端服务..."
cd backend && npm run dev > /tmp/backend.log 2>&1 &
sleep 4

echo "🎨 启动前端服务..."
cd ../admin && npm run dev > /tmp/admin.log 2>&1 &
sleep 4

echo ""
echo "✅ 服务已启动："
echo "   📱 后端 API: http://localhost:3000"
echo "   🎨 管理后台: http://localhost:5173"
echo ""
echo "💡 如需停止服务，运行："
echo "   pkill -f 'npm run dev'"
