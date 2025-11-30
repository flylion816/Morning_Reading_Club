#!/bin/bash
# Git Hooks 安装脚本
# 用于安装和更新所有 Git hooks

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

HOOKS_DIR=".git/hooks"
CLAUDE_HOOKS_DIR=".claude/hooks"

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}🔧 Git Hooks 安装工具${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

# 检查是否在项目根目录
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ 错误: 未找到 .git 目录${NC}"
    echo "请在项目根目录运行此脚本"
    exit 1
fi

# 直接检查hooks是否存在，不检查.claude/hooks目录

echo "📋 检测到以下 hooks:"
echo ""

HOOK_COUNT=0
for hook_file in "$HOOKS_DIR"/pre-commit "$HOOKS_DIR"/commit-msg "$HOOKS_DIR"/post-commit; do
    hook_name=$(basename "$hook_file")
    if [ -f "$hook_file" ]; then
        if [ -x "$hook_file" ]; then
            echo -e "${GREEN}✓${NC} $hook_name (已安装，可执行)"
            HOOK_COUNT=$((HOOK_COUNT + 1))
        else
            echo -e "${YELLOW}⚠${NC} $hook_name (存在但不可执行)"
        fi
    else
        echo -e "${RED}✗${NC} $hook_name (未安装)"
    fi
done

echo ""
echo "════════════════════════════════════════════"
echo ""

if [ $HOOK_COUNT -eq 3 ]; then
    echo -e "${GREEN}✅ 所有 hooks 已安装!${NC}"
    echo ""
    echo "已安装的 hooks:"
    echo "  1. ${GREEN}pre-commit${NC}   - 提交前代码质量检查"
    echo "  2. ${GREEN}commit-msg${NC}   - 提交信息格式验证"
    echo "  3. ${GREEN}post-commit${NC}  - 提交后自动化操作"
    echo ""
    echo "下次运行 'git commit' 时将自动执行这些 hooks"
    exit 0
else
    echo -e "${YELLOW}⚠ 部分 hooks 需要安装或修复${NC}"
    echo ""
    echo "修复步骤:"
    echo "  1. 检查 .git/hooks 目录下的文件权限"
    echo "  2. 运行: chmod +x .git/hooks/pre-commit"
    echo "  3. 运行: chmod +x .git/hooks/commit-msg"
    echo "  4. 运行: chmod +x .git/hooks/post-commit"
    echo "  5. 重新运行此脚本"
    exit 1
fi
