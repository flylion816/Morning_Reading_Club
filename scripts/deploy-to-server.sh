#!/bin/bash

################################################################################
# 部署脚本 - 本地执行
# 功能：本地打包 + 备份 + 上传 + 服务器部署（一键部署）
# 执行位置：本地 Mac
# 执行方式：bash scripts/deploy-to-server.sh
#
# 完整流程：
# 1. 检查依赖 (sshpass, npm, tar)
# 2. 本地 build 管理后台
# 3. SSH 到服务器创建时间戳备份
# 4. 本地打包后端 + 管理后台 + 服务器脚本
# 5. scp 上传到服务器
# 6. SSH 到服务器：解压、覆盖、npm install、pm2 reload、nginx reload
# 7. 本地清理临时文件
################################################################################

set -e

################################################################################
# 配置
################################################################################

# 本地配置
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADMIN_DIR="$PROJECT_ROOT/admin"
BACKEND_DIR="$PROJECT_ROOT/backend"
SERVER_SCRIPTS_DIR="$PROJECT_ROOT/scripts/server"

# 服务器配置
SERVER_IP="118.25.145.179"
SERVER_USER="ubuntu"
SERVER_PASSWORD="!X2aZaxXvGO@Ud"
SERVER_BACKEND_PATH="/var/www/morning-reading/backend"
SERVER_ADMIN_PATH="/var/www/morning-reading/admin/dist"
SERVER_ROOT="/var/www/morning-reading"
PM2_APP_NAME="morning-reading-api"

# 打包配置
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOY_PACKAGE="morning-reading-deploy_${TIMESTAMP}.tar.gz"
TEMP_DIR="/tmp/morning-reading-deploy-${TIMESTAMP}"

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
# 清理函数
################################################################################

cleanup() {
  log_section "清理本地临时文件"

  if [ -d "$TEMP_DIR" ]; then
    log_info "删除临时目录: $TEMP_DIR"
    rm -rf "$TEMP_DIR"
  fi

  if [ -f "$PROJECT_ROOT/$DEPLOY_PACKAGE" ]; then
    log_warning "留下部署包备份: $DEPLOY_PACKAGE（如无用可删除）"
  fi

  log_success "清理完成"
}

# 捕获错误时执行清理
trap cleanup EXIT

################################################################################
# 检查依赖
################################################################################

check_dependencies() {
  log_section "检查依赖"

  # 检查 sshpass
  if ! command -v sshpass &> /dev/null; then
    log_error "sshpass 未安装"
    echo ""
    echo "请在 macOS 上安装 sshpass:"
    echo "  brew install hudochenkov/sshpass/sshpass"
    echo ""
    exit 1
  fi
  log_success "sshpass 已安装"

  # 检查 npm
  if ! command -v npm &> /dev/null; then
    log_error "npm 未安装"
    exit 1
  fi
  log_success "npm 已安装"

  # 检查 tar
  if ! command -v tar &> /dev/null; then
    log_error "tar 未安装"
    exit 1
  fi
  log_success "tar 已安装"

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
}

################################################################################
# 本地构建
################################################################################

build_admin() {
  log_section "构建管理后台"

  if [ ! -d "$ADMIN_DIR" ]; then
    log_error "管理后台目录不存在: $ADMIN_DIR"
    exit 1
  fi

  cd "$ADMIN_DIR"
  log_info "当前目录: $(pwd)"

  log_info "安装依赖..."
  npm install --silent

  log_info "执行构建..."
  npm run build

  if [ ! -d "dist" ]; then
    log_error "管理后台构建失败: dist 目录不存在"
    exit 1
  fi

  cd "$PROJECT_ROOT"
  log_success "管理后台构建完成"
}

################################################################################
# 创建服务器备份
################################################################################

create_server_backup() {
  log_section "在服务器上创建备份"

  local backup_cmd="mkdir -p /var/www && cp -r /var/www/morning-reading /var/www/morning-reading_bak_${TIMESTAMP}"

  log_info "服务器: $SERVER_IP"
  log_info "备份命令: $backup_cmd"

  if sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "$backup_cmd" 2>/dev/null; then
    log_success "服务器备份完成: /var/www/morning-reading_bak_${TIMESTAMP}"
  else
    log_error "服务器备份失败"
    exit 1
  fi
}

################################################################################
# 本地打包
################################################################################

create_deployment_package() {
  log_section "打包部署文件"

  log_info "创建临时目录: $TEMP_DIR"
  mkdir -p "$TEMP_DIR"

  # 复制后端文件
  log_info "复制后端文件..."
  mkdir -p "$TEMP_DIR/backend"
  cp -r "$BACKEND_DIR/src" "$TEMP_DIR/backend/" 2>/dev/null || true
  cp -r "$BACKEND_DIR/pm2.config.js" "$TEMP_DIR/backend/" 2>/dev/null || true
  cp -r "$BACKEND_DIR/package.json" "$TEMP_DIR/backend/" 2>/dev/null || true
  cp -r "$BACKEND_DIR/package-lock.json" "$TEMP_DIR/backend/" 2>/dev/null || true
  cp -r "$BACKEND_DIR/.env.production" "$TEMP_DIR/backend/" 2>/dev/null || true

  # 验证后端文件
  if [ ! -f "$TEMP_DIR/backend/package.json" ]; then
    log_warning "后端 package.json 不存在，继续打包其他文件"
  else
    log_success "后端文件已复制"
  fi

  # 复制管理后台
  log_info "复制管理后台..."
  mkdir -p "$TEMP_DIR/admin"
  cp -r "$ADMIN_DIR/dist" "$TEMP_DIR/admin/" 2>/dev/null || true

  if [ ! -d "$TEMP_DIR/admin/dist" ]; then
    log_error "管理后台 dist 目录不存在"
    exit 1
  fi
  log_success "管理后台已复制"

  # 复制服务器脚本
  log_info "复制服务器脚本..."
  mkdir -p "$TEMP_DIR/scripts"
  cp "$SERVER_SCRIPTS_DIR/restart-backend.sh" "$TEMP_DIR/scripts/" || true
  cp "$SERVER_SCRIPTS_DIR/restart-admin.sh" "$TEMP_DIR/scripts/" || true
  chmod +x "$TEMP_DIR/scripts/"*.sh

  log_success "服务器脚本已复制"

  # 创建 tar.gz
  log_info "压缩文件..."
  cd "/tmp"
  tar --exclude='node_modules' --exclude='.git' --exclude='.env*' -czf "$DEPLOY_PACKAGE" \
    -C "$(dirname "$TEMP_DIR")" "$(basename "$TEMP_DIR")" 2>/dev/null

  if [ ! -f "/tmp/$DEPLOY_PACKAGE" ]; then
    log_error "打包失败"
    exit 1
  fi

  # 复制到项目根目录
  cp "/tmp/$DEPLOY_PACKAGE" "$PROJECT_ROOT/"
  local package_size=$(du -h "/tmp/$DEPLOY_PACKAGE" | cut -f1)

  cd "$PROJECT_ROOT"
  log_success "打包完成: $DEPLOY_PACKAGE (大小: $package_size)"
}

################################################################################
# 上传到服务器
################################################################################

upload_to_server() {
  log_section "上传到服务器"

  local local_package="$PROJECT_ROOT/$DEPLOY_PACKAGE"
  local remote_package="/tmp/$DEPLOY_PACKAGE"

  log_info "本地文件: $local_package"
  log_info "远程位置: $remote_package"

  if sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no "$local_package" "$SERVER_USER@$SERVER_IP:$remote_package" 2>/dev/null; then
    log_success "文件上传完成"
  else
    log_error "文件上传失败"
    exit 1
  fi
}

################################################################################
# 服务器端部署
################################################################################

deploy_on_server() {
  log_section "在服务器上部署"

  local remote_package="/tmp/$DEPLOY_PACKAGE"
  local temp_extract="/tmp/morning-reading-extract-${TIMESTAMP}"

  # 构建部署脚本
  local deploy_script=$(cat <<'EOF'
#!/bin/bash
set -e

PACKAGE_PATH="$1"
EXTRACT_DIR="$2"
SERVER_ROOT="$3"
TIMESTAMP="$4"
PM2_APP="$5"

# 创建颜色变量
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }

log_info "解压文件..."
mkdir -p "$EXTRACT_DIR"
tar -xzf "$PACKAGE_PATH" -C "$EXTRACT_DIR" --strip-components=1

log_info "部署后端..."
if [ -d "$EXTRACT_DIR/backend" ]; then
  cp -r "$EXTRACT_DIR/backend/src" "$SERVER_ROOT/backend/"
  cp -r "$EXTRACT_DIR/backend/package.json" "$SERVER_ROOT/backend/"
  cp -r "$EXTRACT_DIR/backend/package-lock.json" "$SERVER_ROOT/backend/" 2>/dev/null || true
  log_success "后端文件已覆盖"
fi

log_info "部署管理后台..."
if [ -d "$EXTRACT_DIR/admin/dist" ]; then
  rm -rf "$SERVER_ROOT/admin/dist"
  cp -r "$EXTRACT_DIR/admin/dist" "$SERVER_ROOT/admin/"
  log_success "管理后台已覆盖"
fi

log_info "复制服务器脚本..."
if [ -d "$EXTRACT_DIR/scripts" ]; then
  cp "$EXTRACT_DIR/scripts/"*.sh "$SERVER_ROOT/" 2>/dev/null || true
  chmod +x "$SERVER_ROOT/"*.sh
  log_success "服务器脚本已复制"
fi

log_info "更新后端依赖..."
cd "$SERVER_ROOT/backend"
npm install --production --silent

log_info "重启后端服务..."
pm2 reload "$PM2_APP" --update-env
sleep 2

log_info "重载 Nginx..."
sudo nginx -t && sudo nginx -s reload

log_info "清理临时文件..."
rm -rf "$EXTRACT_DIR"
rm -f "$PACKAGE_PATH"

log_success "部署完成！"
EOF
)

  # 执行部署脚本
  local ssh_cmd="$deploy_script"

  if sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
    bash -s "$remote_package" "$temp_extract" "$SERVER_ROOT" "$TIMESTAMP" "$PM2_APP_NAME" <<'SCRIPT'
#!/bin/bash
set -e

PACKAGE_PATH="$1"
EXTRACT_DIR="$2"
SERVER_ROOT="$3"
TIMESTAMP="$4"
PM2_APP="$5"

# 创建颜色变量
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }

log_info "解压文件..."
mkdir -p "$EXTRACT_DIR"
tar -xzf "$PACKAGE_PATH" -C "$EXTRACT_DIR" --strip-components=1

log_info "部署后端..."
if [ -d "$EXTRACT_DIR/backend" ]; then
  cp -r "$EXTRACT_DIR/backend/src" "$SERVER_ROOT/backend/"
  cp -r "$EXTRACT_DIR/backend/package.json" "$SERVER_ROOT/backend/"
  cp -r "$EXTRACT_DIR/backend/package-lock.json" "$SERVER_ROOT/backend/" 2>/dev/null || true
  log_success "后端文件已覆盖"
fi

log_info "部署管理后台..."
if [ -d "$EXTRACT_DIR/admin/dist" ]; then
  rm -rf "$SERVER_ROOT/admin/dist"
  cp -r "$EXTRACT_DIR/admin/dist" "$SERVER_ROOT/admin/"
  log_success "管理后台已覆盖"
fi

log_info "复制服务器脚本..."
if [ -d "$EXTRACT_DIR/scripts" ]; then
  cp "$EXTRACT_DIR/scripts/"*.sh "$SERVER_ROOT/" 2>/dev/null || true
  chmod +x "$SERVER_ROOT/"*.sh
  log_success "服务器脚本已复制"
fi

log_info "更新后端依赖..."
cd "$SERVER_ROOT/backend"
npm install --production --silent

log_info "重启后端服务..."
pm2 reload "$PM2_APP" --update-env
sleep 2

log_info "重载 Nginx..."
sudo nginx -t && sudo nginx -s reload

log_info "清理临时文件..."
rm -rf "$EXTRACT_DIR"
rm -f "$PACKAGE_PATH"

log_success "部署完成！"
SCRIPT
  then
    log_success "服务器部署完成"
  else
    log_error "服务器部署失败"
    exit 1
  fi
}

################################################################################
# 验证部署
################################################################################

verify_deployment() {
  log_section "验证部署"

  # 验证后端
  log_info "检查后端服务..."
  if sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
    "pm2 describe $PM2_APP_NAME | grep -q 'online'" 2>/dev/null; then
    log_success "后端服务正常 (online)"
  else
    log_warning "后端服务状态异常，请手动检查"
  fi

  # 验证管理后台
  log_info "检查管理后台文件..."
  if sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" \
    "[ -f $SERVER_ADMIN_PATH/index.html ]" 2>/dev/null; then
    log_success "管理后台文件就绪"
  else
    log_warning "管理后台文件异常，请手动检查"
  fi
}

################################################################################
# 主函数
################################################################################

main() {
  log_header "晨读营小程序 - 生产环境部署"

  log_info "部署时间: $(date)"
  log_info "时间戳: $TIMESTAMP"
  log_info "部署包: $DEPLOY_PACKAGE"
  log_info ""

  check_dependencies
  build_admin
  create_server_backup
  create_deployment_package
  upload_to_server
  deploy_on_server
  verify_deployment

  log_header "部署成功！ 🎉"

  log_info "关键信息:"
  log_info "  • 后端 API: https://wx.shubai01.com/api/v1/health"
  log_info "  • 管理后台: https://wx.shubai01.com/admin"
  log_info "  • 服务器备份: /var/www/morning-reading_bak_${TIMESTAMP}"
  log_info "  • PM2 应用: $PM2_APP_NAME"
  log_info ""
  log_info "回滚命令（如需要）:"
  log_info "  sshpass -p '!X2aZaxXvGO@Ud' ssh ubuntu@118.25.145.179 \\"
  log_info "    'rm -rf /var/www/morning-reading && mv /var/www/morning-reading_bak_${TIMESTAMP} /var/www/morning-reading'"
  log_info ""
}

main "$@"
