#!/bin/bash
# Memory 系统更新脚本
# 用于在提交后自动检查并更新 Memory 索引

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MEMORY_DIR=".claude/memory"
INDEX_FILE="$MEMORY_DIR/index.json"

# 检查 Memory 目录是否存在
if [ ! -d "$MEMORY_DIR" ]; then
    echo -e "${YELLOW}⚠ Memory 系统尚未初始化${NC}"
    echo "请先运行阶段1来创建 Memory 系统"
    exit 0
fi

echo -e "${BLUE}🔄 检查 Memory 索引更新...${NC}"

# 获取最后一次提交的改动文件
CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")

# 检查是否修改了问题相关文件
ISSUES_UPDATED=0
if echo "$CHANGED_FILES" | grep -q "\.claude/memory/issues/"; then
    ISSUES_UPDATED=1
fi

ARCHITECTURE_UPDATED=0
if echo "$CHANGED_FILES" | grep -q "\.claude/memory/architecture/"; then
    ARCHITECTURE_UPDATED=1
fi

STANDARDS_UPDATED=0
if echo "$CHANGED_FILES" | grep -q "\.claude/memory/standards/"; then
    STANDARDS_UPDATED=1
fi

if [ $ISSUES_UPDATED -eq 1 ] || [ $ARCHITECTURE_UPDATED -eq 1 ] || [ $STANDARDS_UPDATED -eq 1 ]; then
    echo -e "${GREEN}✓ 检测到 Memory 文件更新${NC}"

    # 列出更新的类别
    if [ $ISSUES_UPDATED -eq 1 ]; then
        echo "  • 问题库已更新"
    fi
    if [ $ARCHITECTURE_UPDATED -eq 1 ]; then
        echo "  • 架构决策已更新"
    fi
    if [ $STANDARDS_UPDATED -eq 1 ]; then
        echo "  • 编码规范已更新"
    fi

    echo ""
    echo -e "${YELLOW}💡 提示:${NC} 如果添加了新问题，请确保:"
    echo "  1. 更新了 $MEMORY_DIR/index.json"
    echo "  2. 更新了 $MEMORY_DIR/quick-reference.md"
    echo "  3. 相关文件包含完整的问题描述和解决方案"
else
    echo -e "${YELLOW}ℹ Memory 系统未更新 (这是正常的)${NC}"
fi

echo ""
echo -e "${GREEN}✅ Memory 索引检查完成${NC}"
