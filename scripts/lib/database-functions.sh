#!/bin/bash

################################################################################
# 数据库函数库 - 包含所有数据库相关的可复用函数
# 用途：Docker 容器管理、数据库初始化、备份恢复等
# 注意：必须先 source scripts/lib/utils.sh，此库才能使用 log_* 函数
################################################################################

# 源加载 utils 库（如果未加载）
if [ -z "$(type -t log_success)" ]; then
  source "$(dirname "${BASH_SOURCE[0]}")/utils.sh" || {
    echo "❌ 无法加载 utils.sh，脚本中止"
    exit 1
  }
fi

# 解析 docker compose 需要使用的环境文件。
# 服务器环境必须显式使用项目根目录的 .env.docker，避免误读 backend/.env
resolve_docker_compose_env_file() {
  local backend_dir="$1"
  local project_root=""

  if [ -n "${DOCKER_COMPOSE_ENV_FILE:-}" ]; then
    echo "$DOCKER_COMPOSE_ENV_FILE"
    return 0
  fi

  project_root="$(dirname "$backend_dir")"
  if [[ "$backend_dir" == /var/www/* ]] && [ -f "$project_root/.env.docker" ]; then
    echo "$project_root/.env.docker"
    return 0
  fi

  return 1
}

run_docker_compose() {
  local backend_dir="$1"
  shift

  local env_file=""
  env_file=$(resolve_docker_compose_env_file "$backend_dir" 2>/dev/null || true)

  if [[ "$backend_dir" == /var/www/* ]] && [ -z "$env_file" ]; then
    log_error "缺少 Docker Compose 环境文件，请确认已部署 $(dirname "$backend_dir")/.env.docker"
    return 1
  fi

  if [ -n "$env_file" ]; then
    log_info "docker compose 使用环境文件: $env_file"
    docker compose --env-file "$env_file" "$@"
  else
    docker compose "$@"
  fi
}

################################################################################
# Docker 容器管理相关
################################################################################

# 启动所有 Docker 容器（MongoDB、MySQL、Redis）
# 用法：start_docker_containers /var/www/morning-reading/backend
# 返回：0 成功，1 失败
start_docker_containers() {
  local backend_dir="$1"

  if [ -z "$backend_dir" ] || [ ! -f "$backend_dir/docker-compose.yml" ]; then
    log_error "docker-compose.yml 不存在: $backend_dir/docker-compose.yml"
    return 1
  fi

  log_section "启动 Docker 容器"

  cd "$backend_dir" || return 1

  log_info "执行 docker compose up -d..."
  if run_docker_compose "$backend_dir" up -d 2>/dev/null; then
    log_success "Docker 容器已启动"
    sleep 3  # 等待容器初始化
    return 0
  else
    log_error "Docker 容器启动失败"
    return 1
  fi
}

# 停止所有 Docker 容器
# 用法：stop_docker_containers /var/www/morning-reading/backend
# 返回：0 成功，1 失败
stop_docker_containers() {
  local backend_dir="$1"

  if [ -z "$backend_dir" ]; then
    log_error "后端目录为空"
    return 1
  fi

  log_section "停止 Docker 容器"

  cd "$backend_dir" || return 1

  log_info "执行 docker compose down..."
  if run_docker_compose "$backend_dir" down 2>/dev/null; then
    log_success "Docker 容器已停止"
    return 0
  else
    log_error "Docker 容器停止失败"
    return 1
  fi
}

# 检查 Docker 容器状态
# 用法：check_docker_containers
check_docker_containers() {
  log_section "检查 Docker 容器状态"

  log_info "运行中的容器:"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

  return 0
}

# 获取容器日志
# 用法：get_container_logs mongodb
get_container_logs() {
  local container_name="$1"
  local lines="${2:-50}"

  if [ -z "$container_name" ]; then
    log_error "容器名称为空"
    return 1
  fi

  log_section "获取容器日志: $container_name"

  if docker logs --tail "$lines" "$container_name" 2>/dev/null; then
    return 0
  else
    log_warning "无法获取容器日志，可能容器不存在或未运行"
    return 1
  fi
}

# 删除 Docker 容器和卷（警告：会删除数据！）
# 用法：cleanup_docker_containers /var/www/morning-reading/backend
# 返回：0 成功，1 失败
cleanup_docker_containers() {
  local backend_dir="$1"

  if [ -z "$backend_dir" ]; then
    log_error "后端目录为空"
    return 1
  fi

  log_section "清理 Docker 容器和卷"
  log_warning "⚠️  此操作会删除所有数据！"

  if ! confirm "确实要删除所有容器和数据吗？"; then
    log_info "已取消"
    return 0
  fi

  cd "$backend_dir" || return 1

  log_info "执行清理..."
  run_docker_compose "$backend_dir" down -v 2>/dev/null || true

  log_success "Docker 清理完成"
  return 0
}

################################################################################
# 数据库连接验证相关
################################################################################

# 等待 MongoDB 就绪
# 用法：wait_for_mongodb localhost 27017 30
# 返回：0 就绪，1 超时
wait_for_mongodb() {
  local host="${1:-localhost}"
  local port="${2:-27017}"
  local timeout="${3:-30}"

  log_section "等待 MongoDB 就绪"
  wait_for_port "$host" "$port" "$timeout"
}

# 等待 MySQL 就绪
# 用法：wait_for_mysql localhost 3306 30
# 返回：0 就绪，1 超时
wait_for_mysql() {
  local host="${1:-localhost}"
  local port="${2:-3306}"
  local timeout="${3:-30}"

  log_section "等待 MySQL 就绪"
  wait_for_port "$host" "$port" "$timeout"
}

# 等待 Redis 就绪
# 用法：wait_for_redis localhost 6379 30
# 返回：0 就绪，1 超时
wait_for_redis() {
  local host="${1:-localhost}"
  local port="${2:-6379}"
  local timeout="${3:-30}"

  log_section "等待 Redis 就绪"
  wait_for_port "$host" "$port" "$timeout"
}

# 验证 Redis 连接
# 用法：verify_redis_connection localhost 26379 "password"
verify_redis_connection() {
  local host="${1:-localhost}"
  local port="${2:-6379}"
  local password="${3:-}"

  log_section "验证 Redis 连接"

  if ! command -v redis-cli &>/dev/null; then
    log_warning "redis-cli 未安装，跳过 Redis 连接验证"
    return 0
  fi

  local -a redis_cmd
  redis_cmd=(redis-cli -h "$host" -p "$port")
  if [ -n "$password" ]; then
    redis_cmd+=(-a "$password")
  fi

  if "${redis_cmd[@]}" ping 2>/dev/null | grep -q "PONG"; then
    log_success "Redis 连接成功"
    return 0
  fi

  log_error "Redis 连接失败"
  return 1
}

# 验证 MongoDB 连接
# 用法：verify_mongodb_connection mongodb://admin:password@localhost:27017/admin
verify_mongodb_connection() {
  local uri="$1"

  if [ -z "$uri" ]; then
    log_error "MongoDB 连接字符串为空"
    return 1
  fi

  log_section "验证 MongoDB 连接"
  log_info "连接字符串: $uri (密码已隐藏)"

  if command -v mongosh &>/dev/null; then
    if mongosh "$uri" --quiet --eval "db.version()" &>/dev/null; then
      log_success "MongoDB 连接成功"
      return 0
    else
      log_error "MongoDB 连接失败"
      return 1
    fi
  else
    log_warning "mongosh 未安装，跳过连接验证"
    return 0
  fi
}

# 验证 MySQL 连接
# 用法：verify_mysql_connection -h localhost -u root -p password database_name
verify_mysql_connection() {
  log_section "验证 MySQL 连接"

  if command -v mysql &>/dev/null; then
    if mysql "$@" -e "SELECT 1" &>/dev/null; then
      log_success "MySQL 连接成功"
      return 0
    else
      log_error "MySQL 连接失败"
      return 1
    fi
  else
    log_warning "mysql 未安装，跳过连接验证"
    return 0
  fi
}

################################################################################
# 数据库初始化相关
################################################################################

# 运行数据库初始化脚本
# 用法：run_database_init_script /var/www/morning-reading/backend
# 返回：0 成功，1 失败
run_database_init_script() {
  local backend_dir="$1"

  if [ -z "$backend_dir" ] || [ ! -f "$backend_dir/scripts/init-all.js" ]; then
    log_error "init-all.js 不存在: $backend_dir/scripts/init-all.js"
    return 1
  fi

  log_section "运行数据库初始化脚本"

  cd "$backend_dir" || return 1

  log_info "执行 node scripts/init-all.js..."
  if node scripts/init-all.js; then
    log_success "数据库初始化完成"
    return 0
  else
    log_error "数据库初始化失败"
    return 1
  fi
}

# 初始化特定的课程数据
# 用法：init_course_data /var/www/morning-reading/backend init-23-days.js
# 返回：0 成功，1 失败
init_course_data() {
  local backend_dir="$1"
  local script_name="$2"

  if [ -z "$backend_dir" ] || [ -z "$script_name" ]; then
    log_error "参数不完整"
    return 1
  fi

  local script_path="$backend_dir/scripts/$script_name"

  if [ ! -f "$script_path" ]; then
    log_error "脚本不存在: $script_path"
    return 1
  fi

  log_section "初始化课程数据: $script_name"

  cd "$backend_dir" || return 1

  log_info "执行 node scripts/$script_name..."
  if node "scripts/$script_name"; then
    log_success "课程数据初始化完成"
    return 0
  else
    log_error "课程数据初始化失败"
    return 1
  fi
}

################################################################################
# 数据库备份相关
################################################################################

# 备份 MongoDB
# 用法：backup_mongodb localhost morning_reading /path/to/backup
# 返回：0 成功，1 失败
backup_mongodb() {
  local host="${1:-localhost}"
  local database="${2:-morning_reading}"
  local backup_dir="${3:-.}"

  log_section "备份 MongoDB"

  if ! command -v mongodump &>/dev/null; then
    log_error "mongodump 未安装"
    return 1
  fi

  local backup_file="$backup_dir/mongodb_backup_$(date +%Y%m%d_%H%M%S)"

  log_info "备份位置: $backup_file"
  log_info "执行 mongodump..."

  if mongodump --host "$host" --db "$database" --out "$backup_file" 2>/dev/null; then
    log_success "MongoDB 备份完成: $backup_file"
    echo "$backup_file"
    return 0
  else
    log_error "MongoDB 备份失败"
    return 1
  fi
}

# 备份 MySQL
# 用法：backup_mysql -h localhost -u root -p password database_name /path/to/backup
# 返回：0 成功，1 失败
backup_mysql() {
  log_section "备份 MySQL"

  if ! command -v mysqldump &>/dev/null; then
    log_error "mysqldump 未安装"
    return 1
  fi

  # 最后一个参数是备份目录
  local backup_dir="${*: -1}"
  local db_args="${*:1:$#-1}"

  local backup_file="$backup_dir/mysql_backup_$(date +%Y%m%d_%H%M%S).sql"

  log_info "备份位置: $backup_file"
  log_info "执行 mysqldump..."

  if mysqldump $db_args > "$backup_file" 2>/dev/null; then
    log_success "MySQL 备份完成: $backup_file"
    echo "$backup_file"
    return 0
  else
    log_error "MySQL 备份失败"
    return 1
  fi
}

################################################################################
# 数据库恢复相关
################################################################################

# 恢复 MongoDB
# 用法：restore_mongodb /path/to/mongodb_backup localhost morning_reading
# 返回：0 成功，1 失败
restore_mongodb() {
  local backup_path="$1"
  local host="${2:-localhost}"
  local database="${3:-morning_reading}"

  if [ -z "$backup_path" ] || [ ! -d "$backup_path" ]; then
    log_error "备份目录无效: $backup_path"
    return 1
  fi

  log_section "恢复 MongoDB"

  if ! command -v mongorestore &>/dev/null; then
    log_error "mongorestore 未安装"
    return 1
  fi

  log_warning "此操作将覆盖现有数据库: $database"

  if ! confirm "确实要恢复吗？"; then
    log_info "已取消恢复"
    return 0
  fi

  log_info "执行 mongorestore..."
  if mongorestore --host "$host" --db "$database" "$backup_path" 2>/dev/null; then
    log_success "MongoDB 恢复完成"
    return 0
  else
    log_error "MongoDB 恢复失败"
    return 1
  fi
}

# 恢复 MySQL
# 用法：restore_mysql /path/to/mysql_backup.sql -h localhost -u root -p password database_name
# 返回：0 成功，1 失败
restore_mysql() {
  local backup_file="$1"

  if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
    log_error "备份文件无效: $backup_file"
    return 1
  fi

  log_section "恢复 MySQL"

  if ! command -v mysql &>/dev/null; then
    log_error "mysql 未安装"
    return 1
  fi

  local db_args="${*:2}"

  log_warning "此操作将覆盖现有数据库"

  if ! confirm "确实要恢复吗？"; then
    log_info "已取消恢复"
    return 0
  fi

  log_info "执行恢复..."
  if mysql $db_args < "$backup_file" 2>/dev/null; then
    log_success "MySQL 恢复完成"
    return 0
  else
    log_error "MySQL 恢复失败"
    return 1
  fi
}

################################################################################
# 数据库清理相关
################################################################################

# 清空 MongoDB 数据库
# 用法：clear_mongodb_database admin password localhost morning_reading
# 返回：0 成功，1 失败
clear_mongodb_database() {
  local admin_user="$1"
  local admin_password="$2"
  local host="${3:-localhost}"
  local database="${4:-morning_reading}"

  log_section "清空 MongoDB 数据库"
  log_warning "⚠️  此操作会删除所有数据！"

  if ! confirm "确实要清空数据库 $database 吗？"; then
    log_info "已取消"
    return 0
  fi

  if ! command -v mongosh &>/dev/null; then
    log_error "mongosh 未安装"
    return 1
  fi

  local uri="mongodb://$admin_user:$admin_password@$host:27017/$database"

  log_info "连接到数据库: $uri (密码已隐藏)"
  if mongosh "$uri" --eval "db.dropDatabase()" --quiet 2>/dev/null; then
    log_success "数据库已清空"
    return 0
  else
    log_error "清空数据库失败"
    return 1
  fi
}

################################################################################
# 导出函数，使其在 sourced 脚本中可用
################################################################################

export -f start_docker_containers
export -f stop_docker_containers
export -f check_docker_containers
export -f get_container_logs
export -f cleanup_docker_containers
export -f wait_for_mongodb
export -f wait_for_mysql
export -f wait_for_redis
export -f verify_mongodb_connection
export -f verify_mysql_connection
export -f run_database_init_script
export -f init_course_data
export -f backup_mongodb
export -f backup_mysql
export -f restore_mongodb
export -f restore_mysql
export -f clear_mongodb_database
