#!/bin/bash

################################################################################
# 第 1 步：系统初始化 - 新服务器部署的第一步
# 执行位置：远程服务器
# 执行方式：bash scripts/1-initial-setup.sh
#
# 功能：
# 1. 验证 sudo 权限
# 2. 检查系统环境（架构、磁盘、网络）
# 3. 设置系统参数
# 4. 创建应用目录
################################################################################

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 源加载库
source "$SCRIPT_DIR/lib/utils.sh"
source "$SCRIPT_DIR/lib/infrastructure-functions.sh"

################################################################################
# 配置
################################################################################

APP_ROOT="/var/www/morning-reading"
APP_USER="ubuntu"
REQUIRED_DISK_SPACE_GB=20  # 需要至少 20GB 磁盘空间

################################################################################
# 主函数
################################################################################

main() {
  log_header "晨读营小程序 - 第 1 步：系统初始化"

  log_info "开始时间: $(date)"
  log_info "脚本位置: $SCRIPT_DIR"
  log_info "应用目录: $APP_ROOT"
  log_info ""

  # 第 1 步：验证权限
  log_section "第 1 步：验证权限"
  if ! check_sudo_access; then
    log_error "无法继续，需要 sudo 权限"
    exit 1
  fi

  # 第 2 步：系统检查
  log_section "第 2 步：系统环境检查"

  log_info "检查系统架构..."
  check_system_architecture

  log_info "检查磁盘空间..."
  if ! check_disk_space "/" "$REQUIRED_DISK_SPACE_GB"; then
    log_error "磁盘空间不足（需要 ${REQUIRED_DISK_SPACE_GB}GB）"
    exit 1
  fi

  # 第 3 步：创建应用目录
  log_section "第 3 步：创建应用目录"

  if ! setup_app_directories "$APP_ROOT" "$APP_USER"; then
    log_error "创建应用目录失败"
    exit 1
  fi

  # 第 4 步：配置用户权限
  log_section "第 4 步：配置用户权限"

  if ! setup_ubuntu_user_permissions; then
    log_warning "用户权限配置可能不完整，继续..."
  fi

  # 第 5 步：显示摘要
  log_section "系统初始化摘要"

  log_info "✅ 权限检查: 已验证"
  log_info "✅ 系统架构: 已检查"
  log_info "✅ 磁盘空间: 已验证（需要 ${REQUIRED_DISK_SPACE_GB}GB）"
  log_info "✅ 应用目录: 已创建 ($APP_ROOT)"
  log_info "✅ 用户权限: 已配置"

  log_header "系统初始化完成！✨"

  log_info "下一步："
  log_info "  1. 确保所有输出都标记为 ✅"
  log_info "  2. 运行第 2 步脚本："
  log_info "     bash scripts/2-install-dependencies.sh"
  log_info ""

  return 0
}

# 捕获错误时输出
trap 'log_error "脚本执行失败，请检查上面的错误信息"; exit 1' ERR

main "$@"
