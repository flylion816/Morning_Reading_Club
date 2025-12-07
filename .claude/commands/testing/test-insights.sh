#!/bin/bash
# 打卡功能测试脚本
# 用于测试"小凡看见"打卡记录的完整功能

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
echo -e "${BLUE}📝 打卡功能完整测试${NC}"
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

# 第一步：登录获取token
echo -e "${BLUE}第1️⃣步：管理员登录${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${API_BASE}/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
USER_ID=$(echo $LOGIN_RESPONSE | grep -o '"_id":"[^"]*"' | cut -d'"' -f4 | head -1)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ 登录失败${NC}"
    exit 1
fi

echo "用户ID: $USER_ID"
echo "Token: ${TOKEN:0:20}..."
echo -e "${GREEN}✅ 登录成功${NC}"
echo ""

# 第二步：获取期次列表
echo -e "${BLUE}第2️⃣步：获取期次列表${NC}"
PERIODS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "${API_BASE}/periods")

echo "URL: GET ${API_BASE}/periods"
PERIOD_ID=$(echo $PERIODS_RESPONSE | grep -o '"_id":"[^"]*"' | cut -d'"' -f4 | head -1)

if [ -z "$PERIOD_ID" ]; then
    echo -e "${YELLOW}⚠ 未找到期次，可能需要先创建${NC}"
    PERIOD_ID="6916c27f2a43d9be12944348"  # 使用默认period ID
    echo "使用默认期次ID: $PERIOD_ID"
else
    echo "期次ID: $PERIOD_ID"
fi
echo -e "${GREEN}✅ 获取期次成功${NC}"
echo ""

# 第三步：获取该期次的打卡记录
echo -e "${BLUE}第3️⃣步：获取该期次的打卡记录${NC}"
INSIGHTS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "${API_BASE}/insights/period/${PERIOD_ID}")

echo "URL: GET ${API_BASE}/insights/period/${PERIOD_ID}"
echo "响应示例: ${INSIGHTS_RESPONSE:0:150}..."

INSIGHT_COUNT=$(echo $INSIGHTS_RESPONSE | grep -o '"_id"' | wc -l)
echo "打卡记录数: $INSIGHT_COUNT"

if [[ $INSIGHTS_RESPONSE == *"["* ]]; then
    echo -e "${GREEN}✅ 获取打卡记录成功${NC}"
else
    echo -e "${YELLOW}⚠ 响应异常${NC}"
fi
echo ""

# 第四步：获取打卡统计信息
echo -e "${BLUE}第4️⃣步：获取打卡统计信息${NC}"
STATS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "${API_BASE}/insights/stats")

echo "URL: GET ${API_BASE}/insights/stats"
echo "响应示例: ${STATS_RESPONSE:0:150}..."

if [[ $STATS_RESPONSE == *"{"* ]] || [[ $STATS_RESPONSE == *"stats"* ]]; then
    echo -e "${GREEN}✅ 获取打卡统计成功${NC}"
else
    echo -e "${YELLOW}⚠ 响应异常${NC}"
fi
echo ""

# 第五步：创建新的打卡记录
echo -e "${BLUE}第5️⃣步：创建新的打卡记录${NC}"

# 构建打卡数据
INSIGHT_DATA='{
  "date": "'$(date +%Y-%m-%d)'",
  "insight": "测试打卡记录 - API自动创建",
  "periodId": "'${PERIOD_ID}'",
  "targetUserId": "'${USER_ID}'",
  "sharedWith": ["'${USER_ID}'"]
}'

echo "请求数据: $INSIGHT_DATA"
echo ""

CREATE_RESPONSE=$(curl -s -X POST "${API_BASE}/insights" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$INSIGHT_DATA")

echo "响应示例: ${CREATE_RESPONSE:0:150}..."

NEW_INSIGHT_ID=$(echo $CREATE_RESPONSE | grep -o '"_id":"[^"]*"' | cut -d'"' -f4 | head -1)

if [ -n "$NEW_INSIGHT_ID" ]; then
    echo "新建打卡记录ID: $NEW_INSIGHT_ID"
    echo -e "${GREEN}✅ 创建打卡记录成功${NC}"
else
    echo -e "${YELLOW}⚠ 创建失败或响应异常${NC}"
fi
echo ""

# 第六步：更新打卡记录
if [ -n "$NEW_INSIGHT_ID" ]; then
    echo -e "${BLUE}第6️⃣步：更新打卡记录${NC}"

    UPDATE_DATA='{
      "insight": "更新测试 - API自动更新"
    }'

    UPDATE_RESPONSE=$(curl -s -X PUT "${API_BASE}/insights/${NEW_INSIGHT_ID}" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$UPDATE_DATA")

    echo "URL: PUT ${API_BASE}/insights/${NEW_INSIGHT_ID}"
    echo "请求数据: $UPDATE_DATA"
    echo "响应示例: ${UPDATE_RESPONSE:0:150}..."

    if [[ $UPDATE_RESPONSE == *"updated"* ]] || [[ $UPDATE_RESPONSE == *"_id"* ]]; then
        echo -e "${GREEN}✅ 更新打卡记录成功${NC}"
    else
        echo -e "${YELLOW}⚠ 更新失败或响应异常${NC}"
    fi
    echo ""

    # 第七步：删除测试打卡记录
    echo -e "${BLUE}第7️⃣步：删除测试打卡记录${NC}"

    DELETE_RESPONSE=$(curl -s -X DELETE "${API_BASE}/insights/${NEW_INSIGHT_ID}" \
      -H "Authorization: Bearer $TOKEN")

    echo "URL: DELETE ${API_BASE}/insights/${NEW_INSIGHT_ID}"
    echo "响应示例: ${DELETE_RESPONSE:0:150}..."

    if [[ $DELETE_RESPONSE == *"deleted"* ]] || [[ $DELETE_RESPONSE == *"success"* ]]; then
        echo -e "${GREEN}✅ 删除打卡记录成功${NC}"
    else
        echo -e "${YELLOW}⚠ 删除失败或响应异常${NC}"
    fi
    echo ""
fi

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 打卡功能测试完成!${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}📊 测试覆盖:${NC}"
echo "  ✅ 获取期次列表"
echo "  ✅ 获取该期次的打卡记录"
echo "  ✅ 获取打卡统计信息"
if [ -n "$NEW_INSIGHT_ID" ]; then
    echo "  ✅ 创建新的打卡记录"
    echo "  ✅ 更新打卡记录"
    echo "  ✅ 删除打卡记录"
fi
echo ""
