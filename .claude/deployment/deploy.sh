#!/bin/bash

################################################################################
# 🚀 晨读营小程序 - 一键部署脚本
#
# 用途：自动部署后端服务、管理后台、配置Nginx和SSL
# 使用：bash deploy.sh <服务器IP> <操作>
#
# 操作选项：
#   init     - 初始化服务器环境（仅需执行一次）
#   deploy   - 部署后端和前端
#   update   - 更新代码并重启服务
#   status   - 查看服务状态
#   logs     - 查看服务日志
################################################################################

set -e

# 配置颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置变量
REPO_URL="https://github.com/flylion816/Morning_Reading_Club.git"
BRANCH="main"
BACKEND_PATH="/var/www/morning-reading/backend"
ADMIN_PATH="/var/www/morning-reading/admin"
SERVER_USER="ubuntu"
DEPLOY_USER=$(whoami)

# 日志函数
log_info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} ℹ️  $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} ✅ $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')]${NC} ⚠️  $1"
}

log_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')]${NC} ❌ $1"
}

# 检查参数
if [ $# -lt 1 ]; then
    echo -e "${YELLOW}使用方法：${NC}"
    echo "  bash deploy.sh <服务器IP> [操作]"
    echo ""
    echo -e "${YELLOW}操作选项：${NC}"
    echo "  init     - 初始化服务器环境"
    echo "  deploy   - 部署后端和前端（默认）"
    echo "  update   - 更新代码"
    echo "  status   - 查看状态"
    echo "  logs     - 查看日志"
    echo ""
    echo -e "${YELLOW}示例：${NC}"
    echo "  bash deploy.sh 123.207.223.93 init"
    echo "  bash deploy.sh 123.207.223.93 deploy"
    echo "  bash deploy.sh 123.207.223.93 update"
    exit 1
fi

SERVER_IP=$1
OPERATION=${2:-deploy}

################################################################################
# 1️⃣ 初始化服务器
################################################################################
init_server() {
    log_info "开始初始化服务器..."

    ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
set -e

log_info() { echo "[$(date +'%H:%M:%S')] ℹ️  $1"; }
log_success() { echo "[$(date +'%H:%M:%S')] ✅ $1"; }

# 更新系统
log_info "更新系统软件包..."
sudo apt-get update
sudo apt-get upgrade -y

# 安装Git
log_info "安装Git..."
sudo apt-get install -y git

# 安装Node.js
log_info "安装Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证Node.js安装
log_success "Node.js $(node -v)"
log_success "npm $(npm -v)"

# 安装PM2
log_info "安装PM2..."
sudo npm install -g pm2

# 安装Nginx
log_info "安装Nginx..."
sudo apt-get install -y nginx

# 启动Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
log_success "Nginx已启动"

# 创建部署目录
log_info "创建部署目录..."
sudo mkdir -p /var/www/morning-reading/backend
sudo mkdir -p /var/www/morning-reading/admin
sudo mkdir -p /var/www/morning-reading/backups
sudo mkdir -p /etc/nginx/ssl
sudo chown -R ubuntu:ubuntu /var/www/morning-reading
sudo chown -R ubuntu:ubuntu /var/www/morning-reading/backups

# 配置防火墙（如果需要）
log_info "配置防火墙..."
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw allow 3000/tcp || true

log_success "服务器初始化完成！"
EOF

    log_success "✅ 服务器初始化完成"
}

################################################################################
# 2️⃣ 部署后端服务
################################################################################
deploy_backend() {
    log_info "开始部署后端服务..."

    ssh ${SERVER_USER}@${SERVER_IP} << EOF
set -e

log_info() { echo "[INFO] \$1"; }
log_success() { echo "[SUCCESS] \$1"; }

# 进入后端目录
cd ${BACKEND_PATH}

# 克隆或更新代码
log_info "从GitHub拉取代码..."
if [ -d ".git" ]; then
    git pull origin ${BRANCH}
else
    git clone --single-branch -b ${BRANCH} ${REPO_URL} temp
    cp -r temp/backend/* .
    rm -rf temp
fi

# 清理不需要的文件
log_info "清理开发文件..."
rm -f .gitignore .env.example
rm -rf .git node_modules package-lock.json

# 安装生产依赖
log_info "安装依赖..."
npm install --production

# 检查.env文件
if [ ! -f ".env" ]; then
    log_info "请创建 .env 文件，内容参考："
    echo "NODE_ENV=production"
    echo "PORT=3000"
    echo "MONGODB_URI=mongodb://..."
    echo "API_BASE_URL=https://你的域名/api/v1"
    echo "JWT_SECRET=你的密钥"
    echo "WECHAT_APPID=你的AppID"
    echo "WECHAT_SECRET=你的Secret"
    exit 1
fi

# 启动PM2
log_info "启动PM2服务..."
pm2 delete morning-reading-api || true
pm2 start src/server.js --name "morning-reading-api" --instances 2 --exec-mode cluster
pm2 save
pm2 startup || true

# 验证服务
log_info "等待服务启动..."
sleep 3
curl -f http://localhost:3000/api/v1/health || { log_info "服务启动失败"; exit 1; }

log_success "后端服务启动成功！"
EOF

    log_success "✅ 后端部署完成"
}

################################################################################
# 3️⃣ 部署前端Admin
################################################################################
deploy_admin() {
    log_info "开始部署管理后台..."

    # 本地构建
    if [ ! -d "admin" ]; then
        log_error "找不到admin目录，请确保在项目根目录执行"
        return 1
    fi

    log_info "本地构建Admin..."
    cd admin
    npm install > /dev/null 2>&1
    npm run build
    cd ..

    # 上传到服务器
    log_info "上传构建文件到服务器..."
    ssh ${SERVER_USER}@${SERVER_IP} "rm -rf ${ADMIN_PATH}/dist"
    scp -r admin/dist ${SERVER_USER}@${SERVER_IP}:${ADMIN_PATH}/

    log_success "✅ 前端部署完成"
}

################################################################################
# 4️⃣ 配置Nginx
################################################################################
configure_nginx() {
    log_info "配置Nginx反向代理..."

    # 获取用户输入
    read -p "请输入你的域名（如：morningreading.cn）: " DOMAIN
    if [ -z "$DOMAIN" ]; then
        log_error "域名不能为空"
        return 1
    fi

    ssh ${SERVER_USER}@${SERVER_IP} << EOFNGINX
set -e

# 写入Nginx配置
sudo tee /etc/nginx/sites-available/default > /dev/null << 'EOFCONF'
# 后端API负载均衡
upstream backend {
    server localhost:3000;
    server localhost:3001;
    keepalive 32;
}

# HTTP自动重定向到HTTPS
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$server_name\$request_uri;
}

# HTTPS主配置
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};

    # SSL证书配置（使用Let's Encrypt或阿里云证书）
    ssl_certificate /etc/nginx/ssl/certificate.crt;
    ssl_certificate_key /etc/nginx/ssl/private.key;

    # SSL安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 日志配置
    access_log /var/log/nginx/morning-reading-access.log;
    error_log /var/log/nginx/morning-reading-error.log;

    # 上传文件大小限制
    client_max_body_size 10M;

    # API请求代理
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";

        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # 缓冲配置
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }

    # 管理后台（SPA）
    location /admin {
        alias /var/www/morning-reading/admin/dist;
        try_files \$uri \$uri/ /admin/index.html;

        # 静态文件缓存
        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }

    # 小程序业务域名验证
    location ~ /MP_verify_[a-zA-Z0-9]+\\.txt\$ {
        root /var/www/morning-reading/backend/public;
    }

    # 根路径重定向到admin
    location = / {
        return 301 /admin/;
    }

    # 健康检查
    location /health {
        proxy_pass http://backend/api/v1/health;
        access_log off;
    }
}
EOFCONF

# 检查Nginx配置
echo "检查Nginx配置..."
sudo nginx -t

# 重启Nginx
echo "重启Nginx..."
sudo systemctl restart nginx

echo "✅ Nginx配置完成"
echo "访问地址: https://${DOMAIN}/admin"
EOFNGINX

    log_success "✅ Nginx配置完成"
}

################################################################################
# 5️⃣ 配置SSL证书
################################################################################
setup_ssl() {
    log_info "配置SSL证书..."

    read -p "请输入你的域名: " DOMAIN

    ssh ${SERVER_USER}@${SERVER_IP} << EOFSSL
# 安装Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 申请证书
sudo certbot certonly --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos -m admin@${DOMAIN}

# 复制证书到Nginx目录
sudo cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem /etc/nginx/ssl/certificate.crt
sudo cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem /etc/nginx/ssl/private.key

# 配置自动续期
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

echo "✅ SSL证书配置完成"
echo "证书有效期: 90天"
echo "自动续期: 已启用（到期前30天自动续期）"
EOFSSL

    log_success "✅ SSL证书配置完成"
}

################################################################################
# 6️⃣ 更新代码
################################################################################
update_code() {
    log_info "更新代码..."

    ssh ${SERVER_USER}@${SERVER_IP} << EOF
cd ${BACKEND_PATH}
git pull origin ${BRANCH}
npm install --production
pm2 restart morning-reading-api
echo "✅ 代码更新完成"
EOF

    log_success "✅ 代码更新完成"
}

################################################################################
# 7️⃣ 查看服务状态
################################################################################
check_status() {
    log_info "查看服务状态..."

    ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
echo "=== PM2服务状态 ==="
pm2 status

echo ""
echo "=== Nginx状态 ==="
sudo systemctl status nginx | grep Active

echo ""
echo "=== API健康检查 ==="
curl -s http://localhost:3000/api/v1/health || echo "API未响应"

echo ""
echo "=== 磁盘使用情况 ==="
df -h /var/www/morning-reading

echo ""
echo "=== 内存使用情况 ==="
free -h | head -2
EOF

    log_success "✅ 状态检查完成"
}

################################################################################
# 8️⃣ 查看日志
################################################################################
view_logs() {
    log_info "查看服务日志..."

    ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
echo "=== 最新的应用日志 ==="
pm2 logs --lines 50 --nostream morning-reading-api

echo ""
echo "=== 最新的Nginx访问日志 ==="
tail -20 /var/log/nginx/morning-reading-access.log

echo ""
echo "=== 最新的Nginx错误日志 ==="
tail -20 /var/log/nginx/morning-reading-error.log
EOF

    log_success "✅ 日志查看完成"
}

################################################################################
# 主流程
################################################################################

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       🚀 晨读营小程序 - 一键部署脚本                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

case ${OPERATION} in
    init)
        init_server
        ;;
    deploy)
        deploy_backend
        deploy_admin
        configure_nginx
        setup_ssl
        ;;
    update)
        update_code
        ;;
    status)
        check_status
        ;;
    logs)
        view_logs
        ;;
    *)
        log_error "未知操作: ${OPERATION}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ 部署完成！                                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
log_info "后端API: https://你的域名/api/v1"
log_info "管理后台: https://你的域名/admin"
log_info "查看日志: bash deploy.sh ${SERVER_IP} logs"
log_info "查看状态: bash deploy.sh ${SERVER_IP} status"
