#!/bin/bash
# 部署状态检查脚本
# 用于检查生产环境的部署状态

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 部署状态检查${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}🔍 检查项:${NC}"
echo ""

# 1. Git 状态
echo -e "${BLUE}1️⃣ Git 仓库状态${NC}"
echo "   当前分支: $(git branch --show-current)"
echo "   最后提交: $(git log -1 --pretty=format:'%h - %s')"
echo "   未推送提交: $(git rev-list @{u}.. 2>/dev/null | wc -l || echo '0')"

UNPUSHED=$(git rev-list @{u}.. 2>/dev/null | wc -l || echo "0")
if [ "$UNPUSHED" -gt 0 ]; then
    echo -e "   ${YELLOW}⚠ 有 $UNPUSHED 个未推送的提交${NC}"
else
    echo -e "   ${GREEN}✓ 所有提交已推送${NC}"
fi
echo ""

# 2. 后端服务状态
echo -e "${BLUE}2️⃣ 后端服务状态${NC}"

if command -v lsof &> /dev/null; then
    PORT_STATUS=$(lsof -i :3000 2>/dev/null | grep -c LISTEN || echo "0")
    if [ "$PORT_STATUS" -gt 0 ]; then
        echo -e "   ${GREEN}✓ 后端服务运行中 (Port 3000)${NC}"
    else
        echo -e "   ${YELLOW}⚠ 后端服务未运行${NC}"
    fi
else
    echo "   检查 http://localhost:3000/api/v1/health"
    if curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1; then
        echo -e "   ${GREEN}✓ 后端服务可访问${NC}"
    else
        echo -e "   ${YELLOW}⚠ 后端服务无法访问${NC}"
    fi
fi
echo ""

# 3. MongoDB 状态
echo -e "${BLUE}3️⃣ 数据库连接状态${NC}"

if command -v mongosh &> /dev/null; then
    if mongosh --version > /dev/null 2>&1; then
        echo -e "   ${GREEN}✓ MongoDB 客户端已安装${NC}"
    else
        echo -e "   ${YELLOW}⚠ MongoDB 客户端未安装${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠ 无法检查 MongoDB${NC}"
fi
echo ""

# 4. 文件系统检查
echo -e "${BLUE}4️⃣ 关键文件检查${NC}"

FILES_TO_CHECK=(
    "backend/package.json"
    "miniprogram/app.json"
    ".claude/hooks/pre-commit"
    ".claude/commands"
)

for file in "${FILES_TO_CHECK[@]}"; do
    if [ -e "$file" ]; then
        echo -e "   ${GREEN}✓${NC} $file"
    else
        echo -e "   ${RED}✗${NC} $file (缺失)"
    fi
done
echo ""

# 5. 环境配置
echo -e "${BLUE}5️⃣ 环境配置${NC}"

if [ -f "backend/.env" ]; then
    echo -e "   ${GREEN}✓${NC} backend/.env 存在"
else
    echo -e "   ${YELLOW}⚠${NC} backend/.env 不存在（可能需要配置）"
fi

if [ -f "backend/.env.local" ]; then
    echo -e "   ${GREEN}✓${NC} backend/.env.local 存在"
else
    echo -e "   ${YELLOW}⚠${NC} backend/.env.local 不存在（可能需要配置）"
fi
echo ""

# 6. 部署清单
echo -e "${BLUE}6️⃣ 部署前检查清单${NC}"
echo ""

CHECKLIST=(
    "所有代码已提交到 Git"
    "所有提交已推送到 GitHub"
    "后端依赖已安装 (npm install)"
    "环境变量已配置"
    "数据库连接正常"
    "所有测试通过"
    "Git Hooks 已配置"
)

for item in "${CHECKLIST[@]}"; do
    echo -e "   ${YELLOW}☐${NC} $item"
done
echo ""

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}📝 快速部署命令:${NC}"
echo ""
echo "后端部署:"
echo "  ${GREEN}cd backend && npm install && npm run build${NC}"
echo ""
echo "小程序部署:"
echo "  打开微信开发者工具，点击上传并发布"
echo ""

echo -e "${YELLOW}💡 提示:${NC}"
echo "  • 部署前确保所有更改已提交和推送"
echo "  • 查看 .env 配置是否正确"
echo "  • 验证数据库连接"
echo "  • 备份数据库: .claude/commands/deployment/backup-db.sh"
echo ""

exit 0
