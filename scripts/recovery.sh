#!/bin/bash

################################################################################
# 灾难恢复脚本 - 从备份恢复部署
# 执行位置：远程服务器
# 执行方式：bash scripts/recovery.sh [backup-file]
#
# 参数：
#   backup-file: 备份文件名（可选）
#                如不指定，将列出可用的备份
#
# 功能：
# 1. 列出可用备份
# 2. 验证备份完整性
# 3. 停止当前应用
# 4. 恢复代码和配置
# 5. 重新启动服务
# 6. 验证恢复成功
################################################################################

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 源加载库
source "$SCRIPT_DIR/lib/utils.sh"
source "$SCRIPT_DIR/lib/deploy-functions.sh"
source "$SCRIPT_DIR/lib/database-functions.sh"

################################################################################
# 配置
################################################################################

APP_ROOT="/var/www/morning-reading"
BACKUP_DIR="/var/www"
PM2_APP_NAME="morning-reading-backend"
BACKUP_FILE="${1:-}"

################################################################################
# 辅助函数
################################################################################

# 列出可用备份
list_backups() {
  log_section "可用的备份文件"

  local backups=($(ls -1t "$BACKUP_DIR"/morning-reading_bak_*.tar.gz 2>/dev/null || echo ""))

  if [ ${#backups[@]} -eq 0 ]; then
    log_error "未找到备份文件"
    return 1
  fi

  log_info "找到 ${#backups[@]} 个备份："
  log_info ""

  local i=1
  for backup in "${backups[@]}"; do
    local size=$(du -h "$backup" | cut -f1)
    local date=$(basename "$backup" | sed 's/morning-reading_bak_//;s/.tar.gz//')
    log_info "  $i) $(basename "$backup") ($size)"
    log_info "     时间: $date"
    i=$((i + 1))
  done

  log_info ""
  return 0
}

# 验证备份文件
verify_backup() {
  local backup_file="$1"

  if [ ! -f "$backup_file" ]; then
    log_error "备份文件不存在: $backup_file"
    return 1
  fi

  log_info "验证备份文件: $(basename "$backup_file")"

  if tar -tzf "$backup_file" &>/dev/null; then
    log_success "备份文件完整"
    return 0
  else
    log_error "备份文件损坏"
    return 1
  fi
}

# 停止所有服务
stop_services() {
  log_section "停止服务"

  log_info "停止 PM2 应用..."
  if stop_pm2_app "$PM2_APP_NAME"; then
    sleep 2
    log_success "PM2 应用已停止"
  else
    log_warning "PM2 应用停止失败，继续..."
  fi

  log_info "停止 Docker 容器..."
  if stop_docker_containers "$APP_ROOT/backend"; then
    sleep 2
    log_success "Docker 容器已停止"
  else
    log_warning "Docker 容器停止失败，继续..."
  fi

  log_info "停止 Nginx..."
  if sudo systemctl stop nginx 2>/dev/null; then
    log_success "Nginx 已停止"
  else
    log_warning "Nginx 停止失败，继续..."
  fi
}

# 备份当前部署（恢复前的备份）
backup_current() {
  log_section "备份当前部署（恢复前）"

  if [ ! -d "$APP_ROOT" ]; then
    log_info "当前部署不存在，跳过备份"
    return 0
  fi

  local emergency_backup="$BACKUP_DIR/morning-reading_emergency_$(date +%Y%m%d_%H%M%S).tar.gz"

  log_info "创建紧急备份: $(basename "$emergency_backup")"

  if cd "$BACKUP_DIR" && sudo tar --exclude='morning-reading/logs' --exclude='morning-reading/node_modules' \
    -czf "$emergency_backup" morning-reading/ 2>/dev/null; then
    log_success "紧急备份已创建"
    log_info "位置: $emergency_backup"
    return 0
  else
    log_warning "紧急备份创建失败"
    return 1
  fi
}

# 恢复备份文件
restore_backup() {
  local backup_file="$1"

  log_section "恢复备份"

  log_info "备份文件: $(basename "$backup_file")"

  log_info "删除当前部署..."
  sudo rm -rf "$APP_ROOT" 2>/dev/null || true

  log_info "解压备份文件..."
  if cd "$BACKUP_DIR" && sudo tar -xzf "$backup_file" 2>/dev/null; then
    log_success "备份已解压"
  else
    log_error "备份解压失败"
    return 1
  fi

  log_info "调整文件权限..."
  sudo chown -R ubuntu:ubuntu "$APP_ROOT" 2>/dev/null || true

  log_success "备份恢复完成"
  return 0
}

# 重启所有服务
start_services() {
  log_section "重启服务"

  log_info "启动 Docker 容器..."
  if start_docker_containers "$APP_ROOT/backend"; then
    sleep 3
    log_success "Docker 容器已启动"
  else
    log_error "Docker 容器启动失败"
    return 1
  fi

  log_info "启动 PM2 应用..."
  if restart_pm2_app "$PM2_APP_NAME" "$APP_ROOT/backend"; then
    sleep 2
    log_success "PM2 应用已启动"
  else
    log_error "PM2 应用启动失败"
    return 1
  fi

  log_info "启动 Nginx..."
  if sudo systemctl start nginx 2>/dev/null; then
    log_success "Nginx 已启动"
  else
    log_error "Nginx 启动失败"
    return 1
  fi

  sleep 3
}

# 验证恢复
verify_recovery() {
  log_section "验证恢复"

  log_info "检查后端服务..."
  if curl -s http://127.0.0.1:3000/api/v1/health | grep -q "ok" 2>/dev/null; then
    log_success "后端服务已恢复"
  else
    log_warning "后端服务可能未完全恢复，请手动检查"
    return 1
  fi

  log_info "检查 PM2 应用..."
  if check_pm2_status "$PM2_APP_NAME"; then
    log_success "PM2 应用状态正常"
  else
    log_warning "PM2 应用状态异常"
    return 1
  fi

  log_info "检查容器..."
  if docker ps | grep -q "morning-reading"; then
    log_success "Docker 容器运行中"
  else
    log_warning "Docker 容器可能未完全启动"
    return 1
  fi

  return 0
}

################################################################################
# 主函数
################################################################################

main() {
  log_header "灾难恢复 - 从备份恢复部署"

  log_info "开始时间: $(date)"
  log_info "应用目录: $APP_ROOT"
  log_info ""

  # 列出备份
  if ! list_backups; then
    log_error "没有可用的备份，无法进行恢复"
    exit 1
  fi

  # 选择备份文件
  if [ -z "$BACKUP_FILE" ]; then
    log_section "选择备份文件"

    read -p "请输入要恢复的备份文件名或路径 (或直接按 Enter 选择最新备份): " selected_backup

    if [ -z "$selected_backup" ]; then
      # 选择最新备份
      BACKUP_FILE=$(ls -1t "$BACKUP_DIR"/morning-reading_bak_*.tar.gz 2>/dev/null | head -1)
      log_info "使用最新备份: $(basename "$BACKUP_FILE")"
    else
      # 检查用户输入是否包含完整路径
      if [[ "$selected_backup" == /* ]]; then
        BACKUP_FILE="$selected_backup"
      else
        BACKUP_FILE="$BACKUP_DIR/$selected_backup"
      fi
    fi
  fi

  # 验证备份
  log_section "验证备份"

  if ! verify_backup "$BACKUP_FILE"; then
    log_error "备份文件无效，恢复失败"
    exit 1
  fi

  # 确认恢复
  log_section "恢复确认"

  log_warning "⚠️  恢复操作将："
  log_warning "  1. 停止所有服务（后端、数据库、Web 服务器）"
  log_warning "  2. 删除当前部署"
  log_warning "  3. 恢复旧备份"
  log_warning "  4. 重启所有服务"
  log_warning ""
  log_warning "恢复过程中应用将不可用（通常 5-10 分钟）"
  log_warning ""

  if ! confirm "确实要从备份恢复吗？"; then
    log_info "已取消恢复"
    exit 0
  fi

  # 执行恢复流程
  log_section "开始恢复流程"

  # 1. 备份当前部署（以防万一）
  if ! backup_current; then
    log_warning "紧急备份创建失败，但继续恢复..."
  fi

  # 2. 停止服务
  if ! stop_services; then
    log_error "服务停止失败"
    exit 1
  fi

  # 3. 恢复备份
  if ! restore_backup "$BACKUP_FILE"; then
    log_error "备份恢复失败"
    exit 1
  fi

  # 4. 重启服务
  if ! start_services; then
    log_error "服务启动失败，请手动检查"
    exit 1
  fi

  # 5. 验证恢复
  if verify_recovery; then
    log_header "恢复完成 - 应用已恢复运行 ✨"
  else
    log_warning "恢复可能不完整，请手动验证"
    exit 1
  fi

  log_info ""
  log_info "后续步骤："
  log_info "  1. 验证应用是否正常工作"
  log_info "  2. 检查数据是否正确"
  log_info "  3. 查看应用日志："
  log_info "     pm2 logs $PM2_APP_NAME"
  log_info "  4. 查看容器日志："
  log_info "     docker logs morning-reading-mongodb"
  log_info ""

  return 0
}

# 捕获错误时输出
trap 'log_error "恢复过程失败，请检查上面的错误信息"; exit 1' ERR

main "$@"
