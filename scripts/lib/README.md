# 部署函数库 - Deployment Function Libraries

> 所有部署脚本的基础代码库。通过模块化设计，实现代码复用、易于维护和扩展。

---

## 📚 库的组织结构

```
scripts/lib/
├── utils.sh                    # 🔧 基础工具库
├── deploy-functions.sh         # 🚀 部署函数库
├── database-functions.sh       # 💾 数据库函数库
├── infrastructure-functions.sh # ⚙️ 基础设施函数库
└── README.md                   # 📖 本文档
```

---

## 🔧 utils.sh - 基础工具库（基础）

**职责**: 提供所有其他库都依赖的基础工具

**包含内容**:

### 1️⃣ 颜色定义
```bash
RED, GREEN, YELLOW, BLUE, MAGENTA, NC
```

### 2️⃣ 日志函数
```bash
log_header "标题"           # 大标题
log_section "小标题"        # 小标题
log_info "信息"            # 蓝色信息
log_success "成功消息"      # 绿色成功
log_warning "警告消息"      # 黄色警告
log_error "错误消息"        # 红色错误
```

### 3️⃣ 系统检查函数
```bash
check_command "npm"        # 检查命令是否安装
check_file "/path/file"   # 检查文件是否存在
check_dir "/path/dir"     # 检查目录是否存在
```

### 4️⃣ 用户交互函数
```bash
confirm "要继续吗？"        # 获取用户确认 (y/n)
```

### 5️⃣ 网络工具函数
```bash
wait_for_port "host" "port" "timeout"  # 等待端口就绪
```

### 6️⃣ 远程执行函数
```bash
ssh_exec "user@host" "command"                      # 执行远程命令
scp_upload "/local/file" "/remote/path" "host"    # 上传文件
scp_download "/remote/file" "/local/path" "host"  # 下载文件
```

**使用方式**:
```bash
source scripts/lib/utils.sh

log_success "初始化完成"
wait_for_port localhost 3000 30 || exit 1
```

---

## 🚀 deploy-functions.sh - 部署函数库

**职责**: 处理应用部署的核心操作

**依赖**: 必须先加载 `utils.sh`

**包含内容**:

### 1️⃣ 前端构建
```bash
build_admin "/path/to/admin"  # 构建 Vue3 管理后台
```

### 2️⃣ 后端依赖
```bash
install_backend_dependencies "/path/to/backend"
```

### 3️⃣ PM2 进程管理
```bash
restart_pm2_app "app-name" "/path/to/backend"
stop_pm2_app "app-name"
setup_pm2_logrotate              # 配置日志轮转（500MB/文件）
check_pm2_status "app-name"      # 查看状态
```

### 4️⃣ Nginx 管理
```bash
validate_nginx_config            # 验证配置（必须在 reload/restart 前）
reload_nginx                     # 重新加载（不中断连接）
restart_nginx                    # 重启（会中断连接）
```

### 5️⃣ 备份
```bash
create_server_backup "/var/www/morning-reading" \
  "ubuntu" "118.25.145.179" "~/.ssh/id_rsa"
```

### 6️⃣ 文件操作
```bash
copy_config_files_to_server ".env.config.js" \
  "ubuntu" "118.25.145.179" "~/.ssh/id_rsa" "/var/www/morning-reading"

deploy_files_on_server "/tmp/package.tar.gz" \
  "/var/www/morning-reading" "ubuntu" "118.25.145.179" "~/.ssh/id_rsa"
```

### 7️⃣ 验证部署
```bash
verify_backend_online "ubuntu" "118.25.145.179" "~/.ssh/id_rsa" "app-name"
verify_admin_files "ubuntu" "118.25.145.179" "~/.ssh/id_rsa" "/path/dist"
```

**使用方式**:
```bash
source scripts/lib/utils.sh
source scripts/lib/deploy-functions.sh

build_admin "./admin" || exit 1
restart_pm2_app "morning-reading-backend" "./backend" || exit 1
setup_pm2_logrotate || true
reload_nginx || exit 1
```

---

## 💾 database-functions.sh - 数据库函数库

**职责**: 处理数据库和 Docker 容器管理

**依赖**: 必须先加载 `utils.sh`

**包含内容**:

### 1️⃣ Docker 容器管理
```bash
start_docker_containers "/var/www/morning-reading/backend"
stop_docker_containers "/var/www/morning-reading/backend"
check_docker_containers                           # 查看所有容器
get_container_logs "mongodb" 50                   # 查看容器日志（最后 50 行）
cleanup_docker_containers "/path/to/backend"     # ⚠️ 删除容器和卷
```

### 2️⃣ 数据库连接验证
```bash
wait_for_mongodb "localhost" "27017" "30"        # 等待 MongoDB 就绪
wait_for_mysql "localhost" "3306" "30"          # 等待 MySQL 就绪
wait_for_redis "localhost" "6379" "30"          # 等待 Redis 就绪

verify_mongodb_connection "mongodb://admin:pass@localhost:27017/admin"
verify_mysql_connection -h localhost -u root -p password database_name
```

### 3️⃣ 数据库初始化
```bash
run_database_init_script "/var/www/morning-reading/backend"
init_course_data "/path/to/backend" "init-23-days.js"  # 替换课程数据
```

### 4️⃣ 备份
```bash
backup_mongodb "localhost" "morning_reading" "/path/to/backup"
backup_mysql -h localhost -u root -p password database_name /path/to/backup
```

### 5️⃣ 恢复
```bash
restore_mongodb "/path/to/mongodb_backup" "localhost" "morning_reading"
restore_mysql "/path/to/mysql_backup.sql" -h localhost -u root -p password db_name
```

### 6️⃣ 清理
```bash
clear_mongodb_database "admin" "password" "localhost" "morning_reading"  # ⚠️ 删除所有数据
```

**使用方式**:
```bash
source scripts/lib/utils.sh
source scripts/lib/database-functions.sh

start_docker_containers "./backend" || exit 1
wait_for_mongodb "localhost" "27017" "30" || exit 1
run_database_init_script "./backend" || exit 1
```

---

## ⚙️ infrastructure-functions.sh - 基础设施函数库

**职责**: 处理系统级别的初始化和配置

**依赖**: 必须先加载 `utils.sh`

**包含内容**:

### 1️⃣ 系统检查
```bash
check_sudo_access                                  # 检查是否有 sudo 权限
check_system_architecture                          # 检查 CPU 架构
check_disk_space "/var/www" "10"                 # 检查磁盘空间（需要 10GB）
```

### 2️⃣ 软件安装
```bash
install_nodejs          # Node.js + npm
install_docker          # Docker（使用官方脚本）
install_docker_compose  # Docker Compose v2
install_pm2             # PM2（全局）
install_nginx           # Nginx Web 服务器
install_certbot         # Certbot（Let's Encrypt）
```

### 3️⃣ 权限配置
```bash
setup_ubuntu_user_permissions                     # 配置 ubuntu 用户的 docker/sudo 权限
setup_app_directories "/var/www/morning-reading" "ubuntu"
```

### 4️⃣ 文件和配置
```bash
copy_project_files "/local/path" "ubuntu" "118.25.145.179" \
  "~/.ssh/id_rsa" "/var/www/morning-reading"

create_symlink "/source/file" "/link/path"        # 创建符号链接
```

### 5️⃣ 网络和防火墙
```bash
setup_firewall_rules    # 配置 ufw（允许 SSH、HTTP、HTTPS）
```

**使用方式**:
```bash
source scripts/lib/utils.sh
source scripts/lib/infrastructure-functions.sh

check_disk_space "/var/www" "10" || exit 1
install_nodejs || exit 1
install_docker || exit 1
setup_ubuntu_user_permissions
setup_app_directories "/var/www/morning-reading" "ubuntu"
```

---

## 📖 如何使用这些库

### 示例 1: 部署脚本
```bash
#!/bin/bash

# 在脚本开头加载所需的库
source "$(dirname "${BASH_SOURCE[0]}")/lib/utils.sh"
source "$(dirname "${BASH_SOURCE[0]}")/lib/deploy-functions.sh"

# 然后就可以使用库中的函数
build_admin "./admin" || exit 1
restart_pm2_app "morning-reading-backend" "./backend" || exit 1
reload_nginx || exit 1

log_success "部署完成！"
```

### 示例 2: 初始化脚本
```bash
#!/bin/bash

source "$(dirname "${BASH_SOURCE[0]}")/lib/utils.sh"
source "$(dirname "${BASH_SOURCE[0]}")/lib/infrastructure-functions.sh"
source "$(dirname "${BASH_SOURCE[0]}")/lib/database-functions.sh"

# 系统初始化
install_nodejs || exit 1
install_docker || exit 1
setup_app_directories "/var/www/morning-reading" "ubuntu"

# 启动数据库
start_docker_containers "./backend" || exit 1
wait_for_mongodb || exit 1
```

### 示例 3: 自定义脚本
```bash
#!/bin/bash

# 加载多个库
source "$(dirname "${BASH_SOURCE[0]}")/lib/utils.sh"
source "$(dirname "${BASH_SOURCE[0]}")/lib/deploy-functions.sh"
source "$(dirname "${BASH_SOURCE[0]}")/lib/database-functions.sh"

# 组合使用函数实现自定义功能
log_header "备份并部署"

create_server_backup "/var/www/morning-reading" "ubuntu" "118.25.145.179" "~/.ssh/id_rsa"
deploy_files_on_server "/tmp/package.tar.gz" "/var/www/morning-reading" "ubuntu" "118.25.145.179" "~/.ssh/id_rsa"
restart_pm2_app "morning-reading-backend" "/var/www/morning-reading/backend"
```

---

## ✅ 函数设计原则

### 1. 返回值约定
- **0**: 成功
- **1**: 失败
- **其他**: 返回数据（如时间戳、文件路径）

### 2. 参数传递
- 始终检查参数是否为空
- 使用有意义的参数名称
- 在注释中提供使用示例

### 3. 错误处理
- 使用 `log_error` 记录错误
- 允许脚本继续执行（不用 `set -e`），便于调试
- 在关键步骤检查返回值

### 4. 日志输出
- 使用 `log_section` 标记操作开始
- 使用 `log_info` 输出进度信息
- 使用 `log_success` 标记完成
- 使用 `log_warning` 输出警告
- 使用 `log_error` 输出错误

---

## 🔄 库之间的依赖关系

```
utils.sh (基础)
    ↓
    ├─→ deploy-functions.sh (部署操作)
    ├─→ database-functions.sh (数据库操作)
    └─→ infrastructure-functions.sh (基础设施操作)

部署脚本可以组合使用多个库:
    deployment.sh
    ├─ 加载 utils.sh
    ├─ 加载 infrastructure-functions.sh (安装依赖)
    ├─ 加载 database-functions.sh (初始化数据库)
    └─ 加载 deploy-functions.sh (部署应用)
```

---

## 🛠️ 添加新函数的步骤

1. **确定函数所属的库**
   - 系统工具 → `utils.sh`
   - 应用部署 → `deploy-functions.sh`
   - 数据库操作 → `database-functions.sh`
   - 基础设施 → `infrastructure-functions.sh`

2. **编写函数**
   ```bash
   # 函数名称: my_function
   # 用法: my_function param1 param2
   # 返回: 0 成功，1 失败
   my_function() {
     local param1="$1"
     local param2="$2"

     if [ -z "$param1" ]; then
       log_error "param1 不能为空"
       return 1
     fi

     # 函数实现...

     log_success "操作完成"
     return 0
   }
   ```

3. **添加到导出列表**
   ```bash
   export -f my_function
   ```

4. **在函数库顶部添加注释**
   ```bash
   ################################################################################
   # 新功能分类
   ################################################################################
   ```

---

## 📋 检查清单

使用函数库时确保:

- [ ] 始终在脚本开头加载 `utils.sh`
- [ ] 按正确的顺序加载其他库
- [ ] 检查函数的返回值
- [ ] 在使用前验证前置条件（如文件是否存在）
- [ ] 使用 `log_*` 函数进行输出
- [ ] 处理错误而不是让脚本崩溃

---

## 🎯 性能提示

1. **避免重复加载**: 每个脚本只需在开头加载一次
2. **合理组织函数**: 相关的函数放在同一个库中
3. **使用本地变量**: 在函数中使用 `local` 声明变量
4. **异步操作**: 对于耗时操作，可以考虑后台执行

---

## 📝 维护和更新

- 定期审查函数库，移除未使用的函数
- 更新过期的 URL 和安装方式
- 保持文档与代码同步
- 在添加新函数时同步更新本文档

---

**最后更新**: 2026-03-13

**相关文档**:
- [`DEPLOYMENT.md`](../DEPLOYMENT.md) - 完整部署指南
- [`deploy-to-server.sh`](../deploy-to-server.sh) - 实时部署脚本示例
