#!/bin/bash

################################################################################
# Nginx Authorization 请求头转发修复脚本
# 功能：自动修改线上 Nginx 配置，添加 Authorization 请求头转发
# 执行位置：本地 Mac
# 执行方式：bash scripts/fix-nginx-auth.sh
################################################################################

################################################################################
# 配置
################################################################################

# 服务器配置
SERVER_IP="118.25.145.179"
SERVER_USER="ubuntu"
SSH_KEY="$HOME/.ssh/id_rsa"
NGINX_CONFIG="/etc/nginx/sites-available/wx.shubai01.com"
NGINX_BACKUP="/etc/nginx/sites-available/wx.shubai01.com.backup.$(date +%Y%m%d_%H%M%S)"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

################################################################################
# 日志函数
################################################################################

log_header() {
  echo -e "\n${MAGENTA}═══════════════════════════════════════════════════════${NC}"
  echo -e "${MAGENTA}$1${NC}"
  echo -e "${MAGENTA}═══════════════════════════════════════════════════════${NC}\n"
}

log_section() {
  echo -e "\n${BLUE}━━━ $1 ━━━${NC}"
}

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
  echo -e "${RED}[✗]${NC} $1"
}

################################################################################
# 检查依赖
################################################################################

check_dependencies() {
  log_section "检查依赖"

  # 检查 ssh
  if ! command -v ssh &> /dev/null; then
    log_error "ssh 未安装"
    exit 1
  fi
  log_success "ssh 已安装"

  # 检查 SSH 密钥
  if [ ! -f "$SSH_KEY" ]; then
    log_error "SSH 密钥不存在: $SSH_KEY"
    exit 1
  fi
  log_success "SSH 密钥已找到"
}

################################################################################
# 测试 SSH 连接
################################################################################

test_ssh_connection() {
  log_section "测试 SSH 连接"

  if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "$SERVER_USER@$SERVER_IP" "echo 'SSH 连接成功'" 2>/dev/null; then
    log_success "SSH 连接成功"
    return 0
  else
    log_error "无法连接到服务器 $SERVER_IP"
    log_info "请检查:"
    log_info "1. SSH 密钥 $SSH_KEY 是否正确"
    log_info "2. 服务器 IP 是否正确"
    log_info "3. 网络连接是否正常"
    exit 1
  fi
}

################################################################################
# 修复 Nginx 配置
################################################################################

fix_nginx_config() {
  log_section "修复 Nginx 配置"

  # 构建 Nginx 修复脚本
  local nginx_fix_script=$(cat <<'NGINX_FIX_EOF'
#!/bin/bash

NGINX_CONFIG="/etc/nginx/sites-available/wx.shubai01.com"
NGINX_BACKUP="/etc/nginx/sites-available/wx.shubai01.com.backup.$(date +%Y%m%d_%H%M%S)"

# 颜色输出
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[⚠]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

# 1. 检查配置文件是否存在
if [ ! -f "$NGINX_CONFIG" ]; then
  log_error "Nginx 配置文件不存在: $NGINX_CONFIG"
  exit 1
fi

log_info "找到 Nginx 配置文件"

# 2. 备份原始配置
log_info "正在备份配置文件..."
sudo cp "$NGINX_CONFIG" "$NGINX_BACKUP"
log_success "备份完成: $NGINX_BACKUP"

# 3. 检查是否已经包含 Authorization 请求头转发
if grep -q "proxy_set_header Authorization" "$NGINX_CONFIG"; then
  log_warning "配置文件已包含 Authorization 请求头转发，无需修改"
  exit 0
fi

# 4. 修改配置文件（在 location /api/ 块中添加 Authorization 请求头转发）
log_info "正在修改 Nginx 配置..."

# 使用 sed 进行修改
# 查找 "location /api/" 块，在其中的 "proxy_pass" 后面添加请求头转发配置
sudo sed -i '/location \/api\/ {/,/^[[:space:]]*}/ {
  /proxy_pass http:\/\// a\
\
        # 转发请求头（特别是 Authorization）\
        proxy_pass_request_headers on;\
        proxy_set_header Authorization $http_authorization;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_set_header X-Forwarded-Host $server_name;\
        proxy_set_header X-Forwarded-Port $server_port;
}' "$NGINX_CONFIG"

log_success "Nginx 配置已修改"

# 5. 验证 Nginx 配置语法
log_info "验证 Nginx 配置语法..."
if sudo nginx -t 2>&1 | grep -q "successful"; then
  log_success "Nginx 配置语法正确"
else
  log_error "Nginx 配置语法有误，正在恢复备份..."
  sudo cp "$NGINX_BACKUP" "$NGINX_CONFIG"
  log_error "配置已恢复为备份版本"
  echo ""
  echo "错误详情："
  sudo nginx -t
  exit 1
fi

# 6. 重新加载 Nginx
log_info "重新加载 Nginx..."
if sudo systemctl reload nginx; then
  log_success "Nginx 已重新加载"
else
  log_error "Nginx 重新加载失败，正在恢复备份..."
  sudo cp "$NGINX_BACKUP" "$NGINX_CONFIG"
  sudo systemctl reload nginx
  log_error "配置已恢复为备份版本"
  exit 1
fi

log_success "Nginx 配置修复完成！"
echo ""
echo "修改内容："
echo "  • 在 /api/ location 块中添加 Authorization 请求头转发"
echo "  • 添加其他必要的代理请求头（X-Real-IP, X-Forwarded-* 等）"
echo ""
echo "备份文件位置："
echo "  $NGINX_BACKUP"
NGINX_FIX_EOF
)

  # 执行 Nginx 修复脚本
  if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" bash -s <<< "$nginx_fix_script"; then
    log_success "Nginx 配置修复成功！"
  else
    log_error "Nginx 配置修复失败"
    exit 1
  fi
}

################################################################################
# 验证修复结果
################################################################################

verify_fix() {
  log_section "验证修复结果"

  log_info "检查 Authorization 请求头转发配置是否已添加..."

  if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
    "grep -A 10 'location /api/' /etc/nginx/sites-available/wx.shubai01.com | grep -q 'proxy_set_header Authorization'" 2>/dev/null; then
    log_success "Authorization 请求头转发配置已正确添加！"
  else
    log_warning "无法验证配置是否已添加（可能 grep 返回格式不同）"
    log_info "您可以手动检查："
    log_info "  ssh ubuntu@$SERVER_IP"
    log_info "  grep -n 'proxy_set_header Authorization' /etc/nginx/sites-available/wx.shubai01.com"
  fi
}

################################################################################
# 清理并总结
################################################################################

summary() {
  log_section "修复完成总结"

  echo ""
  echo "下一步操作："
  echo ""
  echo "  1️⃣  清除浏览器缓存（在管理后台所在的浏览器中）："
  echo "      • 按 Ctrl+Shift+Delete（Windows）或 Cmd+Shift+Delete（Mac）"
  echo ""
  echo "  2️⃣  硬刷新管理后台页面："
  echo "      • 按 Ctrl+Shift+R（Windows）或 Cmd+Shift+R（Mac）"
  echo ""
  echo "  3️⃣  重新登录管理后台"
  echo ""
  echo "  4️⃣  打开审计日志页面，验证是否还有 401 错误"
  echo ""
  echo "如果仍然有问题，请检查："
  echo ""
  echo "  • 后端日志："
  echo "    ssh ubuntu@$SERVER_IP"
  echo "    tail -f /var/www/morning-reading/backend/logs/app.log | grep 'Authorization'"
  echo ""
  echo "  • Nginx 配置："
  echo "    ssh ubuntu@$SERVER_IP"
  echo "    sudo cat /etc/nginx/sites-available/wx.shubai01.com | grep -A 20 'location /api/'"
  echo ""
  echo "  • 如需回滚配置，使用以下命令："
  echo "    ssh ubuntu@$SERVER_IP"
  echo "    sudo cp $NGINX_BACKUP /etc/nginx/sites-available/wx.shubai01.com"
  echo "    sudo systemctl reload nginx"
  echo ""
}

################################################################################
# 主函数
################################################################################

main() {
  log_header "🚀 Nginx Authorization 请求头转发修复"

  check_dependencies
  test_ssh_connection
  fix_nginx_config
  verify_fix
  summary

  log_header "✅ 所有操作完成！"
}

# 执行主函数
main
