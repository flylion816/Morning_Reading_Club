#!/bin/bash
# 修复 Mocha 测试中的 Jest 语法问题
# 主要问题: beforeAll/afterAll 在 Mocha 中不存在，应该使用 before/after

set -e

echo "🔧 修复 Backend 集成测试中的 Mocha 语法问题..."

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT/backend"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 查找所有集成测试文件
TEST_FILES=$(find tests/integration -name "*.test.js")

echo -e "${BLUE}找到以下测试文件:${NC}"
echo "$TEST_FILES"
echo ""

FIXED_COUNT=0

for file in $TEST_FILES; do
  echo -e "${YELLOW}检查文件: $file${NC}"

  # 检查是否包含 beforeAll
  if grep -q "beforeAll" "$file"; then
    echo "  发现 beforeAll，替换为 before"

    # 创建备份
    cp "$file" "$file.bak"

    # 替换 beforeAll 为 before
    sed -i '' 's/beforeAll/before/g' "$file"

    # 替换 afterAll 为 after
    sed -i '' 's/afterAll/after/g' "$file"

    # 添加超时配置（如果还没有）
    # 检查是否已有 this.timeout
    if ! grep -q "this\.timeout" "$file"; then
      echo "  添加超时配置"
      # 在 before(() => { 后添加 this.timeout(30000);
      sed -i '' '/before(.*function.*{/a\
    this.timeout(30000);
' "$file"
    fi

    FIXED_COUNT=$((FIXED_COUNT + 1))
    echo -e "${GREEN}  ✓ 已修复${NC}"
  else
    echo "  未发现问题，跳过"
  fi

  echo ""
done

echo ""
echo "========================================="
echo "           修复完成"
echo "========================================="
echo ""
echo -e "${GREEN}共修复 $FIXED_COUNT 个文件${NC}"
echo ""
echo "验证修复:"
echo "  cd backend"
echo "  npm run test:integration"
echo ""
echo "如需恢复备份:"
echo "  find backend/tests/integration -name '*.bak' -exec sh -c 'mv \"\$0\" \"\${0%.bak}\"' {} \;"
echo ""
