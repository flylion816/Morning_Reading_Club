#!/bin/bash

################################################################################
# 部署验证脚本 - 验证完整部署的所有组件
# 执行位置：远程服务器
# 执行方式：bash scripts/verify-deployment.sh
#
# 功能：
# 1. 系统检查（磁盘、内存、网络）
# 2. 依赖验证（Node.js、Docker、PM2、Nginx）
# 3. 容器检查（MongoDB、MySQL、Redis）
# 4. 应用检查（后端、前端）
# 5. API 健康检查
# 6. SSL 证书检查
################################################################################

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 源加载库
source "$SCRIPT_DIR/lib/utils.sh"
source "$SCRIPT_DIR/lib/infrastructure-functions.sh"
source "$SCRIPT_DIR/lib/database-functions.sh"
source "$SCRIPT_DIR/lib/deploy-functions.sh"

################################################################################
# 配置
################################################################################

APP_ROOT="/var/www/morning-reading"
BACKEND_DIR="$APP_ROOT/backend"
BACKEND_ENV_FILE="$BACKEND_DIR/.env.production"
DOCKER_ENV_FILE="$APP_ROOT/.env.docker"
ADMIN_DIST="$APP_ROOT/admin/dist"
PM2_APP_NAME="morning-reading-backend"
DOMAIN="wx.shubai01.com"
API_ENDPOINT="http://127.0.0.1:3000/api/v1/health"
API_ENDPOINT_HTTPS="https://$DOMAIN/api/v1/health"
PM2_SERVICE_NAME="pm2-$(id -un)"

# 计数器
CHECKS_TOTAL=0
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

################################################################################
# 辅助函数
################################################################################

pass_check() {
  CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
  log_success "$1"
}

fail_check() {
  CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
  CHECKS_FAILED=$((CHECKS_FAILED + 1))
  log_error "$1"
}

warn_check() {
  CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
  CHECKS_WARNING=$((CHECKS_WARNING + 1))
  log_warning "$1"
}

################################################################################
# 主函数
################################################################################

main() {
  log_header "部署验证 - 完整系统检查"

  if [ -f "$BACKEND_ENV_FILE" ]; then
    # shellcheck disable=SC1090
    set -a
    source "$BACKEND_ENV_FILE"
    set +a
  fi

  log_info "开始时间: $(date)"
  log_info "应用目录: $APP_ROOT"
  log_info ""

  # 第 1 步：系统检查
  log_section "第 1 步：系统检查"

  log_info "检查磁盘空间..."
  if check_disk_space "/" 5; then
    pass_check "磁盘空间充足（需要 5GB）"
  else
    warn_check "磁盘空间不足，可能影响应用运行"
  fi

  log_info "检查内存..."
  local mem_available=$(free -m | awk 'NR==2{print $7}')
  if [ "$mem_available" -gt 512 ]; then
    pass_check "内存充足 (可用: ${mem_available}MB)"
  else
    warn_check "内存较低 (可用: ${mem_available}MB，建议 512MB+)"
  fi

  log_info "检查网络连接..."
  if ping -c 1 8.8.8.8 &>/dev/null; then
    pass_check "网络连接正常"
  else
    warn_check "网络连接异常"
  fi

  log_info "检查 DNS 解析..."
  if getent hosts "$DOMAIN" &>/dev/null; then
    local dns_result
    dns_result=$(getent hosts "$DOMAIN" | head -n 1 | awk '{print $1}')
    pass_check "DNS 解析正常 ($DOMAIN -> $dns_result)"
  else
    fail_check "DNS 解析失败 ($DOMAIN)"
  fi

  # 第 2 步：依赖验证
  log_section "第 2 步：依赖验证"

  log_info "检查 Node.js..."
  if command -v node &>/dev/null; then
    local node_version=$(node --version)
    pass_check "Node.js 已安装 ($node_version)"
  else
    fail_check "Node.js 未安装"
  fi

  log_info "检查 npm..."
  if command -v npm &>/dev/null; then
    local npm_version=$(npm --version)
    pass_check "npm 已安装 ($npm_version)"
  else
    fail_check "npm 未安装"
  fi

  log_info "检查 Docker..."
  if command -v docker &>/dev/null; then
    local docker_version=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
    pass_check "Docker 已安装 ($docker_version)"
  else
    fail_check "Docker 未安装"
  fi

  log_info "检查 Docker Compose..."
  if docker compose version &>/dev/null; then
    local compose_version=$(docker compose version | awk '{print $NF}')
    pass_check "Docker Compose 已安装 ($compose_version)"
  else
    fail_check "Docker Compose 未安装"
  fi

  log_info "检查 PM2..."
  if command -v pm2 &>/dev/null; then
    local pm2_version=$(pm2 --version)
    pass_check "PM2 已安装 ($pm2_version)"
  else
    fail_check "PM2 未安装"
  fi

  log_info "检查 Nginx..."
  if command -v nginx &>/dev/null; then
    pass_check "Nginx 已安装"
  else
    fail_check "Nginx 未安装"
  fi

  log_info "检查 Certbot..."
  if command -v certbot &>/dev/null; then
    pass_check "Certbot 已安装"
  else
    fail_check "Certbot 未安装"
  fi

  log_info "检查 PM2 开机自启服务..."
  if systemctl list-unit-files | grep -q "^${PM2_SERVICE_NAME}\.service"; then
    local pm2_service_state
    local pm2_service_enabled
    pm2_service_state=$(systemctl is-active "$PM2_SERVICE_NAME" 2>/dev/null || true)
    pm2_service_enabled=$(systemctl is-enabled "$PM2_SERVICE_NAME" 2>/dev/null || true)
    if [ "$pm2_service_state" = "active" ] && [ "$pm2_service_enabled" = "enabled" ]; then
      pass_check "PM2 自启动服务正常 (${PM2_SERVICE_NAME}: active/enabled)"
    else
      fail_check "PM2 自启动服务异常 (${PM2_SERVICE_NAME}: ${pm2_service_state:-unknown}/${pm2_service_enabled:-unknown})"
    fi
  else
    fail_check "PM2 自启动服务不存在 (${PM2_SERVICE_NAME})"
  fi

  log_info "检查 systemd-resolved..."
  if systemctl list-unit-files | grep -q "^systemd-resolved\.service"; then
    local resolved_state
    local resolved_enabled
    resolved_state=$(systemctl is-active systemd-resolved 2>/dev/null || true)
    resolved_enabled=$(systemctl is-enabled systemd-resolved 2>/dev/null || true)
    if [ "$resolved_state" = "active" ] && [ "$resolved_enabled" = "enabled" ]; then
      pass_check "DNS 解析器正常 (systemd-resolved: active/enabled)"
    else
      fail_check "DNS 解析器异常 (systemd-resolved: ${resolved_state:-unknown}/${resolved_enabled:-unknown})"
    fi
  else
    warn_check "systemd-resolved 服务不存在，请确认当前 DNS 管理方式"
  fi

  log_info "检查系统 redis-server 服务..."
  if systemctl list-unit-files | grep -q "^redis-server\.service"; then
    local system_redis_state
    system_redis_state=$(systemctl is-active redis-server 2>/dev/null || true)
    if [ "$system_redis_state" = "active" ]; then
      warn_check "系统 redis-server 正在运行，当前生产应以 Docker Redis 为准，请确认无端口冲突"
    else
      pass_check "系统 redis-server 未运行（避免与 Docker Redis 混用）"
    fi
  else
    pass_check "系统 redis-server 服务不存在（当前仅使用 Docker Redis）"
  fi

  log_info "检查 /etc/resolv.conf..."
  if [ -e /etc/resolv.conf ] && [ -r /etc/resolv.conf ]; then
    local resolv_target
    resolv_target=$(readlink -f /etc/resolv.conf 2>/dev/null || echo "/etc/resolv.conf")
    if [ -e "$resolv_target" ]; then
      pass_check "/etc/resolv.conf 正常 ($resolv_target)"
    else
      fail_check "/etc/resolv.conf 指向无效目标 ($resolv_target)"
    fi
  else
    fail_check "/etc/resolv.conf 不存在或不可读"
  fi

  # 第 3 步：Docker 容器检查
  log_section "第 3 步：Docker 容器检查"

  log_info "检查运行中的容器..."
  if docker ps | grep -q "morning-reading"; then
    pass_check "应用容器正在运行"
  else
    warn_check "应用容器未找到"
  fi

  log_info "检查 MongoDB 容器..."
  if docker ps | grep -q "morning-reading-mongodb"; then
    pass_check "MongoDB 容器运行中"
  else
    fail_check "MongoDB 容器未运行"
  fi

  log_info "检查 MySQL 容器..."
  if docker ps | grep -q "morning-reading-mysql"; then
    pass_check "MySQL 容器运行中"
  else
    fail_check "MySQL 容器未运行"
  fi

  log_info "检查 Redis 容器..."
  if docker ps | grep -q "morning-reading-redis"; then
    pass_check "Redis 容器运行中"

    local redis_health
    redis_health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' morning-reading-redis 2>/dev/null || true)
    if [ "$redis_health" = "healthy" ]; then
      pass_check "Redis 容器健康检查通过"
    elif [ "$redis_health" = "starting" ] || [ "$redis_health" = "no-healthcheck" ]; then
      warn_check "Redis 容器健康状态未稳定 (${redis_health})"
    else
      fail_check "Redis 容器健康检查失败 (${redis_health:-unknown})"
    fi

    log_info "检查 Redis 认证连通性..."
    if [ -f "$BACKEND_ENV_FILE" ]; then
      local redis_host redis_port redis_password
      redis_host="${REDIS_HOST:-localhost}"
      redis_port="${REDIS_PORT:-26379}"
      redis_password="${REDIS_PASSWORD:-}"

      if command -v redis-cli &>/dev/null && \
        redis-cli -h "$redis_host" -p "$redis_port" -a "$redis_password" ping 2>/dev/null | grep -q "PONG"; then
        pass_check "Redis 认证探测通过 (${redis_host}:${redis_port})"
      elif docker exec morning-reading-redis sh -lc "redis-cli -a \"$redis_password\" ping" 2>/dev/null | grep -q "PONG"; then
        pass_check "Redis 认证探测通过（容器内校验）"
      else
        fail_check "Redis 认证探测失败 (${redis_host}:${redis_port})，请检查密码/端口是否与 .env.production 一致"
      fi
    else
      fail_check "缺少后端生产环境文件，无法验证 Redis 认证状态 ($BACKEND_ENV_FILE)"
    fi
  else
    fail_check "Redis 容器未运行"
  fi

  # 第 4 步：应用检查
  log_section "第 4 步：应用检查"

  log_info "检查后端目录..."
  if [ -d "$BACKEND_DIR" ]; then
    pass_check "后端目录存在"
  else
    fail_check "后端目录不存在"
  fi

  log_info "检查后端生产环境文件..."
  if [ -f "$BACKEND_ENV_FILE" ]; then
    pass_check "后端生产环境文件存在"
  else
    fail_check "后端生产环境文件不存在 ($BACKEND_ENV_FILE)"
  fi

  log_info "检查 Docker 环境文件..."
  if [ -f "$DOCKER_ENV_FILE" ]; then
    pass_check "Docker 环境文件存在"
  else
    fail_check "Docker 环境文件不存在 ($DOCKER_ENV_FILE)"
  fi

  log_info "检查后端依赖..."
  if [ -f "$BACKEND_DIR/package.json" ]; then
    pass_check "后端 package.json 存在"
  else
    fail_check "后端 package.json 不存在"
  fi

  log_info "检查 PM2 应用状态..."
  if pm2 describe "$PM2_APP_NAME" &>/dev/null; then
    local pm2_summary
    pm2_summary=$(pm2 jlist 2>/dev/null | node -e "
      const fs = require('fs');
      const list = JSON.parse(fs.readFileSync(0, 'utf8'));
      const appName = process.argv[1];
      const app = list.filter(item => item.name === appName);
      const total = app.length;
      const online = app.filter(item => item.pm2_env && item.pm2_env.status === 'online').length;
      process.stdout.write(\`\${online}/\${total}\`);
    " "$PM2_APP_NAME")
    local pm2_online=${pm2_summary%%/*}
    local pm2_total=${pm2_summary##*/}
    if [ "$pm2_total" -gt 0 ] && [ "$pm2_online" -eq "$pm2_total" ]; then
      pass_check "PM2 应用在线 ($PM2_APP_NAME: $pm2_summary)"
    else
      fail_check "PM2 应用状态异常 ($PM2_APP_NAME: $pm2_summary)"
    fi
  else
    fail_check "PM2 应用未找到 ($PM2_APP_NAME)"
  fi

  log_info "检查后端文件权限..."
  if [ -r "$BACKEND_DIR" ]; then
    pass_check "后端文件可读"
  else
    fail_check "后端文件不可读"
  fi

  log_info "检查管理后台文件..."
  if [ -f "$ADMIN_DIST/index.html" ]; then
    pass_check "管理后台文件就位"
  else
    warn_check "管理后台 index.html 未找到"
  fi

  # 第 5 步：API 健康检查
  log_section "第 5 步：API 健康检查"

  log_info "检查后端服务（HTTP）..."
  if curl -s "$API_ENDPOINT" | grep -q "ok" 2>/dev/null; then
    pass_check "后端服务正常 ($API_ENDPOINT)"
  else
    warn_check "后端服务可能不可用，请检查日志"
  fi

  log_info "检查后端服务（HTTPS）..."
  if curl -s "$API_ENDPOINT_HTTPS" | grep -q "ok" 2>/dev/null; then
    pass_check "HTTPS 端点正常 ($API_ENDPOINT_HTTPS)"
  else
    warn_check "HTTPS 端点可能不可用"
  fi

  log_info "检查 Nginx 状态..."
  if sudo systemctl is-active --quiet nginx; then
    pass_check "Nginx 运行中"
  else
    fail_check "Nginx 未运行"
  fi

  log_info "检查 Nginx 配置..."
  if sudo nginx -t &>/dev/null; then
    pass_check "Nginx 配置正确"
  else
    fail_check "Nginx 配置有错误"
  fi

  # 第 6 步：SSL 证书检查
  log_section "第 6 步：SSL 证书检查"

  log_info "检查 SSL 证书..."
  if sudo certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    pass_check "SSL 证书存在"

    # 获取证书过期时间
    local expiry_date
    expiry_date=$(sudo certbot certificates 2>/dev/null | awk -v domain="$DOMAIN" '
      $0 ~ ("Domains: " domain "$") { found=1; next }
      found && /Expiry Date:/ {
        sub(/.*Expiry Date: /, "", $0);
        sub(/ \(VALID:.*/, "", $0);
        print;
        exit;
      }
    ')
    if [ -n "$expiry_date" ]; then
      log_info "证书过期时间: $expiry_date"

      # 计算天数
      local expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null || echo 0)
      local now_timestamp=$(date +%s)
      local days_left=$(( (expiry_timestamp - now_timestamp) / 86400 ))

      if [ "$days_left" -gt 30 ]; then
        pass_check "SSL 证书有效期充足 (剩余 $days_left 天)"
      elif [ "$days_left" -gt 0 ]; then
        warn_check "SSL 证书即将过期 (剩余 $days_left 天)"
      else
        fail_check "SSL 证书已过期"
      fi
    fi
  else
    fail_check "SSL 证书未找到"
  fi

  log_info "检查 Certbot 自动续期..."
  if sudo systemctl is-enabled certbot.timer &>/dev/null; then
    pass_check "Certbot 自动续期已启用"
  else
    warn_check "Certbot 自动续期未启用"
  fi

  # 显示摘要
  log_section "验证摘要"

  local percentage=$((CHECKS_PASSED * 100 / CHECKS_TOTAL))
  log_info "总检查数: $CHECKS_TOTAL"
  log_info "✅ 通过: $CHECKS_PASSED"
  log_info "❌ 失败: $CHECKS_FAILED"
  log_info "⚠️  警告: $CHECKS_WARNING"
  log_info "成功率: $percentage%"
  log_info ""

  # 最终状态
  if [ "$CHECKS_FAILED" -eq 0 ]; then
    log_header "验证完成 - 部署正常运行 ✨"
    log_info "所有关键组件都已正确配置，应用可以正常使用。"
    return 0
  elif [ "$CHECKS_FAILED" -le 2 ]; then
    log_header "验证完成 - 部分问题需要关注 ⚠️"
    log_warning "有 $CHECKS_FAILED 个关键问题需要修复，请查阅上面的错误信息。"
    return 1
  else
    log_header "验证失败 - 有多个问题 ❌"
    log_error "有 $CHECKS_FAILED 个关键问题，部署可能无法正常工作。"
    return 1
  fi
}

# 捕获错误时输出
trap 'log_warning "验证过程中出现错误"; exit 1' ERR

main "$@"
