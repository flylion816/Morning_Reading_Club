#!/bin/bash

# 本地微信一键登录功能测试脚本
# 用于在开发环境中测试 Mock 登录流程

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "🧪 晨读营 - 本地微信登录测试"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ROOT="/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营"

# ============================================================================
# 第一阶段：环境检查
# ============================================================================
echo -e "${BLUE}📋 第一阶段：环境检查${NC}"
echo "─────────────────────────────────────────────────────────────────"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js 已安装: $(node -v)${NC}"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm 未安装${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm 已安装: $(npm -v)${NC}"

# 检查后端目录
if [ ! -d "$PROJECT_ROOT/backend" ]; then
    echo -e "${RED}❌ 后端目录不存在${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 后端目录存在${NC}"

# 检查小程序目录
if [ ! -d "$PROJECT_ROOT/miniprogram" ]; then
    echo -e "${RED}❌ 小程序目录不存在${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 小程序目录存在${NC}"

echo ""

# ============================================================================
# 第二阶段：配置检查
# ============================================================================
echo -e "${BLUE}⚙️  第二阶段：配置检查${NC}"
echo "─────────────────────────────────────────────────────────────────"

# 检查小程序环境
ENV_JS="$PROJECT_ROOT/miniprogram/config/env.js"
CURRENT_ENV=$(grep "^const currentEnv" "$ENV_JS" | grep -o "'[^']*'" | tr -d "'")

if [ "$CURRENT_ENV" != "dev" ]; then
    echo -e "${YELLOW}⚠️  小程序环境为: $CURRENT_ENV (应该为 'dev')${NC}"
    echo "   建议修改 miniprogram/config/env.js 中的 currentEnv = 'dev'"
else
    echo -e "${GREEN}✅ 小程序环境: dev${NC}"
fi

# 检查后端环境
BACKEND_ENV="$PROJECT_ROOT/backend/.env"
if grep -q "NODE_ENV=development" "$BACKEND_ENV"; then
    echo -e "${GREEN}✅ 后端环境: development${NC}"
elif grep -q "NODE_ENV=test" "$BACKEND_ENV"; then
    echo -e "${YELLOW}⚠️  后端环境: test (也可以使用)${NC}"
else
    echo -e "${RED}❌ 后端环境配置可能有问题${NC}"
fi

# 检查小程序 APPID
APPID=$(grep -A 5 "dev:" "$ENV_JS" | grep "wxAppId" | grep -o "'[^']*'" | head -1 | tr -d "'")
echo -e "${GREEN}✅ 小程序开发 APPID: $APPID${NC}"

echo ""

# ============================================================================
# 第三阶段：依赖检查
# ============================================================================
echo -e "${BLUE}📦 第三阶段：依赖检查${NC}"
echo "─────────────────────────────────────────────────────────────────"

cd "$PROJECT_ROOT/backend"

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  后端依赖未安装，正在安装...${NC}"
    npm install
    echo -e "${GREEN}✅ 后端依赖安装完成${NC}"
else
    echo -e "${GREEN}✅ 后端依赖已安装${NC}"
fi

echo ""

# ============================================================================
# 第四阶段：数据库连接检查
# ============================================================================
echo -e "${BLUE}🗄️  第四阶段：数据库连接检查${NC}"
echo "─────────────────────────────────────────────────────────────────"

# 检查 MongoDB 连接配置
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✅ 使用本地 MongoDB 配置 (.env.local)${NC}"
    MONGO_URI=$(grep "MONGODB_URI" .env.local | cut -d'=' -f2)
    echo "   MongoDB URI: $MONGO_URI"
elif grep -q "MONGODB_URI" ".env"; then
    echo -e "${GREEN}✅ 使用开发 MongoDB 配置 (.env)${NC}"
    MONGO_URI=$(grep "MONGODB_URI" .env | cut -d'=' -f2)
    echo "   MongoDB URI: $MONGO_URI"
fi

echo ""

# ============================================================================
# 第五阶段：后端启动检查
# ============================================================================
echo -e "${BLUE}🚀 第五阶段：后端服务检查${NC}"
echo "─────────────────────────────────────────────────────────────────"

# 检查端口是否被占用
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 端口 3000 已被占用（后端可能已在运行）${NC}"
else
    echo -e "${YELLOW}⚠️  端口 3000 未被占用${NC}"
    echo "   需要启动后端服务："
    echo "   ${BLUE}cd backend && npm run dev${NC}"
fi

echo ""

# ============================================================================
# 第六阶段：微信登录 API 测试
# ============================================================================
echo -e "${BLUE}🔐 第六阶段：微信登录 API 测试${NC}"
echo "─────────────────────────────────────────────────────────────────"

# 检查后端是否可访问
echo "正在检查后端服务可访问性..."
if curl -s -m 5 "http://localhost:3000/api/v1/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 后端服务正常运行${NC}"

    # 测试 Mock 登录
    echo ""
    echo "正在测试 Mock 登录 API..."

    # 生成 mock code
    MOCK_CODE="mock_code_$(date +%s)"

    echo "发送请求："
    echo "  POST http://localhost:3000/api/v1/auth/wechat/login"
    echo "  Body: { code: '$MOCK_CODE', nickname: '测试用户' }"
    echo ""

    RESPONSE=$(curl -s -X POST "http://localhost:3000/api/v1/auth/wechat/login" \
      -H "Content-Type: application/json" \
      -d "{\"code\":\"$MOCK_CODE\",\"nickname\":\"测试用户\"}")

    if echo "$RESPONSE" | grep -q "accessToken"; then
        echo -e "${GREEN}✅ 登录 API 返回成功${NC}"
        echo "响应示例："
        echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    else
        echo -e "${RED}❌ 登录 API 返回异常${NC}"
        echo "响应内容："
        echo "$RESPONSE"
    fi
else
    echo -e "${YELLOW}⚠️  后端服务未运行${NC}"
    echo "   请先启动后端："
    echo "   ${BLUE}cd backend && npm run dev${NC}"
fi

echo ""

# ============================================================================
# 第七阶段：测试指南
# ============================================================================
echo -e "${BLUE}📖 第七阶段：本地测试指南${NC}"
echo "─────────────────────────────────────────────────────────────────"

cat << 'EOF'

🎯 本地 Mock 登录测试步骤：

1. 启动后端服务（如果未启动）：
   $ cd backend && npm run dev
   等待出现：✅ Server running on http://localhost:3000

2. 打开微信开发工具：
   - 文件 → 打开项目
   - 选择 miniprogram 目录
   - AppID: wx199d6d332344ed0a（开发环境）

3. 在模拟器中测试登录：

   方式A - 点击"微信一键登录"按钮：
   - 点击绿色"微信一键登录"按钮
   - 弹出授权对话框（开发工具模拟）
   - 点击"允许"
   - 等待 2-3 秒
   - ✅ 应该进入首页

   方式B - 快速测试账户登录（开发环境特有）：
   - 在登录页面找到"🔧 开发环境 - 快速登录"
   - 点击任意测试账户按钮（阿泰、狮子、王五、管理员）
   - 等待 1-2 秒
   - ✅ 应该进入首页，昵称为对应的测试用户

4. 检查实现细节：

   查看 Console 日志：
   - "===== course-card onCardTap 被调用 =====" (组件事件)
   - "✅ 登录成功" (登录完成)
   - "用户信息获取成功" (用户信息)

   查看 Network 标签：
   - POST /api/v1/auth/wechat/login
   - 返回状态：200
   - 响应包含：accessToken, refreshToken, user

   查看 Storage：
   - 应该包含：token, refreshToken, userInfo

5. 测试失败排查：

   错误："获取用户信息失败"
   - 可能是微信开发工具版本问题
   - 尝试更新微信开发工具

   错误："登录失败，请稍后重试"
   - 检查后端是否正常运行
   - 查看后端日志是否有错误

   错误："找不到期次信息" 或"暂无数据"
   - 这是正常的，说明数据库没有初始化数据
   - 参考本地开发文档初始化数据库

6. Mock 登录的特点：

   ✅ 优势：
   - 无需真实微信账号
   - 无需真实微信小程序发布
   - 快速迭代测试
   - 支持测试账户切换

   ⚠️ 限制：
   - 获取的用户头像是 mock 数据
   - 获取的用户昵称是自定义的
   - 不能测试真实微信验证流程

EOF

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ 测试准备完成！${NC}"
echo "═══════════════════════════════════════════════════════════════"
