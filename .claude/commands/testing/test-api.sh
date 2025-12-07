#!/bin/bash
# API 快速测试脚本
# 用于快速测试所有主要 API 端点

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
API_BASE="http://localhost:3000/api/v1"
ADMIN_EMAIL="admin@morningreading.com"
ADMIN_PASSWORD="admin123456"

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}🧪 API 快速测试${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

# 检查后端是否运行
echo -e "${YELLOW}📍 检查后端服务...${NC}"
if ! curl -s "${API_BASE}/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ 后端服务未启动${NC}"
    echo "请先运行: .claude/commands/development/start-backend.sh"
    exit 1
fi
echo -e "${GREEN}✓ 后端服务正常${NC}"
echo ""

# 1. 测试健康检查
echo -e "${BLUE}1️⃣ 健康检查${NC}"
HEALTH=$(curl -s "${API_BASE}/health")
echo "URL: GET ${API_BASE}/health"
echo "响应: $HEALTH"
if [[ $HEALTH == *"ok"* ]]; then
    echo -e "${GREEN}✅ 健康检查通过${NC}"
else
    echo -e "${YELLOW}⚠ 响应异常${NC}"
fi
echo ""

# 2. 管理员登录
echo -e "${BLUE}2️⃣ 管理员登录${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE}/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")

echo "URL: POST ${API_BASE}/auth/admin/login"
echo "请求体: {\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}"
echo "响应: $LOGIN_RESPONSE"

# 提取token
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
USER_ID=$(echo $LOGIN_RESPONSE | grep -o '"_id":"[^"]*"' | cut -d'"' -f4 | head -1)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ 登录失败，无法获取 token${NC}"
    exit 1
fi

echo "TOKEN: ${TOKEN:0:20}..."
echo "USER_ID: $USER_ID"
echo -e "${GREEN}✅ 登录成功${NC}"
echo ""

# 3. 获取仪表板数据
echo -e "${BLUE}3️⃣ 获取仪表板数据${NC}"
DASHBOARD=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "${API_BASE}/stats/dashboard")

echo "URL: GET ${API_BASE}/stats/dashboard"
echo "Header: Authorization: Bearer ${TOKEN:0:20}..."
echo "响应: ${DASHBOARD:0:100}..."

if [[ $DASHBOARD == *"userId"* ]] || [[ $DASHBOARD == *"stats"* ]]; then
    echo -e "${GREEN}✅ 仪表板数据获取成功${NC}"
else
    echo -e "${YELLOW}⚠ 响应异常${NC}"
fi
echo ""

# 4. 获取期次列表
echo -e "${BLUE}4️⃣ 获取期次列表${NC}"
PERIODS=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "${API_BASE}/periods")

echo "URL: GET ${API_BASE}/periods"
echo "响应: ${PERIODS:0:100}..."

if [[ $PERIODS == *"["* ]]; then
    echo -e "${GREEN}✅ 期次列表获取成功${NC}"
else
    echo -e "${YELLOW}⚠ 响应异常${NC}"
fi
echo ""

# 5. 获取用户信息
echo -e "${BLUE}5️⃣ 获取当前用户信息${NC}"
USER_INFO=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "${API_BASE}/auth/user")

echo "URL: GET ${API_BASE}/auth/user"
echo "响应: ${USER_INFO:0:100}..."

if [[ $USER_INFO == *"email"* ]]; then
    echo -e "${GREEN}✅ 用户信息获取成功${NC}"
else
    echo -e "${YELLOW}⚠ 响应异常${NC}"
fi
echo ""

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ API 快速测试完成!${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}💡 提示:${NC}"
echo "  • TOKEN 已保存为: \$TOKEN"
echo "  • 可用于后续的手动测试"
echo "  • 例如: curl -H \"Authorization: Bearer \$TOKEN\" $API_BASE/other-endpoint"
echo ""
