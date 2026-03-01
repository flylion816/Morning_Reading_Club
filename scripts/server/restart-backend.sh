#!/bin/bash

################################################################################
# 后端服务重启脚本 - 服务器上执行
# 功能：使用 PM2 重启 Node.js 后端服务（零停机重载）
# 执行位置：服务器上 (/var/www/morning-reading/)
# 执行方式：ssh ubuntu@118.25.145.179 "bash /var/www/morning-reading/restart-backend.sh"
################################################################################

set -e

# 配置
BACKEND_PATH="/var/www/morning-reading/backend"
APP_NAME="morning-reading-backend"
LOG_DIR="/var/www/morning-reading/logs"

# PM2 命令（优先使用全局，否则用 npx）
PM2_CMD="pm2"
if ! command -v pm2 >/dev/null 2>&1; then
  PM2_CMD="npx -y pm2"
fi

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
log_info "后端服务重启脚本"
log_info "========================================"

# 1. 验证后端目录存在
if [ ! -d "$BACKEND_PATH" ]; then
  log_error "后端目录不存在: $BACKEND_PATH"
  exit 1
fi

log_info "后端路径: $BACKEND_PATH"

# 2. 进入后端目录
cd "$BACKEND_PATH"
log_success "进入后端目录"

# 3. 更新依赖（生产环境）
log_info "更新依赖..."
npm install --production 2>&1 | grep -E "(added|up to date)" || true

# 4. 检查 PM2 状态
log_info "检查 PM2 应用状态..."
if $PM2_CMD describe "$APP_NAME" > /dev/null 2>&1; then
  log_success "PM2 应用存在: $APP_NAME"

  # 5. 执行零停机重载
  log_info "执行零停机重载 (pm2 reload)..."
  $PM2_CMD reload "$APP_NAME" --update-env

  sleep 2

  # 6. 检查重载结果
  log_info "检查重启后状态..."
  if $PM2_CMD describe "$APP_NAME" | grep -q "online"; then
    log_success "后端服务已成功重启，状态: online"
  else
    log_warning "后端服务状态异常，请手动检查"
    $PM2_CMD describe "$APP_NAME"
    exit 1
  fi
else
  log_error "PM2 应用不存在: $APP_NAME"
  log_info "尝试使用 PM2 启动服务..."

  if [ -f "pm2.config.js" ]; then
    $PM2_CMD start pm2.config.js --env production
    log_success "服务已启动"
  else
    log_error "pm2.config.js 文件不存在"
    exit 1
  fi
fi

# 7. 显示详细状态
log_info "详细状态信息："
$PM2_CMD show "$APP_NAME" | grep -E "(status|memory|cpu|uptime)" | sed 's/^/  /'

# 8. 显示最近日志
log_info "最近日志（最后10行）:"
if $PM2_CMD logs "$APP_NAME" --lines 10 --nostream 2>/dev/null | head -10 | sed 's/^/  /'; then
  :
else
  log_warning "无法显示日志"
fi

log_info "========================================"
log_success "后端重启完成！"
log_info "========================================"

exit 0
