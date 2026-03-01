#!/bin/bash

################################################################################
# 生产服务器初始化脚本
# 功能：一键初始化数据库 + 启动服务（本地执行）
# 执行位置：本地 Mac
# 执行方式：bash scripts/setup-prod-server.sh
#
# 完整流程：
# 1. 本地生成 .env.docker.prod（不提交到 git，含生产密码）
# 2. SCP 上传 docker-compose.yml + .env.docker.prod 到服务器
# 3. SSH 到服务器执行：
#    a. 检查 Docker 是否已安装
#    b. docker-compose --env-file .env.docker.prod up -d（启动三个数据库）
#    c. 循环等待各服务健康（最多等 2 分钟）
#    d. 初始化 MySQL 表结构（NODE_ENV=production node scripts/init-mysql.js）
#    e. 创建超级管理员（NODE_ENV=production node scripts/init-superadmin.js）
#    f. pm2 restart morning-reading-backend --update-env
#    g. curl -s http://localhost:3000/api/v1/health（验证服务就绪）
# 4. 打印最终状态报告
################################################################################

set -e  # 任何错误就退出

################################################################################
# 配置
################################################################################

# 本地配置
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

# 服务器配置
SERVER_IP="118.25.145.179"
SERVER_USER="ubuntu"
SSH_KEY="$HOME/.ssh/id_rsa"  # SSH 密钥认证
SERVER_BACKEND_PATH="/var/www/morning-reading/backend"
SERVER_ROOT="/var/www/morning-reading"
PM2_APP_NAME="morning-reading-backend"

# 时间戳
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# 生产环境密码（从 .env.production 提取）
MONGO_USER="admin"
MONGO_PASSWORD="p62CWhV0Kd1Unq"
MYSQL_ROOT_PASSWORD="Root@Prod@User0816!"
MYSQL_USER="morning_user"
MYSQL_PASSWORD="Morning@Prod@User0816!"
REDIS_PASSWORD="Redis@Prod@User0816!"

# 临时文件路径
TEMP_ENV_FILE="/tmp/.env.docker.prod-${TIMESTAMP}"

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
# 清理函数
################################################################################

cleanup() {
  log_section "清理本地临时文件"

  if [ -f "$TEMP_ENV_FILE" ]; then
    log_info "删除临时环境文件..."
    rm -f "$TEMP_ENV_FILE"
  fi

  log_success "清理完成"
}

# 捕获错误或正常退出时执行清理
trap cleanup EXIT

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

  # 检查 scp
  if ! command -v scp &> /dev/null; then
    log_error "scp 未安装"
    exit 1
  fi
  log_success "scp 已安装"

  # 检查 SSH 密钥
  if [ ! -f "$SSH_KEY" ]; then
    log_error "SSH 密钥不存在: $SSH_KEY"
    exit 1
  fi
  log_success "SSH 密钥存在"
}

################################################################################
# 生成生产环境 env 文件
################################################################################

generate_prod_env() {
  log_section "生成生产环境 env 文件"

  log_info "生成 .env.docker.prod..."

  cat > "$TEMP_ENV_FILE" <<EOF
# ========================================
# 生产环境 Docker Compose 环境变量
# ========================================
# MongoDB
MONGO_USER=$MONGO_USER
MONGO_PASSWORD=$MONGO_PASSWORD
MONGO_PORT=27017

# MySQL
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD
MYSQL_USER=$MYSQL_USER
MYSQL_PASSWORD=$MYSQL_PASSWORD
MYSQL_PORT=3306

# Redis
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_PORT=6379
EOF

  log_success "生成完成: $TEMP_ENV_FILE"
}

################################################################################
# 上传文件到服务器
################################################################################

upload_files() {
  log_section "上传文件到服务器"

  log_info "服务器: $SERVER_IP"
  log_info "远程路径: $SERVER_ROOT"

  # 检查 docker-compose.yml 是否存在
  if [ ! -f "$PROJECT_ROOT/docker-compose.prod.yml" ]; then
    log_error "docker-compose.prod.yml 不存在: $PROJECT_ROOT/docker-compose.prod.yml"
    exit 1
  fi

  # 确保服务器目录存在
  log_info "创建服务器目录..."
  if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
    "mkdir -p $SERVER_ROOT" 2>/dev/null; then
    log_success "服务器目录就绪"
  else
    log_error "无法创建服务器目录"
    exit 1
  fi

  # 上传 docker-compose.prod.yml
  log_info "上传 docker-compose.prod.yml..."
  if scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$PROJECT_ROOT/docker-compose.prod.yml" \
    "$SERVER_USER@$SERVER_IP:$SERVER_ROOT/docker-compose.yml" 2>/dev/null; then
    log_success "docker-compose.yml 上传完成"
  else
    log_error "docker-compose.yml 上传失败"
    exit 1
  fi

  # 上传 .env.docker.prod
  log_info "上传 .env.docker.prod..."
  if scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$TEMP_ENV_FILE" \
    "$SERVER_USER@$SERVER_IP:$SERVER_ROOT/.env.docker" 2>/dev/null; then
    log_success ".env.docker 上传完成"
  else
    log_error ".env.docker 上传失败"
    exit 1
  fi
}

################################################################################
# 在服务器上启动数据库
################################################################################

start_databases() {
  log_section "在服务器上启动数据库"

  # 构建服务器端脚本
  local server_script=$(cat <<'EOF'
#!/bin/bash
set -e

SERVER_ROOT="$1"
TIMESTAMP="$2"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[⚠]${NC} $1"; }

# 检查 Docker 是否已安装
log_info "检查 Docker 是否已安装..."
if ! command -v docker &> /dev/null; then
  log_error "Docker 未安装，请先安装 Docker"
  exit 1
fi
log_success "Docker 已安装"

# 检查 docker-compose 是否已安装
log_info "检查 docker-compose 是否已安装..."
if ! command -v docker-compose &> /dev/null; then
  log_error "docker-compose 未安装"
  exit 1
fi
log_success "docker-compose 已安装"

# 进入服务器目录
cd "$SERVER_ROOT"

# 清理旧的容器（如果存在）
log_info "清理旧的容器..."
docker-compose down 2>/dev/null || true
sleep 1

# 启动数据库容器
log_info "启动数据库容器..."
if docker-compose --env-file .env.docker up -d; then
  log_success "容器启动完成"
else
  log_error "容器启动失败"
  exit 1
fi

# 等待服务健康
log_info "等待数据库服务健康（最多 120 秒）..."

WAIT_TIME=0
MAX_WAIT=120
HEALTHY_COUNT=0
REQUIRED_HEALTHY=3  # MongoDB, MySQL, Redis

while [ $WAIT_TIME -lt $MAX_WAIT ]; do
  HEALTHY_COUNT=0

  # 检查 MongoDB 健康状态
  if docker exec morning-reading-mongodb-prod mongosh localhost:27017/test --eval "db.runCommand('ping').ok" --quiet 2>/dev/null | grep -q "1"; then
    log_success "✓ MongoDB 已就绪"
    ((HEALTHY_COUNT++))
  else
    log_warning "⏳ 等待 MongoDB 就绪..."
  fi

  # 检查 MySQL 健康状态
  if docker exec morning-reading-mysql-prod mysqladmin ping -h localhost --silent 2>/dev/null; then
    log_success "✓ MySQL 已就绪"
    ((HEALTHY_COUNT++))
  else
    log_warning "⏳ 等待 MySQL 就绪..."
  fi

  # 检查 Redis 健康状态
  if docker exec morning-reading-redis-prod redis-cli --raw ping 2>/dev/null | grep -q "PONG"; then
    log_success "✓ Redis 已就绪"
    ((HEALTHY_COUNT++))
  else
    log_warning "⏳ 等待 Redis 就绪..."
  fi

  # 如果所有服务都就绪，跳出循环
  if [ $HEALTHY_COUNT -eq $REQUIRED_HEALTHY ]; then
    log_success "所有数据库服务已就绪！"
    return 0
  fi

  WAIT_TIME=$((WAIT_TIME + 5))
  sleep 5
done

log_error "等待超时：数据库服务未在规定时间内就绪"
log_info "当前状态: $HEALTHY_COUNT/$REQUIRED_HEALTHY 服务就绪"
exit 1
EOF
)

  # 执行服务器脚本
  if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
    bash -s "$SERVER_ROOT" "$TIMESTAMP" <<< "$server_script"; then
    log_success "数据库启动成功"
  else
    log_error "数据库启动失败"
    exit 1
  fi
}

################################################################################
# 初始化数据库
################################################################################

initialize_databases() {
  log_section "初始化数据库"

  # 构建服务器端脚本
  local server_script=$(cat <<'EOF'
#!/bin/bash
set -e

SERVER_BACKEND_PATH="$1"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

# 检查 Node.js 是否已安装
log_info "检查 Node.js..."
if ! command -v node &> /dev/null; then
  log_error "Node.js 未安装"
  exit 1
fi
log_success "Node.js 已安装"

# 进入后端目录
cd "$SERVER_BACKEND_PATH"

# 加载 .env.production
log_info "加载生产环境变量..."
if [ -f ".env.production" ]; then
  export NODE_ENV=production
  log_success ".env.production 已加载"
else
  log_error ".env.production 不存在"
  exit 1
fi

# 初始化 MySQL 表结构
log_info "初始化 MySQL 表结构..."
if NODE_ENV=production node scripts/init-mysql.js; then
  log_success "MySQL 初始化完成"
else
  log_error "MySQL 初始化失败"
  exit 1
fi

sleep 2
log_success "数据库初始化完成"
EOF
)

  # 执行服务器脚本
  if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
    bash -s "$SERVER_BACKEND_PATH" <<< "$server_script"; then
    log_success "数据库初始化成功"
  else
    log_error "数据库初始化失败"
    exit 1
  fi
}

################################################################################
# 重启后端服务
################################################################################

restart_backend() {
  log_section "重启后端服务"

  # 构建服务器端脚本
  local server_script=$(cat <<'EOF'
#!/bin/bash

PM2_APP_NAME="$1"

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[⚠]${NC} $1"; }

# 确定 PM2 命令
PM2_CMD="pm2"
if ! command -v pm2 >/dev/null 2>&1; then
  PM2_CMD="npx -y pm2"
fi

log_info "重启后端服务 ($PM2_APP_NAME)..."

# 重启 PM2 应用
if $PM2_CMD restart "$PM2_APP_NAME" --update-env; then
  log_success "后端服务重启成功"
  sleep 2
else
  log_warning "PM2 应用未运行或重启失败，尝试启动..."
  $PM2_CMD list
fi
EOF
)

  # 执行服务器脚本
  if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
    bash -s "$PM2_APP_NAME" <<< "$server_script"; then
    log_success "后端服务重启成功"
  else
    log_warning "后端服务重启可能失败，请手动检查"
  fi
}

################################################################################
# 初始化超级管理员
################################################################################

init_superadmin() {
  log_section "初始化超级管理员"

  log_info "等待后端服务就绪..."
  sleep 3

  # 构建服务器端脚本
  local server_script=$(cat <<'EOF'
#!/bin/bash

SERVER_BACKEND_PATH="$1"

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[⚠]${NC} $1"; }

cd "$SERVER_BACKEND_PATH"

# 设置环境变量
export NODE_ENV=production

log_info "初始化超级管理员..."

# 尝试调用初始化 API（最多重试 5 次）
for i in {1..5}; do
  log_info "尝试 ($i/5)..."

  if NODE_ENV=production node scripts/init-superadmin.js 2>&1 | grep -q "✅\|已创建\|success"; then
    log_success "超级管理员初始化成功"
    exit 0
  fi

  if [ $i -lt 5 ]; then
    log_warning "初始化失败，2 秒后重试..."
    sleep 2
  fi
done

log_warning "超级管理员初始化可能失败或已存在，请手动检查"
EOF
)

  # 执行服务器脚本
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
    bash -s "$SERVER_BACKEND_PATH" <<< "$server_script" || true  # 允许失败
}

################################################################################
# 验证服务
################################################################################

verify_service() {
  log_section "验证服务"

  # 检查后端健康状态
  log_info "检查后端服务健康状态..."

  for i in {1..5}; do
    if curl -s -m 5 "http://localhost:3000/api/v1/health" 2>/dev/null | grep -q "ok\|success"; then
      log_success "后端服务已就绪 ✓"
      return 0
    fi

    if [ $i -lt 5 ]; then
      log_info "等待后端服务就绪... ($i/5)"
      sleep 2
    fi
  done

  log_warning "无法连接到后端服务，请手动验证"
}

################################################################################
# 显示最终报告
################################################################################

show_report() {
  log_header "初始化完成！ 🎉"

  log_info "关键信息："
  log_info "  • 服务器 IP: $SERVER_IP"
  log_info "  • 后端路径: $SERVER_BACKEND_PATH"
  log_info "  • PM2 应用: $PM2_APP_NAME"
  log_info ""

  log_info "数据库服务："
  log_info "  • MongoDB: mongodb://admin:***@127.0.0.1:27017/morning_reading"
  log_info "  • MySQL: morning_user@127.0.0.1:3306/morning_reading"
  log_info "  • Redis: 127.0.0.1:6379"
  log_info ""

  log_info "验证命令："
  log_info "  # 查看 Docker 容器"
  log_info "  ssh -i $SSH_KEY ubuntu@$SERVER_IP 'docker ps | grep morning-reading'"
  log_info ""
  log_info "  # 查看 PM2 状态"
  log_info "  ssh -i $SSH_KEY ubuntu@$SERVER_IP 'pm2 status'"
  log_info ""
  log_info "  # 查看后端日志"
  log_info "  ssh -i $SSH_KEY ubuntu@$SERVER_IP 'pm2 logs $PM2_APP_NAME --lines 50'"
  log_info ""

  log_info "后续步骤："
  log_info "  1. 确认后端服务运行正常"
  log_info "  2. 使用超级管理员账户登录管理后台"
  log_info "  3. 进行测试和验证"
  log_info ""
}

################################################################################
# 主函数
################################################################################

main() {
  log_header "晨读营 - 生产服务器初始化"

  log_info "初始化时间: $(date)"
  log_info "时间戳: $TIMESTAMP"
  log_info ""

  check_dependencies
  generate_prod_env
  upload_files
  start_databases
  initialize_databases
  restart_backend
  init_superadmin
  verify_service
  show_report
}

main "$@"
