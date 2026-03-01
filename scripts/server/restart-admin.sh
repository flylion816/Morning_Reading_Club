#!/bin/bash

################################################################################
# 管理后台重启脚本 - 服务器上执行
# 功能：Nginx 重载配置，让新的静态文件生效
# 说明：管理后台是 Vue 构建的静态文件，存放在 /var/www/morning-reading/admin/dist
#      此脚本只需重载 Nginx，不需要重启 Node.js 服务
# 执行位置：服务器上
# 执行方式：ssh ubuntu@118.25.145.179 "bash /var/www/morning-reading/restart-admin.sh"
################################################################################

set -e

# 配置
ADMIN_PATH="/var/www/morning-reading/admin/dist"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 时间戳函数
timestamp() {
  echo "$(date +'%Y-%m-%d %H:%M:%S')"
}

# 日志函数
log_info() {
  echo -e "${BLUE}[$(timestamp)]${NC} ℹ️  $1"
}

log_success() {
  echo -e "${GREEN}[$(timestamp)]${NC} ✅ $1"
}

log_warning() {
  echo -e "${YELLOW}[$(timestamp)]${NC} ⚠️  $1"
}

log_error() {
  echo -e "${RED}[$(timestamp)]${NC} ❌ $1"
}

################################################################################
# 主逻辑
################################################################################

log_info "========================================"
log_info "管理后台重启脚本"
log_info "========================================"

# 1. 验证管理后台目录存在
if [ ! -d "$ADMIN_PATH" ]; then
  log_error "管理后台目录不存在: $ADMIN_PATH"
  exit 1
fi

log_success "管理后台目录存在: $ADMIN_PATH"

# 2. 验证 Nginx 安装
if ! command -v nginx &> /dev/null; then
  log_error "Nginx 未安装"
  exit 1
fi

log_success "Nginx 已安装"

# 3. 测试 Nginx 配置
log_info "测试 Nginx 配置..."
if sudo nginx -t 2>&1 | grep -q "successful"; then
  log_success "Nginx 配置测试通过"
else
  log_error "Nginx 配置测试失败"
  sudo nginx -t
  exit 1
fi

# 4. 重载 Nginx
log_info "重载 Nginx..."
if sudo nginx -s reload; then
  log_success "Nginx 已重载"
else
  log_error "Nginx 重载失败"
  exit 1
fi

sleep 1

# 5. 验证 Nginx 状态
log_info "验证 Nginx 状态..."
if sudo systemctl is-active --quiet nginx; then
  log_success "Nginx 状态正常 (active)"
else
  log_warning "Nginx 状态异常，请手动检查"
  sudo systemctl status nginx --no-pager || true
  exit 1
fi

# 6. 显示管理后台文件信息
log_info "管理后台文件信息:"
if ls -lh "$ADMIN_PATH"/{index.html,*.js,*.css} 2>/dev/null | head -5; then
  log_success "管理后台文件就绪"
else
  log_warning "无法列出管理后台文件"
fi

log_info "========================================"
log_success "管理后台重启完成！"
log_success "新的静态文件已生效，访问 https://wx.shubai01.com/admin 可看到更新"
log_info "========================================"

exit 0
