#!/bin/bash

################################################################################
# 第 3 步：基础设施设置 - 克隆代码和创建目录
# 执行位置：远程服务器
# 执行方式：bash scripts/3-setup-infrastructure.sh [git-repo-url] [git-branch]
#
# 参数：
#   git-repo-url: Git 仓库地址（默认：GitHub 晨读营项目）
#   git-branch: Git 分支（默认：main）
#
# 功能：
# 1. 克隆或更新项目代码
# 2. 复制 .env.config.js 配置
# 3. 创建必要的目录
# 4. 设置权限
################################################################################

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 源加载库
source "$SCRIPT_DIR/lib/utils.sh"
source "$SCRIPT_DIR/lib/infrastructure-functions.sh"

################################################################################
# 配置
################################################################################

APP_ROOT="/var/www/morning-reading"
APP_USER="ubuntu"
GIT_REPO="${1:-https://github.com/flylion816/Morning_Reading_Club.git}"
GIT_BRANCH="${2:-main}"

################################################################################
# 主函数
################################################################################

main() {
  log_header "晨读营小程序 - 第 3 步：基础设施设置"

  log_info "开始时间: $(date)"
  log_info "应用目录: $APP_ROOT"
  log_info "Git 仓库: $GIT_REPO"
  log_info "Git 分支: $GIT_BRANCH"
  log_info ""

  # 第 1 步：克隆或更新项目
  log_section "第 1 步：克隆或更新项目代码"

  if [ -d "$APP_ROOT/.git" ]; then
    log_info "项目已存在，更新代码..."
    cd "$APP_ROOT"
    sudo git fetch origin || {
      log_error "Git 更新失败"
      exit 1
    }
    sudo git checkout "$GIT_BRANCH" || {
      log_error "Git 检出分支失败"
      exit 1
    }
    sudo git pull origin "$GIT_BRANCH" || {
      log_error "Git 拉取失败"
      exit 1
    }
    log_success "项目已更新"
  else
    log_info "克隆项目代码..."
    sudo git clone -b "$GIT_BRANCH" "$GIT_REPO" "$APP_ROOT" || {
      log_error "Git 克隆失败"
      exit 1
    }
    log_success "项目已克隆"
  fi

  # 第 2 步：复制配置文件
  log_section "第 2 步：复制配置文件"

  log_info "查找 .env.config.js..."
  if [ -f "$APP_ROOT/.env.config.js" ]; then
    log_success ".env.config.js 已存在"
  else
    log_warning ".env.config.js 未找到，需要手动创建"
    log_info "模板位置: $APP_ROOT/.env.config.example.js（如果存在）"
  fi

  # 第 3 步：设置权限
  log_section "第 3 步：设置权限"

  log_info "修改文件所有者..."
  sudo chown -R "$APP_USER:$APP_USER" "$APP_ROOT" || {
    log_error "权限设置失败"
    exit 1
  }
  log_success "权限已设置"

  # 第 4 步：创建必要目录
  log_section "第 4 步：创建必要目录"

  log_info "创建后端日志目录..."
  sudo mkdir -p "$APP_ROOT/backend/logs"
  sudo chown -R "$APP_USER:$APP_USER" "$APP_ROOT/backend/logs"
  log_success "后端日志目录已创建"

  log_info "创建管理后台目录..."
  sudo mkdir -p "$APP_ROOT/admin/dist"
  sudo chown -R "$APP_USER:$APP_USER" "$APP_ROOT/admin/dist"
  log_success "管理后台目录已创建"

  log_info "创建备份目录..."
  sudo mkdir -p "$APP_ROOT/backups"
  sudo chown -R "$APP_USER:$APP_USER" "$APP_ROOT/backups"
  log_success "备份目录已创建"

  # 第 5 步：验证结构
  log_section "第 5 步：验证目录结构"

  log_info "检查关键文件..."
  check_file "$APP_ROOT/backend/package.json" || {
    log_error "后端 package.json 未找到"
    exit 1
  }
  log_success "后端 package.json 已验证"

  check_file "$APP_ROOT/admin/package.json" || {
    log_error "管理后台 package.json 未找到"
    exit 1
  }
  log_success "管理后台 package.json 已验证"

  check_file "$APP_ROOT/backend/src/server.js" || {
    log_warning "后端 server.js 未找到（可能路径不同）"
  }

  # 显示摘要
  log_section "基础设施设置摘要"

  log_info "✅ 项目代码: 已克隆/更新 ($GIT_BRANCH 分支)"
  log_info "✅ 配置文件: 已检查"
  log_info "✅ 文件权限: 已设置 ($APP_USER:$APP_USER)"
  log_info "✅ 日志目录: 已创建 ($APP_ROOT/backend/logs)"
  log_info "✅ 管理后台: 已创建 ($APP_ROOT/admin/dist)"
  log_info "✅ 备份目录: 已创建 ($APP_ROOT/backups)"

  log_header "基础设施设置完成！✨"

  log_info "下一步："
  log_info "  1. 确保 .env.config.js 已配置正确的数据库凭证"
  log_info "  2. 运行第 4 步脚本："
  log_info "     bash scripts/4-init-database.sh"
  log_info ""

  return 0
}

# 捕获错误时输出
trap 'log_error "脚本执行失败，请检查上面的错误信息"; exit 1' ERR

main "$@"
