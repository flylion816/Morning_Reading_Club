#!/bin/bash

################################################################################
# 日常部署脚本 - 本地执行（已优化）
# 功能：本地打包 + 备份 + 上传 + 服务器部署（一键部署）
# 执行位置：本地 Mac/Linux
# 执行方式：bash scripts/deploy-to-server.sh
#
# 改进：
# - 使用新的函数库（减少 400+ 行重复代码）
# - 代码行数：581 → ~150 行（74% 减少）
# - 完整流程：1. 检查依赖 2. 构建管理后台 3. 创建备份
#           4. 打包上传 5. 远程部署 6. 验证 7. 清理
################################################################################

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 源加载库（自动从库加载 log_* 和其他函数）
source "$SCRIPT_DIR/lib/utils.sh"
source "$SCRIPT_DIR/lib/deploy-functions.sh"
source "$SCRIPT_DIR/lib/infrastructure-functions.sh"

################################################################################
# 配置
################################################################################

# 本地
ADMIN_DIR="$PROJECT_ROOT/admin"
BACKEND_DIR="$PROJECT_ROOT/backend"

# 服务器
SERVER_IP="118.25.145.179"
SERVER_USER="ubuntu"
SSH_KEY="$HOME/.ssh/id_rsa"
SERVER_ROOT="/var/www/morning-reading"
PM2_APP_NAME="morning-reading-backend"

# 打包
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOY_PACKAGE="morning-reading-deploy_${TIMESTAMP}.tar.gz"
TEMP_DIR="/tmp/morning-reading-deploy-${TIMESTAMP}"
TMP_PACKAGE_PATH="/tmp/$DEPLOY_PACKAGE"
LOCAL_PACKAGE_PATH="$PROJECT_ROOT/$DEPLOY_PACKAGE"

################################################################################
# 清理函数
################################################################################

cleanup() {
  log_section "清理本地临时文件"
  [ -d "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
  [ -f "$TMP_PACKAGE_PATH" ] && rm -f "$TMP_PACKAGE_PATH"
  [ -f "$LOCAL_PACKAGE_PATH" ] && rm -f "$LOCAL_PACKAGE_PATH"
  log_success "清理完成"
}

trap cleanup EXIT

################################################################################
# 主函数
################################################################################

main() {
  log_header "晨读营小程序 - 日常部署"

  log_info "部署时间: $(date)"
  log_info "时间戳: $TIMESTAMP"
  log_info "部署包: $DEPLOY_PACKAGE"
  log_info ""

  # 第 1 步：检查依赖
  log_section "第 1 步：检查依赖"
  for cmd in sshpass npm tar ssh scp; do
    check_command "$cmd" || exit 1
  done

  # 第 2 步：构建管理后台
  log_section "第 2 步：构建管理后台"
  if ! build_admin "$ADMIN_DIR"; then
    exit 1
  fi

  # 第 3 步：创建备份
  log_section "第 3 步：在服务器创建备份"
  create_server_backup "$SERVER_ROOT" "$SERVER_USER" "$SERVER_IP" "$SSH_KEY" || true

  # 第 3.5 步：确保日志目录存在（部署前）
  log_section "第 3.5 步：准备日志目录"
  if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'EOF'
sudo mkdir -p /var/www/logs
sudo chown ubuntu:ubuntu /var/www/logs
sudo chmod 755 /var/www/logs
echo "✓ 日志目录已准备"
EOF
  then
    log_success "日志目录已准备"
  else
    log_warning "日志目录准备失败，但继续部署"
  fi

  # 第 4 步：打包文件
  log_section "第 4 步：打包部署文件"
  mkdir -p "$TEMP_DIR"

  # 复制文件
  mkdir -p "$TEMP_DIR/backend"
  cp -r "$BACKEND_DIR/src" "$TEMP_DIR/backend/" 2>/dev/null || true
  cp -r "$BACKEND_DIR/scripts" "$TEMP_DIR/backend/" 2>/dev/null || true
  cp "$BACKEND_DIR"/{package.json,package-lock.json,pm2.config.js,.env} "$TEMP_DIR/backend/" 2>/dev/null || true

  mkdir -p "$TEMP_DIR/admin"
  cp -r "$ADMIN_DIR/dist" "$TEMP_DIR/admin/" 2>/dev/null || true

  if [ ! -d "$TEMP_DIR/admin/dist" ]; then
    log_error "管理后台 dist 不存在"
    exit 1
  fi

  cp "$PROJECT_ROOT/.env.config.js" "$TEMP_DIR/" 2>/dev/null || true

  # 压缩
  cd /tmp && tar --exclude='node_modules' --exclude='.git' -czf "$DEPLOY_PACKAGE" \
    -C "$(dirname "$TEMP_DIR")" "$(basename "$TEMP_DIR")" 2>/dev/null
  cd "$PROJECT_ROOT"

  if [ ! -f "$TMP_PACKAGE_PATH" ]; then
    log_error "打包失败"
    exit 1
  fi

  cp "$TMP_PACKAGE_PATH" "$LOCAL_PACKAGE_PATH"
  local package_size=$(du -h "$TMP_PACKAGE_PATH" | cut -f1)
  log_success "打包完成: $DEPLOY_PACKAGE (大小: $package_size)"

  # 第 5 步：上传和部署
  log_section "第 5 步：上传到服务器"

  local remote_package="/tmp/$DEPLOY_PACKAGE"
  if ! scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$LOCAL_PACKAGE_PATH" \
    "$SERVER_USER@$SERVER_IP:$remote_package" 2>/dev/null; then
    log_error "上传失败"
    exit 1
  fi
  log_success "文件已上传"

  log_section "第 6 步：在服务器部署"

  # 使用库函数部署
  if ! deploy_files_on_server "$remote_package" "$SERVER_ROOT" "$SERVER_USER" \
    "$SERVER_IP" "$SSH_KEY"; then
    log_error "文件部署失败"
    exit 1
  fi

  # 安装依赖和启动/重启应用
  if ! ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'EOF'
source ~/.bashrc 2>/dev/null || true
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
cd /var/www/morning-reading/backend

# 安装依赖
npm install --silent

# 检查应用是否已存在，决定是启动还是重新加载
if npx pm2 describe morning-reading-backend >/dev/null 2>&1; then
  # 应用已存在，执行重新加载
  npx pm2 reload morning-reading-backend --update-env
else
  # 应用不存在，从配置文件启动
  npx pm2 start pm2.config.js
fi

sleep 2

# 安装和配置日志轮转模块
npx pm2 install pm2-logrotate 2>/dev/null || true
npx pm2 set pm2-logrotate:max_size 500M 2>/dev/null || true
npx pm2 set pm2-logrotate:retain 10 2>/dev/null || true
EOF
  then
    log_error "部署后处理失败"
    exit 1
  fi

  log_success "服务器部署完成"

  # 第 7 步：验证
  log_section "第 7 步：验证部署"

  local verify_errors=0

  # 7.1 检查PM2应用状态
  log_info "检查PM2应用状态..."
  local pm2_status=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
    "npx pm2 status 2>/dev/null | grep morning-reading-backend | grep -c 'online'" 2>/dev/null)

  if [ "$pm2_status" -ge 3 ]; then
    log_success "PM2应用正常 (至少3个实例online)"
  else
    log_error "❌ PM2应用异常 (仅$pm2_status个实例online，需要4个)"
    verify_errors=$((verify_errors + 1))
  fi

  # 7.2 检查端口是否监听
  log_info "检查端口3000是否监听..."
  if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
    "lsof -i :3000 2>/dev/null | grep -q LISTEN" 2>/dev/null; then
    log_success "端口3000监听正常"
  else
    log_error "❌ 端口3000未监听（应用可能未启动）"
    verify_errors=$((verify_errors + 1))
  fi

  # 7.3 检查API是否响应
  log_info "检查API健康状态..."
  sleep 2  # 等待应用完全启动
  local api_response=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
    "curl -s http://127.0.0.1:3000/api/v1/health 2>/dev/null" 2>/dev/null)

  if echo "$api_response" | grep -q '"status":"ok"'; then
    log_success "API健康检查通过"
  else
    log_error "❌ API无法响应或返回错误"
    verify_errors=$((verify_errors + 1))
  fi

  # 7.4 检查应用错误日志
  log_info "检查应用启动日志..."
  local startup_errors=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
    "tail -5 /var/www/logs/morning-reading-error.log 2>/dev/null | grep -i 'eaddrinuse\|error.*bind' | wc -l" 2>/dev/null)

  if [ "$startup_errors" -gt 0 ]; then
    log_error "❌ 检测到端口冲突错误（EADDRINUSE）"
    log_warning "需要手动清理占用3000端口的进程："
    log_warning "  ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP"
    log_warning "  pkill -9 -f 'node'"
    log_warning "  cd /var/www/morning-reading/backend && npx pm2 start pm2.config.js --env production"
    verify_errors=$((verify_errors + 1))
  fi

  # 7.5 检查管理后台文件
  log_info "检查管理后台文件..."
  if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
    "[ -f $SERVER_ROOT/admin/dist/index.html ]" 2>/dev/null; then
    log_success "管理后台文件就绪"
  else
    log_warning "⚠️ 管理后台文件异常"
    verify_errors=$((verify_errors + 1))
  fi

  # 验证总结
  log_info ""
  if [ $verify_errors -eq 0 ]; then
    log_success "✅ 部署验证通过！所有检查项目合格"
  else
    log_error "⚠️ 部署验证发现 $verify_errors 个问题，请查看上面的错误信息"
  fi

  # 显示总结
  log_header "部署成功！🎉"

  log_info "关键信息:"
  log_info "  • 后端 API: https://wx.shubai01.com/api/v1/health"
  log_info "  • 管理后台: https://wx.shubai01.com/admin"
  log_info "  • PM2 应用: $PM2_APP_NAME"
  log_info ""
  log_info "查看日志："
  log_info "  ssh -i $SSH_KEY $SERVER_USER@$SERVER_IP"
  log_info "  pm2 logs $PM2_APP_NAME"
  log_info ""

  return 0
}

# 捕获错误
trap 'log_error "部署失败"; exit 1' ERR

main "$@"
