#!/bin/bash

################################################################################
# 晨读营线上部署脚本 - 数据库访问密码安全更新
################################################################################
# 功能：
#   1. 备份当前 .env.production 配置
#   2. 检查 MongoDB 连接
#   3. 自动添加 ADMIN_DB_ACCESS_PASSWORD 环境变量
#   4. 执行 reset-admin-password.js 脚本更新管理员密码
#   5. 验证部署成功
################################################################################

set -e  # 遇到错误立即退出

# ============================================================================
# 颜色定义
# ============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# 配置变量
# ============================================================================
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BACKEND_DIR="$PROJECT_ROOT/backend"
ENV_FILE="$BACKEND_DIR/.env.production"
BACKUP_DIR="$PROJECT_ROOT/.backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/.env.production.backup.$TIMESTAMP"

# 新的密码配置（生产环境安全密码）
ADMIN_LOGIN_PASSWORD="Km7\$Px2Qw9"           # 管理员登录密码
ADMIN_DB_ACCESS_PASSWORD="Jb3#Rl8Tn5"        # 数据库访问验证密码
MYSQL_PASSWORD="Prod_User@Secure123!"        # MySQL用户密码
REDIS_PASSWORD="Prod_Redis@Secure123!"       # Redis密码

# ============================================================================
# 函数定义
# ============================================================================

print_header() {
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# 检查文件是否存在
check_file_exists() {
    if [ ! -f "$1" ]; then
        print_error "文件不存在: $1"
        exit 1
    fi
}

# 检查MongoDB连接
check_mongodb_connection() {
    print_info "检查 MongoDB 连接..."

    # 从 .env.production 提取 MongoDB URI
    MONGODB_URI=$(grep "^MONGODB_URI=" "$ENV_FILE" | cut -d'=' -f2)

    if [ -z "$MONGODB_URI" ]; then
        print_error "无法从 .env.production 读取 MONGODB_URI"
        exit 1
    fi

    # 尝试连接MongoDB
    if command -v mongosh &> /dev/null; then
        if mongosh "$MONGODB_URI" --eval "db.adminCommand('ping')" &>/dev/null; then
            print_success "MongoDB 连接成功"
            return 0
        fi
    elif command -v mongo &> /dev/null; then
        if mongo "$MONGODB_URI" --eval "db.adminCommand('ping')" &>/dev/null; then
            print_success "MongoDB 连接成功"
            return 0
        fi
    else
        print_warning "未找到 mongosh/mongo 命令，跳过连接检查"
        return 0
    fi

    print_error "MongoDB 连接失败，请检查配置"
    return 1
}

# 备份 .env.production
backup_env_file() {
    print_info "备份 .env.production..."

    mkdir -p "$BACKUP_DIR"
    cp "$ENV_FILE" "$BACKUP_FILE"

    print_success "备份文件: $BACKUP_FILE"
}

# 更新 .env.production 文件
update_env_file() {
    print_info "更新 .env.production 配置..."

    # 检查是否已存在 ADMIN_DB_ACCESS_PASSWORD
    if grep -q "^ADMIN_DB_ACCESS_PASSWORD=" "$ENV_FILE"; then
        print_info "ADMIN_DB_ACCESS_PASSWORD 已存在，更新值..."
        sed -i.bak "s/^ADMIN_DB_ACCESS_PASSWORD=.*/ADMIN_DB_ACCESS_PASSWORD=$ADMIN_DB_ACCESS_PASSWORD/" "$ENV_FILE"
    else
        print_info "添加 ADMIN_DB_ACCESS_PASSWORD..."
        # 在 ADMIN_DEFAULT_PASSWORD 后面添加，如果没有则在 JWT_SECRET 前面添加
        if grep -q "^ADMIN_DEFAULT_PASSWORD=" "$ENV_FILE"; then
            sed -i.bak "/^ADMIN_DEFAULT_PASSWORD=/a\\
ADMIN_DB_ACCESS_PASSWORD=$ADMIN_DB_ACCESS_PASSWORD
" "$ENV_FILE"
        else
            # 在第一个注释行或 JWT 配置之前添加
            sed -i.bak "/^JWT_SECRET=/i\\
# Admin 管理员配置\
ADMIN_DEFAULT_PASSWORD=$ADMIN_LOGIN_PASSWORD\
ADMIN_DB_ACCESS_PASSWORD=$ADMIN_DB_ACCESS_PASSWORD\
\\
" "$ENV_FILE"
        fi
    fi

    # 更新 MySQL 和 Redis 密码（如果配置存在）
    if grep -q "^MYSQL_PASSWORD=" "$ENV_FILE"; then
        print_info "更新 MYSQL_PASSWORD..."
        sed -i.bak "s/^MYSQL_PASSWORD=.*/MYSQL_PASSWORD=$MYSQL_PASSWORD/" "$ENV_FILE"
    fi

    if grep -q "^REDIS_PASSWORD=" "$ENV_FILE"; then
        print_info "更新 REDIS_PASSWORD..."
        sed -i.bak "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$REDIS_PASSWORD/" "$ENV_FILE"
    fi

    # 清理备份文件
    rm -f "$ENV_FILE.bak"

    print_success ".env.production 配置已更新"
}

# 验证 .env 文件格式
verify_env_file() {
    print_info "验证 .env.production 文件格式..."

    # 检查关键变量是否存在
    local required_vars=("NODE_ENV" "MONGODB_URI" "ADMIN_DB_ACCESS_PASSWORD" "JWT_SECRET")

    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$ENV_FILE"; then
            print_error "缺少必要的环境变量: $var"
            exit 1
        fi
    done

    print_success ".env.production 格式验证通过"
}

# 运行重置密码脚本
reset_admin_password() {
    print_info "执行管理员密码重置脚本..."

    cd "$BACKEND_DIR"

    # 检查脚本是否存在
    check_file_exists "$BACKEND_DIR/scripts/reset-admin-password.js"

    # 运行脚本
    if node scripts/reset-admin-password.js "admin@morningreading.com" "$ADMIN_LOGIN_PASSWORD" "$ADMIN_DB_ACCESS_PASSWORD"; then
        print_success "管理员密码重置成功"
    else
        print_error "管理员密码重置失败"
        exit 1
    fi

    cd "$PROJECT_ROOT"
}

# 验证部署
verify_deployment() {
    print_info "验证部署结果..."

    # 检查 .env 文件是否包含新配置
    if grep -q "ADMIN_DB_ACCESS_PASSWORD=$ADMIN_DB_ACCESS_PASSWORD" "$ENV_FILE"; then
        print_success "环境变量配置验证通过"
    else
        print_error "环境变量配置验证失败"
        exit 1
    fi

    print_success "部署验证完成"
}

# 显示部署总结
show_summary() {
    print_header "部署完成总结"

    echo ""
    echo -e "${GREEN}✅ 所有步骤已成功完成！${NC}"
    echo ""
    echo "📋 配置信息："
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  项目路径:              $PROJECT_ROOT"
    echo "  环境配置文件:          $ENV_FILE"
    echo "  配置备份文件:          $BACKUP_FILE"
    echo ""
    echo "  管理员邮箱:            admin@morningreading.com"
    echo "  管理员登录密码:        $ADMIN_LOGIN_PASSWORD"
    echo "  数据库访问密码:        $ADMIN_DB_ACCESS_PASSWORD"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📌 下一步操作："
    echo "  1. 重启后端服务:"
    echo "     pm2 restart all  # 或使用你的部署工具"
    echo ""
    echo "  2. 验证登录功能:"
    echo "     curl -X POST https://wx.shubai01.com/api/v1/auth/admin/login \\"
    echo "       -H 'Content-Type: application/json' \\"
    echo "       -d '{\"email\":\"admin@morningreading.com\",\"password\":\"$ADMIN_LOGIN_PASSWORD\"}'"
    echo ""
    echo "  3. 验证数据库访问密码:"
    echo "     curl -X POST https://wx.shubai01.com/api/v1/auth/admin/verify-db-access \\"
    echo "       -H 'Content-Type: application/json' \\"
    echo "       -H 'Authorization: Bearer <token>' \\"
    echo "       -d '{\"password\":\"$ADMIN_DB_ACCESS_PASSWORD\"}'"
    echo ""
    echo "⚠️  重要提醒："
    echo "  • 备份文件位置: $BACKUP_FILE"
    echo "  • 妥善保管以上密码信息"
    echo "  • 不要将密码提交到 Git 仓库"
    echo "  • 建议在密钥管理系统中保存这些密码"
    echo ""
}

# 处理中断信号
cleanup() {
    print_warning "部署中断，恢复备份文件..."
    if [ -f "$BACKUP_FILE" ]; then
        cp "$BACKUP_FILE" "$ENV_FILE"
        print_info "已恢复备份: $BACKUP_FILE"
    fi
    exit 1
}

trap cleanup SIGINT SIGTERM

# ============================================================================
# 主流程
# ============================================================================

main() {
    print_header "晨读营线上部署 - 数据库访问密码安全更新"

    echo ""
    print_info "脚本将执行以下操作："
    echo "  1. 检查 MongoDB 连接"
    echo "  2. 备份 .env.production 配置文件"
    echo "  3. 更新 .env.production 新增环境变量"
    echo "  4. 验证配置文件格式"
    echo "  5. 执行管理员密码重置脚本"
    echo "  6. 验证部署结果"
    echo ""

    # 检查先决条件
    print_info "检查先决条件..."
    check_file_exists "$ENV_FILE"
    check_file_exists "$BACKEND_DIR/scripts/reset-admin-password.js"

    if ! command -v node &> /dev/null; then
        print_error "未找到 Node.js，请先安装 Node.js"
        exit 1
    fi
    print_success "Node.js 已安装"

    echo ""

    # 确认开始
    print_warning "确认开始部署？"
    echo "  此操作将修改生产环境配置，请确保已有备份"
    read -p "请输入 'yes' 确认: " confirm

    if [ "$confirm" != "yes" ]; then
        print_info "部署已取消"
        exit 0
    fi

    echo ""

    # 执行部署步骤
    check_mongodb_connection || true  # MongoDB 连接失败时仍继续
    backup_env_file
    update_env_file
    verify_env_file
    reset_admin_password
    verify_deployment

    echo ""
    show_summary
}

# 运行主流程
main "$@"
