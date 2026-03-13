#!/bin/bash

################################################################################
# 基础设施函数库 - 包含所有系统和基础设施相关的可复用函数
# 用途：安装依赖、配置 SSL、设置权限等
# 注意：必须先 source scripts/lib/utils.sh，此库才能使用 log_* 函数
################################################################################

# 源加载 utils 库（如果未加载）
if [ -z "$(type -t log_success)" ]; then
  source "$(dirname "${BASH_SOURCE[0]}")/utils.sh" || {
    echo "❌ 无法加载 utils.sh，脚本中止"
    exit 1
  }
fi

################################################################################
# 系统检查相关
################################################################################

# 检查是否以 root 权限运行
# 用法：check_sudo_access
# 返回：0 有权限，1 无权限
check_sudo_access() {
  log_section "检查 sudo 权限"

  if sudo -n true 2>/dev/null; then
    log_success "拥有 sudo 权限"
    return 0
  else
    log_error "需要 sudo 权限"
    echo "请运行: sudo visudo"
    echo "添加以下行（取决于用户）:"
    echo "  ubuntu ALL=(ALL) NOPASSWD:ALL"
    return 1
  fi
}

# 检查系统架构
# 用法：check_system_architecture
check_system_architecture() {
  log_section "检查系统架构"

  local arch=$(uname -m)
  log_info "架构: $arch"

  case "$arch" in
    x86_64)
      log_success "支持的架构: x86_64"
      ;;
    arm64)
      log_success "支持的架构: ARM64"
      ;;
    *)
      log_warning "未知架构: $arch，继续安装..."
      ;;
  esac
}

# 检查系统磁盘空间
# 用法：check_disk_space /var/www 10
# 返回：0 充足，1 不足
check_disk_space() {
  local path="${1:-.}"
  local required_gb="${2:-10}"

  log_section "检查磁盘空间"

  local available_kb=$(df "$path" | tail -1 | awk '{print $4}')
  local available_gb=$((available_kb / 1024 / 1024))

  log_info "路径: $path"
  log_info "可用空间: ${available_gb}GB（需要: ${required_gb}GB）"

  if [ "$available_gb" -ge "$required_gb" ]; then
    log_success "磁盘空间充足"
    return 0
  else
    log_error "磁盘空间不足"
    return 1
  fi
}

################################################################################
# 软件安装相关
################################################################################

# 安装 Node.js（使用 nvm 或包管理器）
# 用法：install_nodejs
# 返回：0 成功，1 失败
install_nodejs() {
  log_section "安装 Node.js"

  if command -v node &>/dev/null; then
    local version=$(node --version)
    log_success "Node.js 已安装: $version"
    return 0
  fi

  log_info "检测到 Node.js 未安装，准备安装..."

  # 尝试使用包管理器
  if command -v apt-get &>/dev/null; then
    log_info "使用 apt-get 安装..."
    sudo apt-get update -qq
    sudo apt-get install -y nodejs npm >/dev/null 2>&1 || {
      log_error "apt-get 安装失败"
      return 1
    }
  elif command -v yum &>/dev/null; then
    log_info "使用 yum 安装..."
    sudo yum install -y nodejs npm >/dev/null 2>&1 || {
      log_error "yum 安装失败"
      return 1
    }
  else
    log_error "找不到包管理器"
    return 1
  fi

  if command -v node &>/dev/null; then
    log_success "Node.js 安装完成: $(node --version)"
    return 0
  else
    log_error "Node.js 安装失败"
    return 1
  fi
}

# 安装 Docker
# 用法：install_docker
# 返回：0 成功，1 失败
install_docker() {
  log_section "安装 Docker"

  if command -v docker &>/dev/null; then
    local version=$(docker --version)
    log_success "Docker 已安装: $version"
    return 0
  fi

  log_info "检测到 Docker 未安装，准备安装..."

  # 使用官方脚本安装
  if curl -fsSL https://get.docker.com -o /tmp/get-docker.sh 2>/dev/null; then
    log_info "执行 Docker 官方安装脚本..."
    sudo sh /tmp/get-docker.sh >/dev/null 2>&1 || {
      log_error "Docker 安装失败"
      return 1
    }
    rm -f /tmp/get-docker.sh
  else
    log_warning "无法下载 Docker 安装脚本，尝试使用包管理器..."
    if command -v apt-get &>/dev/null; then
      sudo apt-get update -qq
      sudo apt-get install -y docker.io >/dev/null 2>&1 || {
        log_error "apt-get 安装失败"
        return 1
      }
    else
      log_error "找不到合适的安装方式"
      return 1
    fi
  fi

  if command -v docker &>/dev/null; then
    log_success "Docker 安装完成: $(docker --version)"
    # 启动 Docker 服务
    sudo systemctl enable docker 2>/dev/null || true
    sudo systemctl start docker 2>/dev/null || true
    return 0
  else
    log_error "Docker 安装失败"
    return 1
  fi
}

# 安装 Docker Compose
# 用法：install_docker_compose
# 返回：0 成功，1 失败
install_docker_compose() {
  log_section "安装 Docker Compose"

  if command -v docker &>/dev/null && docker compose version &>/dev/null; then
    log_success "Docker Compose 已安装"
    return 0
  fi

  log_info "安装 Docker Compose v2..."

  if [ ! -d "$HOME/.docker/cli-plugins" ]; then
    mkdir -p "$HOME/.docker/cli-plugins"
  fi

  local docker_compose_url="https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64"

  if curl -L "$docker_compose_url" -o "$HOME/.docker/cli-plugins/docker-compose" 2>/dev/null; then
    chmod +x "$HOME/.docker/cli-plugins/docker-compose"
    log_success "Docker Compose 安装完成"
    return 0
  else
    log_error "Docker Compose 下载失败"
    return 1
  fi
}

# 安装 PM2（全局）
# 用法：install_pm2
# 返回：0 成功，1 失败
install_pm2() {
  log_section "安装 PM2"

  if npm list -g pm2 &>/dev/null; then
    log_success "PM2 已安装"
    return 0
  fi

  log_info "全局安装 PM2..."
  if sudo npm install -g pm2 --silent >/dev/null 2>&1; then
    log_success "PM2 安装完成"
    return 0
  else
    log_error "PM2 安装失败"
    return 1
  fi
}

# 安装 Nginx
# 用法：install_nginx
# 返回：0 成功，1 失败
install_nginx() {
  log_section "安装 Nginx"

  if command -v nginx &>/dev/null; then
    local version=$(nginx -v 2>&1)
    log_success "Nginx 已安装: $version"
    return 0
  fi

  log_info "检测到 Nginx 未安装，准备安装..."

  if command -v apt-get &>/dev/null; then
    log_info "使用 apt-get 安装..."
    sudo apt-get update -qq
    sudo apt-get install -y nginx >/dev/null 2>&1 || {
      log_error "apt-get 安装失败"
      return 1
    }
  elif command -v yum &>/dev/null; then
    log_info "使用 yum 安装..."
    sudo yum install -y nginx >/dev/null 2>&1 || {
      log_error "yum 安装失败"
      return 1
    }
  else
    log_error "找不到包管理器"
    return 1
  fi

  if command -v nginx &>/dev/null; then
    log_success "Nginx 安装完成"
    sudo systemctl enable nginx
    sudo systemctl start nginx
    return 0
  else
    log_error "Nginx 安装失败"
    return 1
  fi
}

# 安装 Certbot（Let's Encrypt）
# 用法：install_certbot
# 返回：0 成功，1 失败
install_certbot() {
  log_section "安装 Certbot"

  if command -v certbot &>/dev/null; then
    log_success "Certbot 已安装"
    return 0
  fi

  log_info "检测到 Certbot 未安装，准备安装..."

  if command -v apt-get &>/dev/null; then
    log_info "使用 apt-get 安装..."
    sudo apt-get update -qq
    sudo apt-get install -y certbot python3-certbot-nginx >/dev/null 2>&1 || {
      log_error "apt-get 安装失败"
      return 1
    }
  elif command -v yum &>/dev/null; then
    log_info "使用 yum 安装..."
    sudo yum install -y certbot python3-certbot-nginx >/dev/null 2>&1 || {
      log_error "yum 安装失败"
      return 1
    }
  else
    log_error "找不到包管理器"
    return 1
  fi

  if command -v certbot &>/dev/null; then
    log_success "Certbot 安装完成"
    return 0
  else
    log_error "Certbot 安装失败"
    return 1
  fi
}

################################################################################
# 配置权限相关
################################################################################

# 配置 ubuntu 用户权限
# 用法：setup_ubuntu_user_permissions
# 返回：0 成功，1 失败
setup_ubuntu_user_permissions() {
  log_section "配置 ubuntu 用户权限"

  if [ "$USER" != "ubuntu" ]; then
    log_warning "当前用户不是 ubuntu，跳过此步骤"
    return 0
  fi

  # 配置 Docker 权限（不需要 sudo）
  if ! groups | grep -q docker; then
    log_info "将 ubuntu 添加到 docker 组..."
    sudo usermod -aG docker ubuntu || true
    log_success "docker 组权限已配置"
  fi

  # 配置 sudo 无密码（如需要）
  if ! sudo -n true 2>/dev/null; then
    log_warning "ubuntu 没有 sudo 无密码权限"
    log_info "运行: sudo visudo"
    log_info "添加: ubuntu ALL=(ALL) NOPASSWD:ALL"
  fi

  return 0
}

# 创建应用目录和权限
# 用法：setup_app_directories /var/www/morning-reading ubuntu
# 返回：0 成功，1 失败
setup_app_directories() {
  local app_root="$1"
  local user="${2:-ubuntu}"

  if [ -z "$app_root" ]; then
    log_error "应用根目录为空"
    return 1
  fi

  log_section "创建应用目录"

  log_info "创建目录结构..."
  sudo mkdir -p "$app_root"/{backend,admin,logs,scripts} || {
    log_error "目录创建失败"
    return 1
  }

  log_info "设置权限..."
  sudo chown -R "$user:$user" "$app_root" || {
    log_error "权限设置失败"
    return 1
  }

  log_success "应用目录已创建"
  return 0
}

################################################################################
# 文件和配置相关
################################################################################

# 复制项目文件到服务器
# 用法：copy_project_files /Users/pica_1/project ubuntu 118.25.145.179 ~/.ssh/id_rsa /var/www/morning-reading
# 返回：0 成功，1 失败
copy_project_files() {
  local local_path="$1"
  local server_user="$2"
  local server_ip="$3"
  local ssh_key="$4"
  local remote_path="$5"

  if [ -z "$local_path" ] || [ ! -d "$local_path" ]; then
    log_error "本地路径无效: $local_path"
    return 1
  fi

  log_section "复制项目文件到服务器"

  log_info "本地: $local_path"
  log_info "远程: $server_user@$server_ip:$remote_path"

  # 排除不必要的文件和目录
  local exclude_options=(
    "--exclude=node_modules"
    "--exclude=.git"
    "--exclude=.env.production"
    "--exclude=logs"
    "--exclude=.DS_Store"
    "--exclude=dist"
  )

  log_info "开始同步..."
  if rsync -av "${exclude_options[@]}" -e "ssh -i $ssh_key -o StrictHostKeyChecking=no" \
    "$local_path/" "$server_user@$server_ip:$remote_path/" 2>/dev/null; then
    log_success "项目文件已复制"
    return 0
  else
    log_error "项目文件复制失败"
    return 1
  fi
}

# 创建符号链接（用于配置文件管理）
# 用法：create_symlink /source/file /destination/link
# 返回：0 成功，1 失败
create_symlink() {
  local source="$1"
  local link="$2"

  if [ -z "$source" ] || [ -z "$link" ]; then
    log_error "参数不完整"
    return 1
  fi

  if [ ! -e "$source" ]; then
    log_error "源文件不存在: $source"
    return 1
  fi

  log_section "创建符号链接"

  if [ -L "$link" ]; then
    log_warning "符号链接已存在，移除..."
    rm -f "$link"
  fi

  ln -sf "$source" "$link"
  log_success "符号链接已创建: $link → $source"
  return 0
}

################################################################################
# 网络和防火墙相关
################################################################################

# 设置防火墙规则（ufw）
# 用法：setup_firewall_rules
# 返回：0 成功，1 失败
setup_firewall_rules() {
  log_section "设置防火墙规则"

  if ! command -v ufw &>/dev/null; then
    log_warning "ufw 未安装，跳过防火墙配置"
    return 0
  fi

  # 允许 SSH
  sudo ufw allow 22/tcp 2>/dev/null || true
  # 允许 HTTP
  sudo ufw allow 80/tcp 2>/dev/null || true
  # 允许 HTTPS
  sudo ufw allow 443/tcp 2>/dev/null || true

  log_success "防火墙规则已配置"
  return 0
}

################################################################################
# 导出函数，使其在 sourced 脚本中可用
################################################################################

export -f check_sudo_access
export -f check_system_architecture
export -f check_disk_space
export -f install_nodejs
export -f install_docker
export -f install_docker_compose
export -f install_pm2
export -f install_nginx
export -f install_certbot
export -f setup_ubuntu_user_permissions
export -f setup_app_directories
export -f copy_project_files
export -f create_symlink
export -f setup_firewall_rules
