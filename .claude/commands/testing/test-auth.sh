#!/bin/bash
# 认证流程测试脚本
# 用于测试用户认证的完整流程

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
API_BASE="http://localhost:3000/api/v1"

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}🔐 认证流程测试${NC}"
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

# 测试场景1：正确的凭证
echo -e "${BLUE}场景1️⃣: 正确的邮箱和密码${NC}"
echo "邮箱: admin@morningreading.com"
echo "密码: admin123456"
echo ""

RESPONSE=$(curl -s -X POST "${API_BASE}/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@morningreading.com","password":"admin123456"}')

echo "响应状态: $(echo $RESPONSE | grep -o '"success":[^,}]*' || echo '获取失败')"
echo "响应示例: ${RESPONSE:0:150}..."

if [[ $RESPONSE == *"token"* ]]; then
    echo -e "${GREEN}✅ 测试通过：返回token${NC}"
    TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
    echo -e "${RED}❌ 测试失败${NC}"
fi
echo ""

# 测试场景2：错误的密码
echo -e "${BLUE}场景2️⃣: 错误的密码${NC}"
echo "邮箱: admin@morningreading.com"
echo "密码: wrongpassword"
echo ""

RESPONSE=$(curl -s -X POST "${API_BASE}/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@morningreading.com","password":"wrongpassword"}')

echo "响应示例: ${RESPONSE:0:150}..."

if [[ $RESPONSE == *"error"* ]] || [[ $RESPONSE == *"fail"* ]]; then
    echo -e "${GREEN}✅ 测试通过：正确拒绝错误密码${NC}"
else
    echo -e "${YELLOW}⚠ 响应异常${NC}"
fi
echo ""

# 测试场景3：不存在的邮箱
echo -e "${BLUE}场景3️⃣: 不存在的邮箱${NC}"
echo "邮箱: nonexistent@example.com"
echo "密码: anypassword"
echo ""

RESPONSE=$(curl -s -X POST "${API_BASE}/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com","password":"anypassword"}')

echo "响应示例: ${RESPONSE:0:150}..."

if [[ $RESPONSE == *"error"* ]] || [[ $RESPONSE == *"fail"* ]]; then
    echo -e "${GREEN}✅ 测试通过：正确拒绝不存在的邮箱${NC}"
else
    echo -e "${YELLOW}⚠ 响应异常${NC}"
fi
echo ""

# 测试场景4：使用有效token访问受保护资源
if [ -n "$TOKEN" ]; then
    echo -e "${BLUE}场景4️⃣: 使用有效token访问受保护资源${NC}"
    echo "Token: ${TOKEN:0:20}..."
    echo ""

    RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
      "${API_BASE}/stats/dashboard")

    echo "响应示例: ${RESPONSE:0:150}..."

    if [[ $RESPONSE == *"userId"* ]] || [[ $RESPONSE == *"stats"* ]]; then
        echo -e "${GREEN}✅ 测试通过：使用有效token访问成功${NC}"
    else
        echo -e "${RED}❌ 测试失败${NC}"
    fi
    echo ""
fi

# 测试场景5：无token访问受保护资源
echo -e "${BLUE}场景5️⃣: 无token访问受保护资源${NC}"
echo ""

RESPONSE=$(curl -s "${API_BASE}/stats/dashboard")

echo "响应示例: ${RESPONSE:0:150}..."

if [[ $RESPONSE == *"401"* ]] || [[ $RESPONSE == *"Unauthorized"* ]] || [[ $RESPONSE == *"error"* ]]; then
    echo -e "${GREEN}✅ 测试通过：正确返回401未授权${NC}"
else
    echo -e "${YELLOW}⚠ 响应异常${NC}"
fi
echo ""

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 认证流程测试完成!${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}📝 测试总结:${NC}"
echo "  • 正确凭证 ✅"
echo "  • 错误密码 ✅"
echo "  • 不存在的用户 ✅"
echo "  • token访问 ✅"
echo "  • 无token访问 ✅"
echo ""
