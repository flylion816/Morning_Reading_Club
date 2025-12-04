#!/bin/bash

#############################################################################
#
# PM2 启动脚本
#
# 用于在生产环境中启动和管理 Node.js 应用
#
# 用法：
#   bash scripts/start-pm2.sh [options]
#
# 选项：
#   --env production       启动生产环境 (默认)
#   --env staging          启动测试环境
#   --no-init              跳过初始化
#   --force-restart        强制重启所有进程
#   --setup                设置开机自启（需要 root）
#   --help                 显示帮助信息
#
# 示例：
#   bash scripts/start-pm2.sh                    # 启动生产环境
#   bash scripts/start-pm2.sh --env staging      # 启动测试环境
#   bash scripts/start-pm2.sh --no-init          # 跳过初始化直接启动
#   bash scripts/start-pm2.sh --force-restart    # 强制重启
#   bash scripts/start-pm2.sh --setup            # 设置开机自启
#
#############################################################################

set -e  # 任何错误立即退出

# ============================================================================
# 配置
# ============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
BACKEND_DIR="$PROJECT_ROOT"

ENV=${ENV:-production}
INIT=${INIT:-true}
FORCE_RESTART=${FORCE_RESTART:-false}
SETUP=${SETUP:-false}

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ============================================================================
# 函数定义
# ============================================================================

log() {
    echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

help() {
    cat << EOF
${CYAN}${BOLD}PM2 启动脚本${NC}

用途：在生产环境中启动和管理 Node.js 应用

用法：
  bash scripts/start-pm2.sh [options]

选项：
  --env production       启动生产环境 (默认)
  --env staging          启动测试环境
  --no-init              跳过初始化
  --force-restart        强制重启所有进程
  --setup                设置开机自启（需要 root）
  --help                 显示此帮助信息

示例：
  bash scripts/start-pm2.sh                    # 启动生产环境
  bash scripts/start-pm2.sh --env staging      # 启动测试环境
  bash scripts/start-pm2.sh --no-init          # 跳过初始化直接启动
  bash scripts/start-pm2.sh --force-restart    # 强制重启
  bash scripts/start-pm2.sh --setup            # 设置开机自启

常用 PM2 命令：
  pm2 start pm2.config.js                      # 启动应用
  pm2 stop morning-reading-backend             # 停止应用
  pm2 restart morning-reading-backend          # 重启应用
  pm2 logs morning-reading-backend             # 查看日志
  pm2 status                                    # 查看应用状态
  pm2 delete morning-reading-backend           # 删除应用
  pm2 save                                      # 保存应用列表
  pm2 startup                                   # 配置开机自启

EOF
}

check_dependencies() {
    log "检查依赖..."

    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js 未安装"
        return 1
    fi
    success "Node.js: $(node --version)"

    # 检查 npm
    if ! command -v npm &> /dev/null; then
        error "npm 未安装"
        return 1
    fi
    success "npm: $(npm --version)"

    # 检查 PM2 全局安装
    if ! pm2 --version &> /dev/null; then
        warn "PM2 未全局安装，使用本地版本"
        PM2_CMD="$BACKEND_DIR/node_modules/.bin/pm2"
    else
        success "PM2: $(pm2 --version)"
        PM2_CMD="pm2"
    fi

    return 0
}

validate_environment() {
    log "验证环境..."

    # 检查 .env 文件
    if [ ! -f "$BACKEND_DIR/.env" ]; then
        error ".env 文件不存在"
        return 1
    fi
    success ".env 文件已找到"

    # 检查 pm2.config.js
    if [ ! -f "$BACKEND_DIR/pm2.config.js" ]; then
        error "pm2.config.js 文件不存在"
        return 1
    fi
    success "pm2.config.js 文件已找到"

    return 0
}

install_dependencies() {
    log "安装依赖..."

    cd "$BACKEND_DIR"

    if [ -d "node_modules" ]; then
        log "node_modules 已存在，跳过重新安装"
    else
        if npm install; then
            success "依赖安装成功"
        else
            error "依赖安装失败"
            return 1
        fi
    fi

    return 0
}

run_initialization() {
    if [ "$INIT" != "true" ]; then
        warn "跳过初始化步骤"
        return 0
    fi

    log "运行生产初始化..."

    if [ ! -f "$BACKEND_DIR/scripts/init-production.js" ]; then
        warn "init-production.js 不存在，跳过初始化"
        return 0
    fi

    if node "$BACKEND_DIR/scripts/init-production.js"; then
        success "初始化完成"
    else
        error "初始化失败"
        return 1
    fi

    return 0
}

start_pm2() {
    log "启动 PM2..."

    cd "$BACKEND_DIR"

    # 检查应用是否已在运行
    if $PM2_CMD status | grep -q "morning-reading-backend"; then
        if [ "$FORCE_RESTART" = "true" ]; then
            warn "应用已在运行，强制重启..."
            if $PM2_CMD restart "$BACKEND_DIR/pm2.config.js" --env "$ENV"; then
                success "应用重启成功"
            else
                error "应用重启失败"
                return 1
            fi
        else
            warn "应用已在运行，使用 --force-restart 强制重启"
            $PM2_CMD status
            return 0
        fi
    else
        if $PM2_CMD start "$BACKEND_DIR/pm2.config.js" --env "$ENV"; then
            success "应用启动成功"
        else
            error "应用启动失败"
            return 1
        fi
    fi

    return 0
}

show_status() {
    log "应用状态："
    $PM2_CMD status

    echo ""
    log "最近日志："
    $PM2_CMD logs morning-reading-backend --lines 20
}

setup_autostart() {
    if [ "$SETUP" != "true" ]; then
        return 0
    fi

    log "设置开机自启..."

    # 检查是否为 root
    if [ "$EUID" -ne 0 ]; then
        error "设置开机自启需要 root 权限，请使用 sudo"
        return 1
    fi

    if $PM2_CMD startup &>/dev/null && $PM2_CMD save; then
        success "开机自启设置成功"
    else
        error "开机自启设置失败"
        return 1
    fi

    return 0
}

# ============================================================================
# 主程序
# ============================================================================

main() {
    clear

    echo -e "${CYAN}╔═══════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║   晨读营项目 - PM2 启动脚本           ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════╝${NC}"
    echo ""

    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env)
                ENV="$2"
                shift 2
                ;;
            --no-init)
                INIT=false
                shift
                ;;
            --force-restart)
                FORCE_RESTART=true
                shift
                ;;
            --setup)
                SETUP=true
                shift
                ;;
            --help)
                help
                exit 0
                ;;
            *)
                error "未知参数: $1"
                help
                exit 1
                ;;
        esac
    done

    log "配置: ENV=$ENV, INIT=$INIT, FORCE_RESTART=$FORCE_RESTART"
    echo ""

    # 执行步骤
    check_dependencies || exit 1
    echo ""

    validate_environment || exit 1
    echo ""

    install_dependencies || exit 1
    echo ""

    run_initialization || exit 1
    echo ""

    start_pm2 || exit 1
    echo ""

    setup_autostart || exit 1
    echo ""

    show_status

    echo ""
    echo -e "${GREEN}✅ PM2 启动完成${NC}"
    echo ""
    echo -e "环境: ${BLUE}$ENV${NC}"
    echo -e "应用: ${BLUE}morning-reading-backend${NC}"
    echo -e "日志: ${BLUE}$BACKEND_DIR/logs/${NC}"
    echo ""
}

# ============================================================================
# 启动
# ============================================================================

main "$@"
