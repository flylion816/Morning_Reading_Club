#!/bin/bash

################################################################################
# 第 2 步：安装运行时依赖 - 部署的必要软件
# 执行位置：远程服务器
# 执行方式：bash scripts/2-install-dependencies.sh
#
# 功能：
# 1. 安装 Node.js 和 npm
# 2. 安装 Docker 和 Docker Compose
# 3. 安装 PM2（全局）
# 4. 安装 Nginx
# 5. 安装 Certbot（Let's Encrypt）
# 6. 验证所有安装
################################################################################

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 源加载库
source "$SCRIPT_DIR/lib/utils.sh"
source "$SCRIPT_DIR/lib/infrastructure-functions.sh"

################################################################################
# 主函数
################################################################################

main() {
  log_header "晨读营小程序 - 第 2 步：安装运行时依赖"

  log_info "开始时间: $(date)"
  log_info ""

  # 第 1 步：安装 Node.js
  log_section "第 1 步：安装 Node.js 和 npm"
  if ! install_nodejs; then
    log_error "Node.js 安装失败"
    exit 1
  fi

  # 第 2 步：安装 Docker
  log_section "第 2 步：安装 Docker"
  if ! install_docker; then
    log_error "Docker 安装失败"
    exit 1
  fi

  # 第 3 步：安装 Docker Compose
  log_section "第 3 步：安装 Docker Compose"
  if ! install_docker_compose; then
    log_error "Docker Compose 安装失败"
    exit 1
  fi

  # 第 4 步：安装 PM2
  log_section "第 4 步：安装 PM2（全局）"
  if ! install_pm2; then
    log_error "PM2 安装失败"
    exit 1
  fi

  # 第 5 步：安装 Nginx
  log_section "第 5 步：安装 Nginx"
  if ! install_nginx; then
    log_error "Nginx 安装失败"
    exit 1
  fi

  # 第 6 步：安装 Certbot
  log_section "第 6 步：安装 Certbot（Let's Encrypt）"
  if ! install_certbot; then
    log_error "Certbot 安装失败"
    exit 1
  fi

  # 第 7 步：验证所有安装
  log_section "第 7 步：验证所有安装"

  log_info "验证 Node.js..."
  check_command "node" || exit 1
  node --version | xargs log_success

  log_info "验证 npm..."
  check_command "npm" || exit 1
  npm --version | xargs log_success

  log_info "验证 Docker..."
  check_command "docker" || exit 1
  docker --version | xargs log_success

  log_info "验证 Docker Compose..."
  docker compose version | xargs log_success

  log_info "验证 PM2..."
  check_command "pm2" || exit 1
  pm2 --version | xargs log_success

  log_info "验证 Nginx..."
  check_command "nginx" || exit 1
  nginx -v 2>&1 | xargs log_success

  log_info "验证 Certbot..."
  check_command "certbot" || exit 1
  certbot --version | xargs log_success

  # 显示摘要
  log_section "依赖安装摘要"

  log_info "✅ Node.js: 已安装"
  log_info "✅ Docker: 已安装"
  log_info "✅ Docker Compose: 已安装"
  log_info "✅ PM2: 已安装"
  log_info "✅ Nginx: 已安装"
  log_info "✅ Certbot: 已安装"

  log_header "所有依赖安装完成！✨"

  log_info "下一步："
  log_info "  1. 所有软件已验证安装"
  log_info "  2. 运行第 3 步脚本："
  log_info "     bash scripts/3-setup-infrastructure.sh"
  log_info ""

  return 0
}

# 捕获错误时输出
trap 'log_error "脚本执行失败，请检查上面的错误信息"; exit 1' ERR

main "$@"
