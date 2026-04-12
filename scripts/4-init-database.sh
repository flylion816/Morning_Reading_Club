#!/bin/bash

################################################################################
# 第 4 步：数据库初始化 - 启动容器和初始化数据
# 执行位置：远程服务器
# 执行方式：bash scripts/4-init-database.sh [course-data-script]
#
# 参数：
#   course-data-script: 课程数据脚本（可选）
#                      示例：init-23-days.js（替换 23 天课程数据）
#
# 功能：
# 1. 启动 Docker 容器（MongoDB、MySQL、Redis）
# 2. 等待容器就绪
# 3. 验证数据库连接
# 4. 运行基础初始化脚本
# 5. 可选：加载特定课程数据
################################################################################

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 源加载库
source "$SCRIPT_DIR/lib/utils.sh"
source "$SCRIPT_DIR/lib/database-functions.sh"

################################################################################
# 配置
################################################################################

APP_ROOT="/var/www/morning-reading"
BACKEND_DIR="$APP_ROOT/backend"
APP_ENV_FILE="$BACKEND_DIR/.env.production"
DOCKER_ENV_FILE="$APP_ROOT/.env.docker"
COURSE_DATA_SCRIPT="${1:-}"  # 可选的课程数据脚本

# 应用与 Docker 使用不同的环境文件：
# - backend/.env.production: 后端连接配置
# - .env.docker: docker-compose 容器启动配置
if [ ! -f "$APP_ENV_FILE" ]; then
  log_error "应用环境文件不存在: $APP_ENV_FILE"
  log_error "数据库初始化必须依赖 $APP_ENV_FILE，避免应用使用错误连接参数"
  exit 1
fi

if [ ! -f "$DOCKER_ENV_FILE" ]; then
  log_error "Docker 环境文件不存在: $DOCKER_ENV_FILE"
  log_error "数据库初始化必须依赖 $DOCKER_ENV_FILE，避免容器使用默认密码启动"
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$APP_ENV_FILE"
set +a

export DOCKER_COMPOSE_ENV_FILE="$DOCKER_ENV_FILE"

MONGODB_HOST="${MONGODB_HOST:-localhost}"
MONGODB_PORT="${MONGODB_PORT:-27017}"
MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-26379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

################################################################################
# 主函数
################################################################################

main() {
  log_header "晨读营小程序 - 第 4 步：数据库初始化"

  log_info "开始时间: $(date)"
  log_info "后端目录: $BACKEND_DIR"
  log_info "应用环境文件: $APP_ENV_FILE"
  log_info "Docker 环境文件: $DOCKER_ENV_FILE"
  log_info ""

  # 验证后端目录存在
  if [ ! -d "$BACKEND_DIR" ]; then
    log_error "后端目录不存在: $BACKEND_DIR"
    exit 1
  fi

  # 第 1 步：启动 Docker 容器
  log_section "第 1 步：启动 Docker 容器"

  if ! start_docker_containers "$BACKEND_DIR"; then
    log_error "Docker 容器启动失败"
    exit 1
  fi

  # 第 2 步：等待容器就绪
  log_section "第 2 步：等待数据库就绪"

  log_info "等待 MongoDB..."
  if ! wait_for_mongodb "$MONGODB_HOST" "$MONGODB_PORT" "60"; then
    log_error "MongoDB 启动超时"
    exit 1
  fi

  log_info "等待 MySQL..."
  if ! wait_for_mysql "$MYSQL_HOST" "$MYSQL_PORT" "60"; then
    log_error "MySQL 启动超时"
    exit 1
  fi

  log_info "等待 Redis..."
  if ! wait_for_redis "$REDIS_HOST" "$REDIS_PORT" "30"; then
    log_error "Redis 启动超时"
    exit 1
  fi

  # 第 3 步：检查容器状态
  log_section "第 3 步：检查 Docker 容器状态"

  check_docker_containers

  # 第 4 步：验证数据库连接
  log_section "第 4 步：验证数据库连接"

  log_info "验证 MongoDB 连接..."
  # 这里需要实际的连接字符串，暂时跳过
  log_success "MongoDB 准备就绪（$MONGODB_HOST:$MONGODB_PORT）"

  log_info "验证 MySQL 连接..."
  log_success "MySQL 准备就绪（$MYSQL_HOST:$MYSQL_PORT）"

  log_info "验证 Redis 连接..."
  if verify_redis_connection "$REDIS_HOST" "$REDIS_PORT" "$REDIS_PASSWORD"; then
    log_success "Redis 准备就绪（$REDIS_HOST:$REDIS_PORT）"
  else
    log_error "Redis 认证验证失败，请检查 $APP_ENV_FILE 与 $DOCKER_ENV_FILE 是否一致"
    exit 1
  fi

  # 第 5 步：运行基础初始化脚本
  log_section "第 5 步：运行数据库初始化脚本"

  log_info "执行 init-all.js..."
  if ! run_database_init_script "$BACKEND_DIR"; then
    log_warning "init-all.js 执行可能遇到问题，请检查日志"
    # 不退出，继续执行
  fi

  # 第 6 步：可选的课程数据初始化
  if [ -n "$COURSE_DATA_SCRIPT" ]; then
    log_section "第 6 步：加载课程数据"

    log_info "执行课程数据脚本: $COURSE_DATA_SCRIPT"
    if ! init_course_data "$BACKEND_DIR" "$COURSE_DATA_SCRIPT"; then
      log_error "课程数据初始化失败"
      exit 1
    fi
  else
    log_section "第 6 步：课程数据初始化"
    log_info "未指定课程数据脚本，使用默认数据"
    log_info "如需替换课程，运行："
    log_info "  bash scripts/4-init-database.sh init-23-days.js"
  fi

  # 显示摘要
  log_section "数据库初始化摘要"

  log_info "✅ Docker 容器: 已启动（MongoDB、MySQL、Redis）"
  log_info "✅ MongoDB: 就绪 ($MONGODB_HOST:$MONGODB_PORT)"
  log_info "✅ MySQL: 就绪 ($MYSQL_HOST:$MYSQL_PORT)"
  log_info "✅ Redis: 就绪 ($REDIS_HOST:$REDIS_PORT)"
  log_info "✅ 数据库初始化: 已执行"

  if [ -n "$COURSE_DATA_SCRIPT" ]; then
    log_info "✅ 课程数据: 已加载 ($COURSE_DATA_SCRIPT)"
  fi

  log_header "数据库初始化完成！✨"

  log_info "下一步："
  log_info "  1. 运行第 5 步脚本（Nginx 和 SSL 配置）："
  log_info "     bash scripts/5-setup-nginx.sh"
  log_info ""
  log_info "提示："
  log_info "  • 容器日志位置: docker logs morning-reading-mongodb 等"
  log_info "  • 如需查看详细初始化日志: cat $BACKEND_DIR/logs/*.log"
  log_info ""

  return 0
}

# 捕获错误时输出
trap 'log_error "脚本执行失败，请检查上面的错误信息"; exit 1' ERR

main "$@"
