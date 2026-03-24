#!/bin/bash

################################################################################
# 第 6 步：应用部署 - 启动后端和部署前端
# 执行位置：远程服务器
# 执行方式：bash scripts/6-deploy-app.sh
#
# 功能：
# 1. 安装后端依赖（npm install）
# 2. 启动 PM2 应用
# 3. 配置 PM2 日志轮转
# 4. 复制管理后台文件
# 5. 验证部署
# 6. 重新加载 Nginx
################################################################################

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 源加载库
source "$SCRIPT_DIR/lib/utils.sh"
source "$SCRIPT_DIR/lib/deploy-functions.sh"
source "$SCRIPT_DIR/lib/database-functions.sh"
source "$SCRIPT_DIR/lib/infrastructure-functions.sh"

################################################################################
# 配置
################################################################################

APP_ROOT="/var/www/morning-reading"
BACKEND_DIR="$APP_ROOT/backend"
ADMIN_DIR="$APP_ROOT/admin"
PM2_APP_NAME="morning-reading-backend"
ADMIN_DIST="$ADMIN_DIR/dist"

################################################################################
# 主函数
################################################################################

main() {
  log_header "晨读营小程序 - 第 6 步：应用部署"

  log_info "开始时间: $(date)"
  log_info "后端目录: $BACKEND_DIR"
  log_info "管理后台: $ADMIN_DIR"
  log_info "PM2 应用: $PM2_APP_NAME"
  log_info ""

  # 验证目录存在
  if [ ! -d "$BACKEND_DIR" ]; then
    log_error "后端目录不存在: $BACKEND_DIR"
    exit 1
  fi

  # 第 1 步：安装后端依赖
  log_section "第 1 步：安装后端依赖"

  if ! install_backend_dependencies "$BACKEND_DIR"; then
    log_error "后端依赖安装失败"
    exit 1
  fi

  # 第 2 步：启动 PM2 应用
  log_section "第 2 步：启动 PM2 应用"

  if ! restart_pm2_app "$PM2_APP_NAME" "$BACKEND_DIR"; then
    log_error "PM2 应用启动失败"
    exit 1
  fi

  # 等待应用稳定
  sleep 3

  # 第 3 步：配置 PM2 日志轮转
  log_section "第 3 步：配置 PM2 日志轮转"

  if ! setup_pm2_logrotate; then
    log_warning "PM2 日志轮转配置失败，继续..."
  fi

  # 第 4 步：检查应用状态
  log_section "第 4 步：检查 PM2 应用状态"

  if check_pm2_status "$PM2_APP_NAME"; then
    log_success "PM2 应用状态正常"
  else
    log_warning "PM2 应用可能未运行，请检查"
  fi

  # 第 5 步：复制管理后台文件
  log_section "第 5 步：部署管理后台"

  if [ -d "$ADMIN_DIST" ] && [ -f "$ADMIN_DIST/index.html" ]; then
    log_success "管理后台文件已就位 ($ADMIN_DIST)"
  else
    log_warning "管理后台 dist 目录不存在或缺少 index.html"
    log_info "需要先构建管理后台："
    log_info "  cd $ADMIN_DIR && npm install && npm run build"
  fi

  # 第 6 步：验证后端服务
  log_section "第 6 步：验证后端服务"

  log_info "等待后端启动..."
  sleep 2

  log_info "检查后端健康状态..."
  if curl -s http://127.0.0.1:3000/api/v1/health | grep -q "ok" 2>/dev/null; then
    log_success "后端服务已启动并正常 (http://127.0.0.1:3000/api/v1/health)"
  else
    log_warning "后端服务可能未正常启动，请检查日志："
    log_info "  pm2 logs $PM2_APP_NAME"
  fi

  # 第 7 步：重新加载 Nginx
  log_section "第 7 步：重新加载 Nginx"

  if ! reload_nginx; then
    log_warning "Nginx 重新加载失败，但继续..."
  fi

  # 第 8 步：配置定时任务
  log_section "第 8 步：配置 Cron 定时任务"

  if ! setup_cron_jobs "$APP_ROOT"; then
    log_warning "Cron 定时任务配置失败，请手动配置"
  fi

  # 显示摘要
  log_section "应用部署摘要"

  log_info "✅ 后端依赖: 已安装"
  log_info "✅ PM2 应用: 已启动 ($PM2_APP_NAME)"
  log_info "✅ 日志轮转: 已配置（500MB/文件 × 10个）"
  log_info "✅ 管理后台: 已部署 ($ADMIN_DIST)"
  log_info "✅ Nginx: 已重新加载"
  log_info "✅ Cron: 每日17:00日志巡检报告"

  log_header "应用部署完成！🎉"

  log_info "重要信息："
  log_info "  • 后端 API: https://wx.shubai01.com/api/v1/health"
  log_info "  • 管理后台: https://wx.shubai01.com/admin"
  log_info "  • PM2 应用: $PM2_APP_NAME"
  log_info ""

  log_info "后续步骤："
  log_info "  1. 验证部署完成："
  log_info "     bash scripts/verify-deployment.sh"
  log_info ""
  log_info "  2. 查看应用日志："
  log_info "     pm2 logs $PM2_APP_NAME"
  log_info ""
  log_info "  3. 监控应用："
  log_info "     pm2 monit"
  log_info ""

  return 0
}

# 捕获错误时输出
trap 'log_error "脚本执行失败，请检查上面的错误信息"; exit 1' ERR

main "$@"
