#!/bin/bash
# ========================================
# 重置管理员密码脚本
# ========================================
# 用途：删除旧管理员，用新密码重新初始化
# 执行位置：服务器上

set -e

echo "📝 重置管理员密码..."
echo ""

# 杀死后端进程
echo "1️⃣ 停止后端服务..."
sudo pkill -f "node.*src/server" || true
sleep 2
echo "✓ 后端已停止"
echo ""

# 重启后端，应用新的 .env.production
echo "2️⃣ 启动后端服务（应用新的环境变量）..."
cd /var/www/morning-reading/backend
NODE_ENV=production npm start > /tmp/backend-reset.log 2>&1 &
echo "✓ 后端已启动"
echo ""

# 等待后端启动
echo "3️⃣ 等待后端启动完成..."
sleep 10

# 检查后端是否启动成功
if curl -s http://localhost:3000/api/v1/health | grep -q '"status":"ok"'; then
    echo "✓ 后端已就绪"
else
    echo "❌ 后端启动失败，查看日志："
    tail -20 /tmp/backend-reset.log
    exit 1
fi
echo ""

# 删除旧管理员（通过 MongoDB）
echo "4️⃣ 删除旧管理员账户..."
docker exec morning-reading-mongodb-prod mongosh --quiet \
  --authenticationDatabase admin \
  -u admin -p ProdMongodbSecure123 \
  morning_reading << 'MONGO'
db.admins.deleteMany({});
console.log("✓ 旧管理员已删除");
MONGO
echo ""

# 调用初始化 API
echo "5️⃣ 初始化新管理员（使用新密码）..."
curl -s -X POST http://localhost:3000/api/v1/auth/admin/init \
  -H "Content-Type: application/json" | jq '.'
echo ""

echo "✅ 管理员密码重置完成！"
echo ""
echo "新登录凭证："
echo "  📧 邮箱：admin@morningreading.com"
echo "  🔑 密码：Km7\$Px2Qw9"
echo "  🔐 二次验证：Jb3#Rl8Tn5"
