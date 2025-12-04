#!/bin/bash

###############################################################################
# 晨读营生产环境部署验证脚本
# 用途: 部署完成后，全面检查所有服务是否正确启动和运行
# 使用: bash scripts/verify-production-deployment.sh
# 版本: 1.0.0
###############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 统计变量
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# 日志文件
LOG_FILE="/var/log/morning-reading-club/deployment-verification.log"
mkdir -p "$(dirname "$LOG_FILE")"

###############################################################################
# 工具函数
###############################################################################

log_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo "[$1]" >> "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    echo "✅ $1" >> "$LOG_FILE"
    ((PASSED_CHECKS++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    echo "❌ $1" >> "$LOG_FILE"
    ((FAILED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    echo "⚠️  $1" >> "$LOG_FILE"
    ((WARNING_CHECKS++))
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
    echo "ℹ️  $1" >> "$LOG_FILE"
}

run_check() {
    ((TOTAL_CHECKS++))
    log_info "检查 #$TOTAL_CHECKS: $1"
}

###############################################################################
# 第1部分: 容器和基础设施检查
###############################################################################

check_containers() {
    log_header "第1部分: Docker 容器检查"

    run_check "Docker 守护进程运行状态"
    if docker ps > /dev/null 2>&1; then
        log_success "Docker 守护进程正常运行"
    else
        log_error "Docker 守护进程未运行"
        return 1
    fi

    run_check "MongoDB 容器运行状态"
    MONGO_CONTAINER=$(docker ps --filter "name=morning-reading-mongodb" --format "{{.ID}}" 2>/dev/null || echo "")
    if [ -n "$MONGO_CONTAINER" ]; then
        MONGO_STATUS=$(docker inspect --format='{{.State.Running}}' "$MONGO_CONTAINER" 2>/dev/null)
        if [ "$MONGO_STATUS" = "true" ]; then
            log_success "MongoDB 容器正常运行"
        else
            log_error "MongoDB 容器状态异常: $MONGO_STATUS"
        fi
    else
        log_error "未找到 MongoDB 容器"
    fi

    run_check "Backend 容器运行状态"
    BACKEND_CONTAINER=$(docker ps --filter "name=morning-reading-backend" --format "{{.ID}}" 2>/dev/null || echo "")
    if [ -n "$BACKEND_CONTAINER" ]; then
        BACKEND_STATUS=$(docker inspect --format='{{.State.Running}}' "$BACKEND_CONTAINER" 2>/dev/null)
        if [ "$BACKEND_STATUS" = "true" ]; then
            log_success "Backend 容器正常运行"
        else
            log_error "Backend 容器状态异常: $BACKEND_STATUS"
        fi
    else
        log_error "未找到 Backend 容器"
    fi

    run_check "Nginx 容器运行状态"
    NGINX_CONTAINER=$(docker ps --filter "name=morning-reading-nginx" --format "{{.ID}}" 2>/dev/null || echo "")
    if [ -n "$NGINX_CONTAINER" ]; then
        NGINX_STATUS=$(docker inspect --format='{{.State.Running}}' "$NGINX_CONTAINER" 2>/dev/null)
        if [ "$NGINX_STATUS" = "true" ]; then
            log_success "Nginx 容器正常运行"
        else
            log_warning "Nginx 容器状态异常: $NGINX_STATUS (可选组件)"
        fi
    else
        log_warning "未找到 Nginx 容器 (可选组件)"
    fi

    run_check "Docker 容器磁盘占用"
    DOCKER_SIZE=$(docker ps -s --format "table {{.Names}}\t{{.Size}}" 2>/dev/null | tail -n +2 | awk '{print $NF}' | paste -sd+ | bc 2>/dev/null || echo "0")
    log_info "Docker 容器总占用空间: $DOCKER_SIZE"
}

###############################################################################
# 第2部分: MongoDB 数据库检查
###############################################################################

check_mongodb() {
    log_header "第2部分: MongoDB 数据库检查"

    run_check "MongoDB 连接可用性"
    if mongosh --version > /dev/null 2>&1; then
        # 如果有MongoDB认证，需要使用正确的连接字符串
        if timeout 10 mongosh mongodb://localhost:27017/morning_reading --eval "db.runCommand('ping')" > /dev/null 2>&1; then
            log_success "MongoDB 连接正常"
        else
            log_error "无法连接到 MongoDB"
            return 1
        fi
    else
        log_warning "mongosh 客户端未安装，跳过详细检查"
    fi

    run_check "MongoDB 数据库存在性"
    DB_EXISTS=$(mongosh mongodb://localhost:27017 --eval "db.getMongo().getDBNames().includes('morning_reading')" 2>/dev/null || echo "false")
    if [[ "$DB_EXISTS" == *"true"* ]]; then
        log_success "morning_reading 数据库存在"
    else
        log_warning "未找到 morning_reading 数据库（首次部署是正常的）"
    fi

    run_check "MongoDB 集合检查"
    COLLECTIONS=$(mongosh mongodb://localhost:27017/morning_reading --eval "db.getCollectionNames()" 2>/dev/null | grep -c "users\|insights\|periods" || echo "0")
    if [ "$COLLECTIONS" -gt 0 ]; then
        log_success "数据库集合已初始化"
    else
        log_warning "数据库集合未初始化（需要执行初始化脚本）"
    fi
}

###############################################################################
# 第3部分: Backend API 检查
###############################################################################

check_backend_api() {
    log_header "第3部分: Backend API 检查"

    run_check "Backend 服务港口 (3000) 开放性"
    if timeout 5 bash -c "echo >/dev/tcp/localhost/3000" 2>/dev/null; then
        log_success "Backend 港口 3000 已开放"
    else
        log_error "无法连接到 Backend 港口 3000"
        return 1
    fi

    run_check "Backend 健康检查端点"
    HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/health 2>/dev/null || echo "000")
    if [ "$HEALTH_RESPONSE" = "200" ]; then
        log_success "健康检查端点响应正常 (HTTP $HEALTH_RESPONSE)"
    else
        log_error "健康检查端点异常 (HTTP $HEALTH_RESPONSE)"
    fi

    run_check "Backend 状态端点"
    STATUS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/status 2>/dev/null || echo "000")
    if [ "$STATUS_RESPONSE" = "200" ]; then
        log_success "状态端点响应正常 (HTTP $STATUS_RESPONSE)"
    else
        log_warning "状态端点异常 (HTTP $STATUS_RESPONSE)"
    fi

    run_check "Backend 就绪检查端点"
    READY_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/ready 2>/dev/null || echo "000")
    if [ "$READY_RESPONSE" = "200" ]; then
        log_success "就绪检查端点响应正常"
    else
        log_error "就绪检查端点异常 (HTTP $READY_RESPONSE)"
    fi

    run_check "Backend API 响应时间"
    START_TIME=$(date +%s%N)
    curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1
    END_TIME=$(date +%s%N)
    RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
    if [ "$RESPONSE_TIME" -lt 1000 ]; then
        log_success "API 响应时间: ${RESPONSE_TIME}ms (优秀)"
    elif [ "$RESPONSE_TIME" -lt 2000 ]; then
        log_warning "API 响应时间: ${RESPONSE_TIME}ms (可接受)"
    else
        log_warning "API 响应时间: ${RESPONSE_TIME}ms (较慢)"
    fi
}

###############################################################################
# 第4部分: 认证和业务接口检查
###############################################################################

check_business_apis() {
    log_header "第4部分: 业务 API 检查"

    run_check "用户列表接口 (不需认证)"
    USERS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/users 2>/dev/null || echo "000")
    if [ "$USERS_RESPONSE" = "200" ] || [ "$USERS_RESPONSE" = "401" ]; then
        log_success "用户列表接口可访问 (HTTP $USERS_RESPONSE)"
    else
        log_error "用户列表接口异常 (HTTP $USERS_RESPONSE)"
    fi

    run_check "打卡列表接口"
    INSIGHTS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/insights 2>/dev/null || echo "000")
    if [ "$INSIGHTS_RESPONSE" = "200" ] || [ "$INSIGHTS_RESPONSE" = "401" ]; then
        log_success "打卡列表接口可访问 (HTTP $INSIGHTS_RESPONSE)"
    else
        log_error "打卡列表接口异常 (HTTP $INSIGHTS_RESPONSE)"
    fi
}

###############################################################################
# 第5部分: 文件系统和权限检查
###############################################################################

check_filesystem() {
    log_header "第5部分: 文件系统检查"

    run_check "日志目录权限"
    if [ -d "/var/log/morning-reading-club" ] && [ -w "/var/log/morning-reading-club" ]; then
        log_success "日志目录存在且可写"
    else
        log_error "日志目录不存在或无写权限"
    fi

    run_check "日志文件生成"
    RECENT_LOGS=$(find /var/log/morning-reading-club -name "*.log" -mmin -30 2>/dev/null | wc -l)
    if [ "$RECENT_LOGS" -gt 0 ]; then
        log_success "最近30分钟有 $RECENT_LOGS 个日志文件"
    else
        log_warning "最近30分钟未生成新日志文件"
    fi

    run_check "备份目录权限"
    if [ -d "/var/backups/morning-reading-club" ] && [ -w "/var/backups/morning-reading-club" ]; then
        log_success "备份目录存在且可写"
    else
        log_error "备份目录不存在或无写权限"
    fi

    run_check "磁盘空间使用"
    DISK_USAGE=$(df /var | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -lt 80 ]; then
        log_success "磁盘使用率: $DISK_USAGE% (充足)"
    elif [ "$DISK_USAGE" -lt 90 ]; then
        log_warning "磁盘使用率: $DISK_USAGE% (较高)"
    else
        log_error "磁盘使用率: $DISK_USAGE% (严重不足)"
    fi
}

###############################################################################
# 第6部分: 网络和端口检查
###############################################################################

check_network() {
    log_header "第6部分: 网络检查"

    run_check "Backend 端口 3000"
    if netstat -tuln 2>/dev/null | grep -q ":3000 " || ss -tuln 2>/dev/null | grep -q ":3000 "; then
        log_success "端口 3000 已绑定"
    else
        log_warning "端口 3000 未绑定（可能在Docker容器内）"
    fi

    run_check "MongoDB 端口 27017"
    if netstat -tuln 2>/dev/null | grep -q ":27017 " || ss -tuln 2>/dev/null | grep -q ":27017 "; then
        log_success "端口 27017 已绑定"
    else
        log_warning "端口 27017 未绑定（可能在Docker容器内）"
    fi

    run_check "互联网连接"
    if timeout 5 ping -c 1 8.8.8.8 > /dev/null 2>&1; then
        log_success "互联网连接正常"
    else
        log_warning "无法连接到外部互联网（可能是DNS或防火墙问题）"
    fi
}

###############################################################################
# 第7部分: 日志分析
###############################################################################

check_logs() {
    log_header "第7部分: 日志分析"

    run_check "Backend 错误日志"
    ERROR_COUNT=$(grep -i "error" /var/log/morning-reading-club/*.log 2>/dev/null | wc -l || echo "0")
    if [ "$ERROR_COUNT" -eq 0 ]; then
        log_success "无错误日志"
    else
        log_warning "发现 $ERROR_COUNT 条错误日志"
    fi

    run_check "最新错误日志内容"
    if [ "$ERROR_COUNT" -gt 0 ]; then
        LATEST_ERROR=$(grep -i "error" /var/log/morning-reading-club/*.log 2>/dev/null | tail -1)
        log_info "最新错误: $LATEST_ERROR"
    fi
}

###############################################################################
# 第8部分: 性能指标
###############################################################################

check_performance() {
    log_header "第8部分: 性能指标"

    run_check "CPU 使用率"
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print 100-$8}' | cut -d'.' -f1)
    if [ "$CPU_USAGE" -lt 50 ]; then
        log_success "CPU 使用率: $CPU_USAGE% (正常)"
    elif [ "$CPU_USAGE" -lt 80 ]; then
        log_warning "CPU 使用率: $CPU_USAGE% (较高)"
    else
        log_error "CPU 使用率: $CPU_USAGE% (过高)"
    fi

    run_check "内存使用率"
    MEM_USAGE=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100)}')
    if [ "$MEM_USAGE" -lt 70 ]; then
        log_success "内存使用率: $MEM_USAGE% (正常)"
    elif [ "$MEM_USAGE" -lt 90 ]; then
        log_warning "内存使用率: $MEM_USAGE% (较高)"
    else
        log_error "内存使用率: $MEM_USAGE% (过高)"
    fi

    run_check "Docker 容器资源使用"
    if command -v docker-stats > /dev/null 2>&1; then
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | head -5 | while read line; do
            [ ! -z "$line" ] && log_info "$line"
        done
    fi
}

###############################################################################
# 第9部分: 监控和备份检查
###############################################################################

check_monitoring_and_backup() {
    log_header "第9部分: 监控和备份检查"

    run_check "Prometheus 运行状态（可选）"
    PROM_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9090 2>/dev/null || echo "000")
    if [ "$PROM_RESPONSE" = "200" ]; then
        log_success "Prometheus 运行正常"
    else
        log_warning "Prometheus 未运行或无法访问 (可选组件)"
    fi

    run_check "Grafana 运行状态（可选）"
    GRAFANA_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null || echo "000")
    if [ "$GRAFANA_RESPONSE" = "200" ]; then
        log_success "Grafana 运行正常"
    else
        log_warning "Grafana 未运行或无法访问 (可选组件)"
    fi

    run_check "备份脚本配置"
    if [ -f "/var/backups/morning-reading-club/backup-config.sh" ]; then
        log_success "备份脚本已配置"
    else
        log_warning "备份脚本未配置（需要手动配置）"
    fi

    run_check "最近备份文件"
    BACKUP_FILES=$(find /var/backups/morning-reading-club -type f -mtime -1 2>/dev/null | wc -l)
    if [ "$BACKUP_FILES" -gt 0 ]; then
        log_success "最近24小时有 $BACKUP_FILES 个备份文件"
    else
        log_warning "未找到最近24小时的备份文件"
    fi
}

###############################################################################
# 第10部分: 生成验证报告
###############################################################################

generate_report() {
    log_header "部署验证报告"

    echo ""
    echo -e "${BLUE}┌─────────────────────────────────────────────────────────┐${NC}"
    echo -e "${BLUE}│           晨读营生产环境部署验证报告                   │${NC}"
    echo -e "${BLUE}└─────────────────────────────────────────────────────────┘${NC}"
    echo ""
    echo -e "验证时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo -e "服务器: $(hostname)"
    echo ""

    echo -e "${BLUE}📊 验证统计:${NC}"
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

    echo -e "${BLUE}📈 成功率: $SUCCESS_RATE%${NC}"
    echo ""

    # 生成整体评价
    if [ $FAILED_CHECKS -eq 0 ] && [ $WARNING_CHECKS -lt 3 ]; then
        echo -e "${GREEN}✅ 部署验证通过 - 生产环境已准备就绪${NC}"
    elif [ $FAILED_CHECKS -eq 0 ]; then
        echo -e "${YELLOW}⚠️  部署验证基本通过 - 建议处理警告项${NC}"
    else
        echo -e "${RED}❌ 部署验证失败 - 需要立即处理失败项${NC}"
    fi

    echo ""
    echo -e "${BLUE}📝 详细日志: $LOG_FILE${NC}"
    echo ""

    # 保存报告
    cat >> "$LOG_FILE" << EOF

═══════════════════════════════════════════════════════════
验证报告
═══════════════════════════════════════════════════════════
验证时间: $(date '+%Y-%m-%d %H:%M:%S')
服务器: $(hostname)

📊 验证统计:
  总检查项: $TOTAL_CHECKS
  通过: $PASSED_CHECKS
  警告: $WARNING_CHECKS
  失败: $FAILED_CHECKS

📈 成功率: $SUCCESS_RATE%

═══════════════════════════════════════════════════════════
EOF
}

###############################################################################
# 快速诊断帮助
###############################################################################

show_troubleshooting_tips() {
    if [ $FAILED_CHECKS -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}🔧 故障排查建议:${NC}"
        echo ""

        if [ -n "$MONGO_CONTAINER" ] && [ "$MONGO_STATUS" != "true" ]; then
            echo "MongoDB 容器未运行，请执行:"
            echo "  docker-compose -f docker-compose.prod.yml up -d mongodb"
        fi

        if [ -n "$BACKEND_CONTAINER" ] && [ "$BACKEND_STATUS" != "true" ]; then
            echo "Backend 容器未运行，请执行:"
            echo "  docker-compose -f docker-compose.prod.yml up -d backend"
        fi

        echo "查看错误日志:"
        echo "  tail -100 /var/log/morning-reading-club/error.log"
        echo ""
        echo "查看完整验证日志:"
        echo "  cat $LOG_FILE"
    fi
}

###############################################################################
# 主函数
###############################################################################

main() {
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "   🚀 晨读营生产环境部署验证脚本"
    echo "   版本: 1.0.0"
    echo "   时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    # 执行所有检查
    check_containers
    check_mongodb
    check_backend_api
    check_business_apis
    check_filesystem
    check_network
    check_logs
    check_performance
    check_monitoring_and_backup

    # 生成报告
    generate_report

    # 显示故障排查建议
    show_troubleshooting_tips

    # 返回正确的退出码
    if [ $FAILED_CHECKS -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# 运行主函数
main
