#!/bin/bash
# Install Enhanced Git Hooks for Testing
# 安装增强版 Git Hooks

set -e

echo "🔧 安装测试相关的 Git Hooks..."

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 创建 .git/hooks 目录（如不存在）
mkdir -p .git/hooks

# 1. 安装 Pre-commit Hook
echo "📋 安装 Pre-commit Hook..."
if [ -f "scripts/hooks/pre-commit-enhanced" ]; then
  cp scripts/hooks/pre-commit-enhanced .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  echo "✓ Pre-commit Hook 已安装"
else
  echo "⚠ 未找到 scripts/hooks/pre-commit-enhanced，跳过"
fi

# 2. 安装 Pre-push Hook
echo "📋 安装 Pre-push Hook..."
if [ -f "scripts/hooks/pre-push" ]; then
  cp scripts/hooks/pre-push .git/hooks/pre-push
  chmod +x .git/hooks/pre-push
  echo "✓ Pre-push Hook 已安装"
else
  echo "⚠ 未找到 scripts/hooks/pre-push，跳过"
fi

# 3. 备份旧的 hooks（如果存在）
if [ -f ".git/hooks/pre-commit.old" ]; then
  echo "ℹ️  发现旧的 pre-commit hook 备份: .git/hooks/pre-commit.old"
fi

if [ -f ".git/hooks/pre-push.old" ]; then
  echo "ℹ️  发现旧的 pre-push hook 备份: .git/hooks/pre-push.old"
fi

echo ""
echo "========================================="
echo "           安装完成！"
echo "========================================="
echo ""
echo "已安装的 Git Hooks:"
echo "  ✓ Pre-commit: 代码质量检查、单元测试"
echo "  ✓ Pre-push: 完整测试、构建验证"
echo ""
echo "测试 Hooks:"
echo "  1. 尝试提交: git commit -m 'test'"
echo "  2. 查看检查流程"
echo "  3. 如需跳过: git commit --no-verify"
echo ""
echo "卸载 Hooks:"
echo "  rm .git/hooks/pre-commit"
echo "  rm .git/hooks/pre-push"
echo ""
