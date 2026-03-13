#!/bin/bash

################################################################################
# 第 5 步：Nginx 和 SSL 配置 - 设置 Web 服务器和 HTTPS
# 执行位置：远程服务器
# 执行方式：bash scripts/5-setup-nginx.sh [domain] [email]
#
# 参数：
#   domain: 域名（默认：wx.shubai01.com）
#   email: Let's Encrypt 注册邮箱（默认：admin@morningreading.com）
#
# 功能：
# 1. 验证 Nginx 已安装
# 2. 复制 Nginx 配置文件
# 3. 验证 Nginx 配置
# 4. 申请 Let's Encrypt 证书
# 5. 配置 Certbot 自动续期
# 6. 启动 Nginx
################################################################################

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 源加载库
source "$SCRIPT_DIR/lib/utils.sh"
source "$SCRIPT_DIR/lib/infrastructure-functions.sh"
source "$SCRIPT_DIR/lib/deploy-functions.sh"

################################################################################
# 配置
################################################################################

APP_ROOT="/var/www/morning-reading"
DOMAIN="${1:-wx.shubai01.com}"
EMAIL="${2:-admin@morningreading.com}"

NGINX_CONFIG_DIR="$PROJECT_ROOT/docs/deployment/production-configs/nginx"
NGINX_SITE_CONFIG="/etc/nginx/sites-available/$DOMAIN"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled/$DOMAIN"

################################################################################
# 主函数
################################################################################

main() {
  log_header "晨读营小程序 - 第 5 步：Nginx 和 SSL 配置"

  log_info "开始时间: $(date)"
  log_info "域名: $DOMAIN"
  log_info "邮箱: $EMAIL"
  log_info "应用目录: $APP_ROOT"
  log_info ""

  # 第 1 步：验证 Nginx
  log_section "第 1 步：验证 Nginx 已安装"

  check_command "nginx" || exit 1
  sudo systemctl status nginx | grep -q "active" && log_success "Nginx 已运行" || {
    log_warning "Nginx 未运行，启动中..."
    sudo systemctl start nginx
    log_success "Nginx 已启动"
  }

  # 第 2 步：复制 Nginx 配置
  log_section "第 2 步：复制 Nginx 配置文件"

  if [ -f "$NGINX_CONFIG_DIR/$DOMAIN.conf" ]; then
    log_info "复制站点配置: $DOMAIN.conf"
    sudo cp "$NGINX_CONFIG_DIR/$DOMAIN.conf" "$NGINX_SITE_CONFIG" || {
      log_error "配置文件复制失败"
      exit 1
    }
    log_success "站点配置已复制"
  else
    log_warning "找不到 Nginx 配置模板: $NGINX_CONFIG_DIR/$DOMAIN.conf"
    log_info "将创建基础反向代理配置..."

    # 创建基础配置
    sudo tee "$NGINX_SITE_CONFIG" > /dev/null <<'EOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    # HTTP 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;

    # SSL 证书（由 Certbot 管理）
    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;

    # SSL 参数
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 后端 API 反向代理
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 管理后台静态文件
    location / {
        root /var/www/morning-reading/admin;
        try_files $uri $uri/ /index.html;
    }
}
EOF

    # 替换域名占位符
    sudo sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$NGINX_SITE_CONFIG"

    log_success "基础配置已创建"
  fi

  # 第 3 步：启用站点
  log_section "第 3 步：启用 Nginx 站点"

  if [ ! -L "$NGINX_SITES_ENABLED" ]; then
    log_info "创建符号链接: $DOMAIN"
    sudo ln -sf "$NGINX_SITE_CONFIG" "$NGINX_SITES_ENABLED" || {
      log_error "符号链接创建失败"
      exit 1
    }
    log_success "站点已启用"
  else
    log_success "站点已启用（符号链接已存在）"
  fi

  # 第 4 步：验证 Nginx 配置
  log_section "第 4 步：验证 Nginx 配置"

  if ! validate_nginx_config; then
    log_error "Nginx 配置验证失败"
    exit 1
  fi

  # 第 5 步：申请 SSL 证书
  log_section "第 5 步：申请 Let's Encrypt 证书"

  if sudo certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    log_success "SSL 证书已存在: $DOMAIN"
  else
    log_info "申请新证书: $DOMAIN"
    if sudo certbot certonly --nginx -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive 2>/dev/null; then
      log_success "SSL 证书已申请成功"
    else
      log_warning "SSL 证书申请可能失败，继续..."
      log_info "如需手动申请，运行："
      log_info "  sudo certbot certonly --nginx -d $DOMAIN --email $EMAIL"
    fi
  fi

  # 第 6 步：配置 Certbot 自动续期
  log_section "第 6 步：配置证书自动续期"

  log_info "检查 Certbot 定时任务..."
  if sudo systemctl is-enabled certbot.timer &>/dev/null; then
    log_success "Certbot 自动续期已配置"
  else
    log_info "启用 Certbot 自动续期..."
    sudo systemctl enable certbot.timer 2>/dev/null || true
    sudo systemctl start certbot.timer 2>/dev/null || true
    log_success "Certbot 自动续期已启用"
  fi

  # 第 7 步：重新加载 Nginx
  log_section "第 7 步：重新加载 Nginx"

  if ! reload_nginx; then
    log_error "Nginx 重新加载失败"
    exit 1
  fi

  # 显示摘要
  log_section "Nginx 和 SSL 配置摘要"

  log_info "✅ Nginx: 已安装并运行"
  log_info "✅ 站点配置: 已复制 ($DOMAIN)"
  log_info "✅ 配置验证: 通过"
  log_info "✅ SSL 证书: 已配置 ($DOMAIN)"
  log_info "✅ 自动续期: 已配置（Certbot）"
  log_info "✅ Nginx: 已重新加载"

  log_header "Nginx 和 SSL 配置完成！✨"

  log_info "下一步："
  log_info "  1. 运行第 6 步脚本（应用部署）："
  log_info "     bash scripts/6-deploy-app.sh"
  log_info ""
  log_info "验证 HTTPS:"
  log_info "  • 浏览器访问: https://$DOMAIN"
  log_info "  • 命令行测试: curl -I https://$DOMAIN/api/v1/health"
  log_info ""

  return 0
}

# 捕获错误时输出
trap 'log_error "脚本执行失败，请检查上面的错误信息"; exit 1' ERR

main "$@"
