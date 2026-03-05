#!/bin/bash

# 晨读营 E2E UI 自动化测试启动脚本
# 使用方法:
#   ./run_tests.sh admin          # 运行管理后台测试
#   ./run_tests.sh miniprogram    # 运行小程序测试
#   ./run_tests.sh workflow       # 运行完整业务流程测试
#   ./run_tests.sh all            # 运行所有测试

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
TESTS_DIR="$SCRIPT_DIR"

# 环境变量（如果存在 .env.test 则加载）
if [ -f "$PROJECT_ROOT/tests/.env.test" ]; then
    export $(cat "$PROJECT_ROOT/tests/.env.test" | grep -v '^#' | xargs)
fi

# 默认值
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@morningreading.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123456}"
MINIPROGRAM_DEVTOOLS_URL="${MINIPROGRAM_DEVTOOLS_URL:-http://127.0.0.1:9222}"

print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║ 晨读营 E2E UI 自动化测试启动${NC}"
    echo -e "${BLUE}║ $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
}

print_step() {
    echo -e "\n${GREEN}▶${NC} $1"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

check_python() {
    print_step "检查 Python 环境..."
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 未安装"
        exit 1
    fi
    PYTHON_VERSION=$(python3 --version | awk '{print $2}')
    print_success "Python $PYTHON_VERSION 已安装"
}

check_playwright() {
    print_step "检查 Playwright 依赖..."
    if ! python3 -c "import playwright" 2>/dev/null; then
        print_warning "Playwright 未安装，尝试安装..."
        pip install playwright
        python3 -m playwright install chromium
    fi
    print_success "Playwright 已安装"
}

run_admin_test() {
    print_step "运行管理后台 UI 测试..."
    echo "  配置："
    echo "  - URL: https://wx.shubai01.com/admin"
    echo "  - 邮箱: $ADMIN_EMAIL"
    echo ""

    export ADMIN_EMAIL="$ADMIN_EMAIL"
    export ADMIN_PASSWORD="$ADMIN_PASSWORD"

    if python3 "$TESTS_DIR/admin-ui.py"; then
        print_success "管理后台测试完成"
        return 0
    else
        print_error "管理后台测试失败"
        return 1
    fi
}

run_miniprogram_test() {
    print_step "运行小程序 UI 测试..."
    echo "  配置："
    echo "  - 调试工具: $MINIPROGRAM_DEVTOOLS_URL"
    echo ""
    echo "  前置条件："
    echo "  ✓ 微信开发工具已打开"
    echo "  ✓ 小程序已启动 (npm run dev)"
    echo "  ✓ 调试模式已启用"
    echo ""

    export MINIPROGRAM_DEVTOOLS_URL="$MINIPROGRAM_DEVTOOLS_URL"

    if python3 "$TESTS_DIR/miniprogram-ui.py"; then
        print_success "小程序测试完成"
        return 0
    else
        print_error "小程序测试失败"
        return 1
    fi
}

run_workflow_test() {
    print_step "运行端到端业务流程测试..."
    echo "  配置："
    echo "  - 小程序调试工具: $MINIPROGRAM_DEVTOOLS_URL"
    echo "  - 管理后台: https://wx.shubai01.com/admin"
    echo ""

    export ADMIN_EMAIL="$ADMIN_EMAIL"
    export ADMIN_PASSWORD="$ADMIN_PASSWORD"
    export MINIPROGRAM_DEVTOOLS_URL="$MINIPROGRAM_DEVTOOLS_URL"

    if python3 "$TESTS_DIR/e2e-workflow.py"; then
        print_success "端到端业务流程测试完成"
        return 0
    else
        print_error "端到端业务流程测试失败"
        return 1
    fi
}

run_all_tests() {
    local failed=0

    echo ""
    run_admin_test || ((failed++))

    echo ""
    run_miniprogram_test || ((failed++))

    echo ""
    run_workflow_test || ((failed++))

    echo ""
    if [ $failed -eq 0 ]; then
        print_success "所有测试通过！"
        return 0
    else
        print_error "$failed 个测试失败"
        return 1
    fi
}

show_usage() {
    echo "用法:"
    echo "  $0 admin        - 运行管理后台 UI 测试"
    echo "  $0 miniprogram  - 运行小程序 UI 测试"
    echo "  $0 workflow     - 运行完整业务流程测试"
    echo "  $0 all          - 运行所有测试"
    echo "  $0 help         - 显示此帮助信息"
    echo ""
    echo "环境变量："
    echo "  ADMIN_EMAIL              - 管理员邮箱 (默认: $ADMIN_EMAIL)"
    echo "  ADMIN_PASSWORD           - 管理员密码"
    echo "  MINIPROGRAM_DEVTOOLS_URL - 小程序调试工具地址 (默认: $MINIPROGRAM_DEVTOOLS_URL)"
    echo ""
    echo "示例："
    echo "  ADMIN_EMAIL=user@example.com ADMIN_PASSWORD=pass123 $0 admin"
    echo "  MINIPROGRAM_DEVTOOLS_URL=http://127.0.0.1:9223 $0 miniprogram"
}

# 主程序
main() {
    print_header

    check_python
    check_playwright

    case "${1:-help}" in
        admin)
            run_admin_test
            ;;
        miniprogram)
            run_miniprogram_test
            ;;
        workflow)
            run_workflow_test
            ;;
        all)
            run_all_tests
            ;;
        help|"")
            show_usage
            ;;
        *)
            print_error "未知命令: $1"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
