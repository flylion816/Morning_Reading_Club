#!/bin/bash

################################################################################
# 工具函数库 - 所有脚本通用
# 用途：日志、颜色、系统检查等通用函数
################################################################################

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# 日志函数
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

# 系统检查函数
check_command() {
  if ! command -v "$1" &> /dev/null; then
    log_error "$1 未安装"
    return 1
  fi
  log_success "$1 已安装"
  return 0
}

check_file() {
  if [ ! -f "$1" ]; then
    log_error "文件不存在: $1"
    return 1
  fi
  return 0
}

check_dir() {
  if [ ! -d "$1" ]; then
    log_error "目录不存在: $1"
    return 1
  fi
  return 0
}

# 确认函数
confirm() {
  local prompt="$1"
  local response

  read -p "$(echo -e ${YELLOW}$prompt${NC}) (y/n): " response
  [[ "$response" =~ ^[Yy]$ ]]
}

# 等待函数
wait_for_port() {
  local host="$1"
  local port="$2"
  local timeout="${3:-30}"
  local elapsed=0

  log_info "等待 $host:$port 就绪（超时：${timeout}s）..."

  while [ $elapsed -lt $timeout ]; do
    if timeout 1 bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null; then
      log_success "$host:$port 已就绪"
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  log_error "$host:$port 在 ${timeout}s 内未就绪"
  return 1
}

# 执行远程命令
ssh_exec() {
  local server="$1"
  local command="$2"

  ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no "$server" "$command"
}

# 上传文件
scp_upload() {
  local local_file="$1"
  local remote_path="$2"
  local server="$3"

  scp -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no "$local_file" "$server:$remote_path"
}

# 下载文件
scp_download() {
  local remote_file="$1"
  local local_path="$2"
  local server="$3"

  scp -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no "$server:$remote_file" "$local_path"
}

export -f log_header log_section log_info log_success log_warning log_error
export -f check_command check_file check_dir confirm wait_for_port
export -f ssh_exec scp_upload scp_download
