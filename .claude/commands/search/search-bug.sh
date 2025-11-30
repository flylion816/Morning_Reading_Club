#!/bin/bash
# Memory系统搜索脚本
# 用于快速搜索历史问题和解决方案

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

MEMORY_DIR=".claude/memory"

# 检查Memory系统是否存在
if [ ! -d "$MEMORY_DIR" ]; then
    echo -e "${RED}❌ 错误: Memory系统尚未初始化${NC}"
    echo "请先完成阶段1来创建Memory系统"
    echo ""
    echo "Memory应该在: $MEMORY_DIR"
    exit 1
fi

# 使用指定的关键词或显示交互菜单
KEYWORD="${1:-}"

if [ -z "$KEYWORD" ]; then
    echo -e "${BLUE}════════════════════════════════════════════${NC}"
    echo -e "${BLUE}🔍 Memory 问题搜索工具${NC}"
    echo -e "${BLUE}════════════════════════════════════════════${NC}"
    echo ""

    echo -e "${YELLOW}📚 使用说明:${NC}"
    echo ""
    echo "用法1: 直接搜索关键词"
    echo "  ${GREEN}.claude/commands/search/search-bug.sh 页面空白${NC}"
    echo "  ${GREEN}.claude/commands/search/search-bug.sh 用户ID${NC}"
    echo "  ${GREEN}.claude/commands/search/search-bug.sh API错误${NC}"
    echo ""

    echo "用法2: 按类别查看"
    echo "  ${GREEN}.claude/commands/search/search-bug.sh frontend${NC}  # 前端问题"
    echo "  ${GREEN}.claude/commands/search/search-bug.sh backend${NC}   # 后端问题"
    echo "  ${GREEN}.claude/commands/search/search-bug.sh common${NC}    # 通用问题"
    echo ""

    echo -e "${YELLOW}🔎 快速查询:${NC}"
    echo ""

    # 显示快速查询选项
    echo "输入关键词后按Enter搜索:"
    echo ""
    echo -e "按类别浏览:"
    echo "  1) 前端问题   (.claude/commands/search/search-bug.sh frontend)"
    echo "  2) 后端问题   (.claude/commands/search/search-bug.sh backend)"
    echo "  3) 通用问题   (.claude/commands/search/search-bug.sh common)"
    echo "  4) 架构决策   (.claude/commands/search/search-bug.sh architecture)"
    echo ""

    echo -e "${MAGENTA}热门搜索:${NC}"
    echo "  • 页面空白      • 用户ID         • 数据不显示"
    echo "  • API错误       • 日期问题       • 事件不触发"
    echo "  • 认证问题      • 布局问题       • Console错误"
    echo ""

    echo -e "${YELLOW}💡 提示:${NC}"
    echo "所有问题都记录在 Memory 系统中："
    echo "  快速参考: $MEMORY_DIR/quick-reference.md"
    echo "  完整索引: $MEMORY_DIR/index.json"
    echo ""

    exit 0
fi

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}🔍 搜索 Memory 系统${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}关键词:${NC} ${GREEN}$KEYWORD${NC}"
echo ""

# 检查是否是按类别搜索
case "$KEYWORD" in
    frontend|backend|common|architecture|standards)
        echo -e "${YELLOW}📂 类别搜索:${NC} $KEYWORD"
        echo ""

        # 按类别查找文件
        if [ "$KEYWORD" = "frontend" ]; then
            FILES="$MEMORY_DIR/issues/frontend/"
        elif [ "$KEYWORD" = "backend" ]; then
            FILES="$MEMORY_DIR/issues/backend/"
        elif [ "$KEYWORD" = "common" ]; then
            FILES="$MEMORY_DIR/issues/common/"
        elif [ "$KEYWORD" = "architecture" ]; then
            FILES="$MEMORY_DIR/architecture/"
        elif [ "$KEYWORD" = "standards" ]; then
            FILES="$MEMORY_DIR/standards/"
        fi

        if [ -d "$FILES" ]; then
            echo -e "${GREEN}✓ 找到以下文件:${NC}"
            echo ""
            ls -1 "$FILES"*.md 2>/dev/null | while read file; do
                filename=$(basename "$file")
                linecount=$(wc -l < "$file" 2>/dev/null || echo "0")
                echo -e "  ${GREEN}•${NC} $filename ($linecount 行)"
            done
        else
            echo -e "${YELLOW}⚠ 未找到该类别的文件${NC}"
        fi
        ;;

    *)
        # 关键词搜索
        echo -e "${YELLOW}🔎 在 Memory 系统中搜索...${NC}"
        echo ""

        FOUND=false
        RESULT_COUNT=0

        # 搜索所有 Memory 文件
        if [ -d "$MEMORY_DIR" ]; then
            # 首先尝试精确搜索
            MATCHES=$(grep -r "$KEYWORD" "$MEMORY_DIR" --include="*.md" 2>/dev/null | head -10)

            if [ -n "$MATCHES" ]; then
                FOUND=true
                echo -e "${GREEN}✓ 搜索结果:${NC}"
                echo ""

                echo "$MATCHES" | while IFS= read -r line; do
                    FILE=$(echo "$line" | cut -d: -f1)
                    CONTENT=$(echo "$line" | cut -d: -f2-)

                    # 提取文件类型
                    if [[ $FILE == *"frontend"* ]]; then
                        TYPE="[前端]"
                    elif [[ $FILE == *"backend"* ]]; then
                        TYPE="[后端]"
                    elif [[ $FILE == *"common"* ]]; then
                        TYPE="[通用]"
                    elif [[ $FILE == *"architecture"* ]]; then
                        TYPE="[架构]"
                    else
                        TYPE="[其他]"
                    fi

                    echo -e "${MAGENTA}$TYPE${NC} $(basename $FILE)"
                    echo "   ${YELLOW}→${NC} ${CONTENT:0:80}..."
                    echo ""
                done
            fi

            if [ "$FOUND" = false ]; then
                echo -e "${YELLOW}⚠ 未找到包含 '$KEYWORD' 的问题${NC}"
                echo ""
                echo -e "${YELLOW}💡 建议:${NC}"
                echo "  1. 尝试其他关键词"
                echo "  2. 查看 .claude/memory/quick-reference.md"
                echo "  3. 按类别浏览："
                echo "     $0 frontend"
                echo "     $0 backend"
                echo "     $0 common"
            fi
        else
            echo -e "${RED}❌ 未找到 Memory 目录${NC}"
        fi
        ;;
esac

echo ""
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}📚 快速链接:${NC}"
echo "  • 快速参考: $MEMORY_DIR/quick-reference.md"
echo "  • 完整索引: $MEMORY_DIR/index.json"
echo "  • 问题库: $MEMORY_DIR/issues/"
echo ""

exit 0
