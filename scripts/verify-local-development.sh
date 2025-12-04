#!/bin/bash

###############################################################################
# 晨读营本地开发环境验证脚本
# 用途: 快速验证本地开发环境中所有服务是否正常运行
# 使用: bash scripts/verify-local-development.sh
# 版本: 1.0.0
# 说明: 与生产验证脚本配对，但适配本地开发环境配置
###############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 统计变量
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# 获取脚本执行路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

###############################################################################
# 工具函数
###############################################################################

log_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED_CHECKS++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNING_CHECKS++))
}

log_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

log_section() {
    echo -e "${BLUE}→ $1${NC}"
}

run_check() {
    ((TOTAL_CHECKS++))
    log_info "检查 #$TOTAL_CHECKS: $1"
}

###############################################################################
# 第1部分: Node.js 和依赖检查
###############################################################################

check_environment() {
    log_header "第1部分: 开发环境检查"

    run_check "Node.js 是否已安装"
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log_success "Node.js 已安装: $NODE_VERSION"
    else
        log_error "Node.js 未安装，请先安装 Node.js v20+"
        return 1
    fi

    run_check "npm 是否已安装"
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        log_success "npm 已安装: $NPM_VERSION"
    else
        log_error "npm 未安装"
        return 1
    fi

    run_check "MongoDB 是否已安装"
    if command -v mongosh &> /dev/null || command -v mongo &> /dev/null; then
        MONGO_VERSION=$(mongosh --version 2>/dev/null || mongo --version | grep "shell version")
        log_success "MongoDB 已安装: $MONGO_VERSION"
    else
        log_warning "MongoDB 未找到，请确保 MongoDB 已单独运行或通过 Docker 运行"
    fi

    run_check "Git 是否已安装"
    if command -v git &> /dev/null; then
        GIT_VERSION=$(git --version)
        log_success "Git 已安装: $GIT_VERSION"
    else
        log_error "Git 未安装"
    fi
}

###############################################################################
# 第2部分: 项目结构检查
###############################################################################

check_project_structure() {
    log_header "第2部分: 项目结构检查"

    run_check "项目根目录是否正确"
    if [ -d "$PROJECT_ROOT" ]; then
        log_success "项目根目录: $PROJECT_ROOT"
    else
        log_error "无法找到项目根目录"
        return 1
    fi

    run_check "Backend 项目目录"
    if [ -d "$PROJECT_ROOT/backend" ]; then
        log_success "Backend 目录存在"
    else
        log_error "Backend 目录不存在"
    fi

    run_check "Backend package.json"
    if [ -f "$PROJECT_ROOT/backend/package.json" ]; then
        log_success "Backend package.json 存在"
    else
        log_error "Backend package.json 不存在"
    fi

    run_check "Admin 项目目录"
    if [ -d "$PROJECT_ROOT/admin" ]; then
        log_success "Admin 目录存在"
    else
        log_warning "Admin 目录不存在（可选组件）"
    fi

    run_check "小程序目录"
    if [ -d "$PROJECT_ROOT/miniprogram" ]; then
        log_success "小程序目录存在"
    else
        log_warning "小程序目录不存在（可选组件）"
    fi
}

###############################################################################
# 第3部分: Backend 依赖和运行检查
###############################################################################

check_backend() {
    log_header "第3部分: Backend 服务检查"

    run_check "Backend node_modules 是否已安装"
    if [ -d "$PROJECT_ROOT/backend/node_modules" ]; then
        MODULES_COUNT=$(ls -1 "$PROJECT_ROOT/backend/node_modules" | wc -l)
        log_success "Backend 依赖已安装 (~$MODULES_COUNT 个模块)"
    else
        log_warning "Backend node_modules 不存在，需要运行: cd backend && npm install"
    fi

    run_check "Backend 港口 3000 占用情况"
    if lsof -i :3000 &> /dev/null; then
        PROCESS=$(lsof -i :3000 | tail -1 | awk '{print $1}')
        log_success "端口 3000 已被占用 (进程: $PROCESS)"
    else
        log_warning "端口 3000 未被占用（Backend 可能未运行）"
    fi

    run_check "Backend 服务是否在运行"
    if curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1; then
        HEALTH=$(curl -s http://localhost:3000/api/v1/health | grep -o "ok")
        if [ "$HEALTH" = "ok" ]; then
            log_success "Backend 健康检查通过"
        else
            log_warning "Backend 响应但健康检查可能有问题"
        fi
    else
        log_warning "Backend 服务未响应，请运行: cd backend && npm run dev"
    fi

    run_check "Backend 源代码目录"
    if [ -d "$PROJECT_ROOT/backend/src" ]; then
        log_success "Backend 源代码存在"
    else
        log_error "Backend 源代码目录不存在"
    fi
}

###############################################################################
# 第4部分: MongoDB 检查
###############################################################################

check_mongodb() {
    log_header "第4部分: MongoDB 数据库检查"

    run_check "MongoDB 本地连接检查"
    if timeout 5 mongosh --eval "db.runCommand('ping')" > /dev/null 2>&1; then
        log_success "MongoDB 本地连接成功"
    else
        # 尝试通过 Docker 连接
        if docker ps 2>/dev/null | grep -q mongo; then
            log_success "MongoDB 在 Docker 中运行"
        else
            log_warning "MongoDB 未在本地或 Docker 中运行，请启动 MongoDB"
        fi
    fi

    run_check "MongoDB 数据库是否存在"
    if timeout 5 mongosh morning_reading --eval "db.runCommand('ping')" > /dev/null 2>&1; then
        log_success "morning_reading 数据库存在且可访问"
    else
        log_warning "未找到 morning_reading 数据库（首次启动是正常的）"
    fi

    run_check "MongoDB 集合检查"
    if timeout 5 mongosh morning_reading --eval "db.getCollectionNames()" 2>/dev/null | grep -q "users\|insights"; then
        log_success "数据库集合已初始化"
    else
        log_warning "数据库集合未初始化，需要运行初始化脚本"
    fi
}

###############################################################################
# 第5部分: Admin 前端检查
###############################################################################

check_admin() {
    log_header "第5部分: Admin 前端检查"

    run_check "Admin 项目存在"
    if [ -d "$PROJECT_ROOT/admin" ]; then
        log_success "Admin 项目目录存在"
    else
        log_warning "Admin 项目不存在（可选组件）"
        return
    fi

    run_check "Admin node_modules 是否已安装"
    if [ -d "$PROJECT_ROOT/admin/node_modules" ]; then
        log_success "Admin 依赖已安装"
    else
        log_warning "Admin node_modules 不存在，需要运行: cd admin && npm install"
    fi

    run_check "Admin 港口 5173 占用情况"
    if lsof -i :5173 &> /dev/null; then
        log_success "端口 5173 已被占用（Vite 开发服务器）"
    else
        log_warning "端口 5173 未被占用（Admin 开发服务器未运行）"
    fi

    run_check "Admin 开发服务器响应"
    if timeout 3 curl -s http://localhost:5173 > /dev/null 2>&1; then
        log_success "Admin 开发服务器响应正常"
    else
        log_warning "Admin 开发服务器未响应，请运行: cd admin && npm run dev"
    fi
}

###############################################################################
# 第6部分: 小程序检查
###############################################################################

check_miniprogram() {
    log_header "第6部分: 小程序检查"

    run_check "小程序目录存在"
    if [ -d "$PROJECT_ROOT/miniprogram" ]; then
        log_success "小程序目录存在"
    else
        log_warning "小程序目录不存在（可选组件）"
        return
    fi

    run_check "小程序项目文件"
    if [ -f "$PROJECT_ROOT/miniprogram/app.js" ] && [ -f "$PROJECT_ROOT/miniprogram/app.json" ]; then
        log_success "小程序主文件存在"
    else
        log_error "小程序主文件不完整"
    fi

    run_check "小程序页面目录"
    if [ -d "$PROJECT_ROOT/miniprogram/pages" ] && [ $(ls -1 "$PROJECT_ROOT/miniprogram/pages" | wc -l) -gt 0 ]; then
        PAGE_COUNT=$(ls -1 "$PROJECT_ROOT/miniprogram/pages" | wc -l)
        log_success "小程序页面存在 ($PAGE_COUNT 个页面目录)"
    else
        log_warning "小程序页面目录为空"
    fi

    run_check "WeUI 组件库"
    if find "$PROJECT_ROOT/miniprogram" -name "*weui*" | grep -q .; then
        log_success "WeUI 组件库存在"
    else
        log_warning "未找到 WeUI 组件库"
    fi
}

###############################################################################
# 第7部分: API 功能测试
###############################################################################

check_api_functionality() {
    log_header "第7部分: API 功能测试"

    run_check "健康检查端点"
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/health 2>/dev/null)
    if [ "$RESPONSE" = "200" ]; then
        log_success "健康检查端点正常 (HTTP $RESPONSE)"
    else
        log_warning "健康检查端点异常 (HTTP $RESPONSE)"
    fi

    run_check "用户列表接口"
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/users 2>/dev/null)
    if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "401" ]; then
        log_success "用户列表接口可访问 (HTTP $RESPONSE)"
    else
        log_warning "用户列表接口异常 (HTTP $RESPONSE)"
    fi

    run_check "打卡列表接口"
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/insights 2>/dev/null)
    if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "401" ]; then
        log_success "打卡列表接口可访问 (HTTP $RESPONSE)"
    else
        log_warning "打卡列表接口异常 (HTTP $RESPONSE)"
    fi

    run_check "API 响应时间"
    START=$(date +%s%N)
    curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1
    END=$(date +%s%N)
    DURATION=$(( (END - START) / 1000000 ))
    if [ "$DURATION" -lt 500 ]; then
        log_success "API 响应时间: ${DURATION}ms (快速)"
    elif [ "$DURATION" -lt 1000 ]; then
        log_success "API 响应时间: ${DURATION}ms (正常)"
    else
        log_warning "API 响应时间: ${DURATION}ms (较慢)"
    fi
}

###############################################################################
# 第8部分: 文件系统检查
###############################################################################

check_filesystem() {
    log_header "第8部分: 文件系统检查"

    run_check ".env 文件配置"
    if [ -f "$PROJECT_ROOT/backend/.env" ]; then
        log_success "Backend .env 文件存在"
    else
        log_warning "Backend .env 文件不存在，需要创建"
    fi

    run_check ".env.example 文件"
    if [ -f "$PROJECT_ROOT/backend/.env.example" ]; then
        log_success "Backend .env.example 文件存在"
    else
        log_info ".env.example 不存在（可用于参考）"
    fi

    run_check "日志目录"
    if [ -d "$PROJECT_ROOT/logs" ]; then
        LOGS=$(find "$PROJECT_ROOT/logs" -name "*.log" 2>/dev/null | wc -l)
        log_success "日志目录存在 ($LOGS 个日志文件)"
    else
        log_info "日志目录不存在（Backend 运行时会自动创建）"
    fi

    run_check "node_modules 大小"
    if [ -d "$PROJECT_ROOT/backend/node_modules" ]; then
        SIZE=$(du -sh "$PROJECT_ROOT/backend/node_modules" 2>/dev/null | awk '{print $1}')
        log_info "Backend node_modules 大小: $SIZE"
    fi
}

###############################################################################
# 第9部分: 性能指标
###############################################################################

check_performance() {
    log_header "第9部分: 性能指标"

    run_check "CPU 使用率"
    CPU_USAGE=$(top -l 1 2>/dev/null | grep "CPU usage" | awk '{print $3}' | sed 's/%//' || echo "未知")
    if [ "$CPU_USAGE" != "未知" ]; then
        if (( $(echo "$CPU_USAGE < 50" | bc -l) )); then
            log_success "CPU 使用率: ${CPU_USAGE}% (正常)"
        else
            log_warning "CPU 使用率: ${CPU_USAGE}% (较高)"
        fi
    else
        log_info "无法获取 CPU 使用率"
    fi

    run_check "内存使用率"
    if command -v free &> /dev/null; then
        MEM_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100)}')
        if [ "$MEM_USAGE" -lt 70 ]; then
            log_success "内存使用率: $MEM_USAGE% (正常)"
        else
            log_warning "内存使用率: $MEM_USAGE% (较高)"
        fi
    else
        log_info "无法获取内存使用率"
    fi

    run_check "磁盘空间"
    DISK_USAGE=$(df "$PROJECT_ROOT" 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ -n "$DISK_USAGE" ]; then
        if [ "$DISK_USAGE" -lt 80 ]; then
            log_success "磁盘使用率: $DISK_USAGE% (充足)"
        else
            log_warning "磁盘使用率: $DISK_USAGE% (较高)"
        fi
    fi
}

###############################################################################
# 第10部分: 快速命令参考
###############################################################################

show_quick_commands() {
    log_header "第10部分: 快速命令参考"

    echo -e "${CYAN}📌 启动开发服务${NC}"
    echo "  # 启动所有服务（推荐）"
    echo "  bash .claude/commands/development/start-all.sh"
    echo ""
    echo "  # 仅启动 Backend"
    echo "  cd backend && npm run dev"
    echo ""
    echo "  # 仅启动 Admin"
    echo "  cd admin && npm run dev"
    echo ""

    echo -e "${CYAN}📌 数据库操作${NC}"
    echo "  # 初始化数据库"
    echo "  node backend/scripts/init-mongodb.js"
    echo ""
    echo "  # 连接 MongoDB"
    echo "  mongosh morning_reading"
    echo ""

    echo -e "${CYAN}📌 测试和验证${NC}"
    echo "  # 本地验证脚本（即将运行）"
    echo "  bash scripts/verify-local-development.sh"
    echo ""
    echo "  # 生产验证脚本"
    echo "  bash scripts/verify-production-deployment.sh"
    echo ""

    echo -e "${CYAN}📌 Git 操作${NC}"
    echo "  # 查看 Git 状态"
    echo "  git status"
    echo ""
    echo "  # 查看最近提交"
    echo "  git log --oneline | head -10"
    echo ""
}

###############################################################################
# 生成验证报告
###############################################################################

generate_report() {
    log_header "验证报告"

    echo ""
    echo -e "${CYAN}┌─────────────────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│        晨读营本地开发环境验证报告                      │${NC}"
    echo -e "${CYAN}└─────────────────────────────────────────────────────────┘${NC}"
    echo ""
    echo -e "验证时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo -e "项目路径: $PROJECT_ROOT"
    echo -e "操作系统: $(uname -s)"
    echo ""

    echo -e "${CYAN}📊 验证统计:${NC}"
    echo "  总检查项: $TOTAL_CHECKS"
    echo -e "  ${GREEN}通过: $PASSED_CHECKS${NC}"
    echo -e "  ${YELLOW}警告: $WARNING_CHECKS${NC}"
    echo -e "  ${RED}失败: $FAILED_CHECKS${NC}"
    echo ""

    # 计算成功率
    if [ $TOTAL_CHECKS -gt 0 ]; then
        SUCCESS_RATE=$(( (PASSED_CHECKS + WARNING_CHECKS) * 100 / TOTAL_CHECKS ))
    else
        SUCCESS_RATE=0
    fi

    echo -e "${CYAN}📈 成功率: $SUCCESS_RATE%${NC}"
    echo ""

    # 生成整体评价
    if [ $FAILED_CHECKS -eq 0 ] && [ $WARNING_CHECKS -lt 3 ]; then
        echo -e "${GREEN}✅ 本地开发环境验证通过 - 可以开始开发${NC}"
    elif [ $FAILED_CHECKS -eq 0 ]; then
        echo -e "${YELLOW}⚠️  本地开发环境基本就绪 - 建议处理警告项${NC}"
    else
        echo -e "${RED}❌ 本地开发环境有问题 - 需要立即处理${NC}"
    fi

    echo ""
}

###############################################################################
# 问题排查建议
###############################################################################

show_troubleshooting() {
    if [ $FAILED_CHECKS -gt 0 ] || [ $WARNING_CHECKS -gt 5 ]; then
        log_header "故障排查建议"

        echo -e "${YELLOW}🔧 常见问题和解决方案:${NC}"
        echo ""
        echo "1️⃣  Backend 未运行或无法连接"
        echo "   解决: cd backend && npm install && npm run dev"
        echo ""
        echo "2️⃣  MongoDB 连接失败"
        echo "   解决: "
        echo "   - 本地运行: brew services start mongodb-community"
        echo "   - Docker 运行: docker-compose up -d mongodb"
        echo ""
        echo "3️⃣  依赖未安装"
        echo "   解决: "
        echo "   - cd backend && npm install"
        echo "   - cd admin && npm install"
        echo ""
        echo "4️⃣  端口已被占用"
        echo "   解决: lsof -i :3000 | tail -1 | awk '{print \$2}' | xargs kill -9"
        echo ""
        echo "5️⃣  .env 文件缺失"
        echo "   解决: cp backend/.env.example backend/.env"
        echo "        # 然后编辑 .env 文件，填入实际的配置值"
        echo ""
    fi
}

###############################################################################
# 主函数
###############################################################################

main() {
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "   🚀 晨读营本地开发环境验证脚本"
    echo "   版本: 1.0.0"
    echo "   时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    # 执行所有检查
    check_environment
    check_project_structure
    check_backend
    check_mongodb
    check_admin
    check_miniprogram
    check_api_functionality
    check_filesystem
    check_performance

    # 显示快速命令参考
    show_quick_commands

    # 生成报告
    generate_report

    # 显示故障排查建议
    show_troubleshooting

    # 返回正确的退出码
    if [ $FAILED_CHECKS -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# 运行主函数
main
