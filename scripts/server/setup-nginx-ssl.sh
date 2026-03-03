#!/bin/bash
# ========================================
# Nginx 和 SSL 证书配置脚本
# ========================================
# 用途：在服务器上配置 Nginx 虚拟主机和 SSL 证书过期通知
# 执行位置：服务器上
# 执行方式：bash scripts/server/setup-nginx-ssl.sh

set -e

DOMAIN="wx.shubai01.com"
EMAIL="308965039@qq.com"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📝 配置 Nginx 和 SSL 证书..."
echo ""

# ========================================
# 1️⃣ 配置 Nginx 虚拟主机
# ========================================
echo "1️⃣ 配置 Nginx 虚拟主机..."

sudo tee /etc/nginx/sites-available/wx.shubai01.com > /dev/null << 'NGINX'
server {
    server_name wx.shubai01.com;

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # 健康检查端点
    location /health {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 登录页面重定向到管理后台
    location = /login {
        return 301 /admin;
    }

    # 管理后台静态文件
    location /admin {
        alias /var/www/morning-reading/admin/dist;
        try_files $uri $uri/ /admin/index.html;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 默认首页重定向到管理后台
    location = / {
        return 301 /admin;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/wx.shubai01.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wx.shubai01.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    listen 80;
    server_name wx.shubai01.com;
    return 301 https://$host$request_uri;
}
NGINX

echo "✓ Nginx 配置已创建"

# 启用配置
sudo ln -sf /etc/nginx/sites-available/wx.shubai01.com /etc/nginx/sites-enabled/ 2>/dev/null || true

# 验证 Nginx 配置
echo "  验证 Nginx 配置..."
if sudo nginx -t > /dev/null 2>&1; then
    echo "  ✓ Nginx 配置正确"
    sudo systemctl reload nginx
    echo "  ✓ Nginx 已重启"
else
    echo "  ❌ Nginx 配置有误，请检查"
    exit 1
fi

echo ""

# ========================================
# 2️⃣ 创建 Certbot 续期通知脚本
# ========================================
echo "2️⃣ 创建 Certbot 续期通知脚本..."

sudo tee /usr/local/bin/certbot-renewal-hook.sh > /dev/null << 'HOOK'
#!/bin/bash
# Certbot 续期通知脚本

DOMAIN="wx.shubai01.com"
EMAIL="308965039@qq.com"
LOG_FILE="/var/log/certbot-renewal.log"

# 记录续期事件
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Certificate renewal completed for $DOMAIN" >> $LOG_FILE

# 如果已安装 mail 命令，发送邮件通知
if command -v mail &> /dev/null; then
    {
        echo "SSL 证书续期完成"
        echo ""
        echo "域名: $DOMAIN"
        echo "续期时间: $(date '+%Y-%m-%d %H:%M:%S')"
        echo "新过期时间: 2026-06-01"
        echo ""
        echo "证书已自动续期成功。无需手动操作。"
    } | mail -s "[系统通知] SSL 证书续期完成: $DOMAIN" "$EMAIL"
fi
HOOK

sudo chmod +x /usr/local/bin/certbot-renewal-hook.sh
echo "✓ 续期通知脚本已创建"

echo ""

# ========================================
# 3️⃣ 配置 Certbot 邮件通知
# ========================================
echo "3️⃣ 配置 Certbot 邮件通知..."

if [ -f /etc/letsencrypt/renewal/wx.shubai01.com.conf ]; then
    # 添加邮件地址和续期钩子
    sudo bash -c "grep -q 'email = ' /etc/letsencrypt/renewal/wx.shubai01.com.conf || \
        echo '
# 邮件通知配置
email = $EMAIL
renew_hook = /usr/local/bin/certbot-renewal-hook.sh' >> /etc/letsencrypt/renewal/wx.shubai01.com.conf"
    echo "✓ Certbot 邮件通知已配置"
else
    echo "⚠️ Certbot 续期配置文件不存在，请先申请证书"
fi

echo ""
echo "✅ 所有配置完成！"
echo ""
echo "验证命令:"
echo "  - 检查 Nginx: curl -I https://wx.shubai01.com/api/v1/health"
echo "  - 查看日志: tail -f /var/log/certbot-renewal.log"
