#!/bin/bash

################################################################################
# 生产服务器环境一键安装脚本
# 用途：全新服务器一键安装 Node.js、PM2、Nginx、MongoDB、MySQL、Redis
# 执行位置：服务器上（SSH 登录后执行）
# 使用：bash setup-server-env.sh
################################################################################

set -e  # 任何命令失败都会退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 数据库密码（来自 .env.production）
MONGODB_PASSWORD="p62CWhV0Kd1Unq"
MYSQL_ROOT_PASSWORD="Root@Prod@User0816!"
MYSQL_APP_PASSWORD="Morning@Prod@User0816!"
REDIS_PASSWORD="Redis@Prod@User0816!"

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠️]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_step() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
}

################################################################################
# 步骤 1: 更新 apt 包列表
################################################################################
print_step "步骤 1: 更新 apt 包列表"

print_info "更新包列表..."
sudo apt-get update > /dev/null 2>&1 || {
    print_error "apt-get update 失败"
    exit 1
}
print_success "包列表已更新"

################################################################################
# 步骤 2: 安装 Node.js 20 LTS
################################################################################
print_step "步骤 2: 安装 Node.js 20 LTS"

if command -v node &> /dev/null; then
    print_warning "Node.js 已安装: $(node --version)"
else
    print_info "安装 Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
    sudo apt-get install -y nodejs > /dev/null 2>&1 || {
        print_error "Node.js 安装失败"
        exit 1
    }
    print_success "Node.js $(node --version) 安装成功"
fi

# 验证 Node.js
print_info "验证 Node.js..."
node --version | grep -q "v20" && print_success "Node.js v20 验证通过" || {
    print_error "Node.js 版本不对，需要 v20"
    exit 1
}

################################################################################
# 步骤 3: 安装 PM2
################################################################################
print_step "步骤 3: 安装 PM2"

if sudo npm list -g pm2 &> /dev/null; then
    print_warning "PM2 已安装: $(pm2 --version)"
else
    print_info "安装 PM2..."
    sudo npm install -g pm2 > /dev/null 2>&1 || {
        print_error "PM2 安装失败"
        exit 1
    }
    print_success "PM2 $(pm2 --version) 安装成功"
fi

################################################################################
# 步骤 4: 安装 Nginx
################################################################################
print_step "步骤 4: 安装 Nginx"

if command -v nginx &> /dev/null; then
    print_warning "Nginx 已安装: $(nginx -v 2>&1)"
else
    print_info "安装 Nginx..."
    sudo apt-get install -y nginx > /dev/null 2>&1 || {
        print_error "Nginx 安装失败"
        exit 1
    }
    sudo systemctl enable nginx > /dev/null 2>&1
    sudo systemctl start nginx > /dev/null 2>&1
    print_success "Nginx 安装成功"
fi

################################################################################
# 步骤 5: 安装 MongoDB 7.0
################################################################################
print_step "步骤 5: 安装 MongoDB 7.0"

if command -v mongosh &> /dev/null; then
    print_warning "MongoDB 已安装"
else
    print_info "添加 MongoDB 官方源..."
    wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list > /dev/null

    print_info "更新包列表..."
    sudo apt-get update > /dev/null 2>&1

    print_info "安装 MongoDB..."
    sudo apt-get install -y mongodb-org > /dev/null 2>&1 || {
        print_error "MongoDB 安装失败"
        exit 1
    }

    print_info "启动 MongoDB 服务..."
    sudo systemctl enable mongod > /dev/null 2>&1
    sudo systemctl start mongod > /dev/null 2>&1
    sleep 2

    print_success "MongoDB 7.0 安装成功"
fi

# 配置 MongoDB 管理员账号
print_info "配置 MongoDB 管理员账号..."
sudo mongosh --eval "use admin; db.createUser({user:'admin', pwd:'${MONGODB_PASSWORD}', roles:['root']})" 2>/dev/null || \
    print_warning "MongoDB 管理员可能已存在"

# 启用 MongoDB 认证
print_info "启用 MongoDB 认证..."
sudo sed -i 's/#security:/security:/' /etc/mongod.conf
sudo sed -i '/^security:/a\  authorization: enabled' /etc/mongod.conf
sudo systemctl restart mongod > /dev/null 2>&1
print_success "MongoDB 认证已启用"

################################################################################
# 步骤 6: 安装 MySQL 8
################################################################################
print_step "步骤 6: 安装 MySQL 8"

if command -v mysql &> /dev/null; then
    print_warning "MySQL 已安装"
else
    print_info "安装 MySQL 8..."
    sudo apt-get install -y mysql-server > /dev/null 2>&1 || {
        print_error "MySQL 安装失败"
        exit 1
    }
    sudo systemctl enable mysql > /dev/null 2>&1
    sudo systemctl start mysql > /dev/null 2>&1
    print_success "MySQL 8 安装成功"
fi

# 配置 MySQL
print_info "配置 MySQL root 密码..."
sudo mysql -u root << SQL 2>/dev/null || print_warning "MySQL 配置可能已存在"
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${MYSQL_ROOT_PASSWORD}';
CREATE DATABASE IF NOT EXISTS morning_reading CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'morning_user'@'localhost' IDENTIFIED BY '${MYSQL_APP_PASSWORD}';
GRANT ALL PRIVILEGES ON morning_reading.* TO 'morning_user'@'localhost';
FLUSH PRIVILEGES;
SQL

print_success "MySQL 配置完成"

################################################################################
# 步骤 7: 安装 Redis 7
################################################################################
print_step "步骤 7: 安装 Redis 7"

if command -v redis-cli &> /dev/null; then
    print_warning "Redis 已安装: $(redis-server --version)"
else
    print_info "安装 Redis 7..."
    sudo apt-get install -y redis-server > /dev/null 2>&1 || {
        print_error "Redis 安装失败"
        exit 1
    }
    sudo systemctl enable redis-server > /dev/null 2>&1
    print_success "Redis 7 安装成功"
fi

# 配置 Redis 密码
print_info "配置 Redis 密码..."
sudo sed -i "s/# requirepass foobared/requirepass ${REDIS_PASSWORD}/" /etc/redis/redis.conf
sudo systemctl restart redis-server > /dev/null 2>&1
print_success "Redis 密码已配置"

################################################################################
# 步骤 8: 验证所有服务
################################################################################
print_step "步骤 8: 验证所有服务"

# 验证 Node.js
print_info "验证 Node.js..."
if node --version | grep -q "v20"; then
    print_success "Node.js $(node --version)"
else
    print_error "Node.js 验证失败"
fi

# 验证 PM2
print_info "验证 PM2..."
if pm2 --version &>/dev/null; then
    print_success "PM2 $(pm2 --version)"
else
    print_error "PM2 验证失败"
fi

# 验证 Nginx
print_info "验证 Nginx..."
if sudo systemctl is-active --quiet nginx; then
    print_success "Nginx 运行正常"
else
    print_error "Nginx 未运行"
fi

# 验证 MongoDB
print_info "验证 MongoDB..."
if mongosh -u admin -p "${MONGODB_PASSWORD}" --eval "db.runCommand({ping:1})" 2>/dev/null | grep -q "ok"; then
    print_success "MongoDB 连接成功"
else
    print_error "MongoDB 连接失败"
fi

# 验证 MySQL
print_info "验证 MySQL..."
if mysql -u morning_user -p"${MYSQL_APP_PASSWORD}" morning_reading -e "SELECT 1" &>/dev/null; then
    print_success "MySQL 连接成功"
else
    print_error "MySQL 连接失败"
fi

# 验证 Redis
print_info "验证 Redis..."
if redis-cli -a "${REDIS_PASSWORD}" ping 2>/dev/null | grep -q "PONG"; then
    print_success "Redis 连接成功"
else
    print_error "Redis 连接失败"
fi

################################################################################
# 安装完成
################################################################################
print_step "安装完成！ 🎉"

echo ""
echo -e "${GREEN}服务器环境已完全准备就绪！${NC}"
echo ""
echo -e "${BLUE}关键信息：${NC}"
echo "  • MongoDB:  mongodb://admin:***@127.0.0.1:27017/admin"
echo "  • MySQL:    morning_user@127.0.0.1:3306/morning_reading"
echo "  • Redis:    127.0.0.1:6379"
echo ""
echo -e "${BLUE}下一步：${NC}"
echo "  1. 返回本地，执行部署脚本："
echo "     bash scripts/deploy-to-server.sh"
echo ""
echo "  2. SSH 到服务器验证安装："
echo "     ssh ubuntu@118.25.145.179"
echo "     mongosh -u admin -p --eval 'db.runCommand({ping:1})'"
echo "     mysql -u morning_user -p -e 'SELECT 1'"
echo "     redis-cli -a PASSWD ping"
echo ""
echo -e "${YELLOW}密码提醒：${NC}"
echo "  • MongoDB:  ${MONGODB_PASSWORD}"
echo "  • MySQL:    ${MYSQL_APP_PASSWORD}"
echo "  • Redis:    ${REDIS_PASSWORD}"
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
