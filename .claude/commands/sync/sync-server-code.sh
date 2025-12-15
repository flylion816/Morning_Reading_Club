#!/bin/bash

# 服务器代码自动同步脚本
# 用法: ./sync-server-code.sh
# 说明: 将服务器最新提交拉取、合并到本地，然后推送到GitHub

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config/server-credentials.env"
REPO_DIR="$SCRIPT_DIR/../.."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 工具函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

# 检查前置条件
check_prerequisites() {
    log_info "检查前置条件..."

    # 检查sshpass
    if ! command -v sshpass &> /dev/null; then
        log_error "sshpass未安装，请运行: brew install sshpass"
        exit 1
    fi
    log_success "sshpass已安装"

    # 检查git
    if ! command -v git &> /dev/null; then
        log_error "git未安装"
        exit 1
    fi

    # 检查repo
    if [ ! -d "$REPO_DIR/.git" ]; then
        log_error "不在git仓库目录中"
        exit 1
    fi
    log_success "环境检查通过"
}

# 读取配置
load_config() {
    log_info "加载配置..."

    if [ ! -f "$CONFIG_FILE" ]; then
        log_error "配置文件不存在: $CONFIG_FILE"
        exit 1
    fi

    source "$CONFIG_FILE"
    log_success "配置已加载"
}

# 检查工作树
check_working_tree() {
    log_info "检查工作树状态..."

    cd "$REPO_DIR"

    if [ -n "$(git status --short)" ]; then
        log_error "工作树有未提交的修改"
        git status --short
        log_warning "请先提交或暂存修改"
        exit 1
    fi

    log_success "工作树干净"
}

# 从服务器拉取代码
fetch_from_server() {
    log_info "从服务器拉取代码..."

    cd "$REPO_DIR"

    # 设置SSH命令
    export GIT_SSH_COMMAND="sshpass -p '$SERVER_PASSWORD' ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

    # 执行fetch
    if git fetch server main --prune 2>/dev/null; then
        log_success "服务器fetch成功"
    else
        git fetch server main || true
        log_success "服务器fetch完成（可能有连接警告）"
    fi

    # 显示服务器新增的提交
    SERVER_COMMITS=$(git log origin/main..server/main --oneline 2>/dev/null | wc -l)
    if [ "$SERVER_COMMITS" -gt 0 ]; then
        log_info "服务器有 $SERVER_COMMITS 个新提交:"
        git log origin/main..server/main --oneline | head -5
    else
        log_info "服务器没有新提交"
    fi

    # 清理环境
    unset GIT_SSH_COMMAND
}

# 从GitHub拉取代码
fetch_from_github() {
    log_info "从GitHub拉取最新代码..."

    cd "$REPO_DIR"

    git fetch origin main

    log_success "GitHub fetch完成"
}

# 合并服务器代码
merge_server_code() {
    log_info "合并服务器提交..."

    cd "$REPO_DIR"

    # 检查是否有需要合并的提交
    if ! git merge-base --is-ancestor server/main origin/main 2>/dev/null; then
        # 有新的提交需要合并

        # 创建merge分支
        TIMESTAMP=$(date +%s)
        MERGE_BRANCH="${LOCAL_TEMP_BRANCH_PREFIX}${TIMESTAMP}"

        git checkout -b "$MERGE_BRANCH" main
        log_info "创建临时分支: $MERGE_BRANCH"

        # 合并服务器代码
        COMMIT_MSG="merge: 从服务器同步最新代码

$(date '+%Y-%m-%d %H:%M:%S')

服务器新增提交:
$(git log origin/main..server/main --oneline 2>/dev/null | sed 's/^/  - /' || echo '  - 无')

修改的文件:
$(git diff origin/main...server/main --name-status 2>/dev/null | sed 's/^/  - /' | head -20)
"

        if git merge server/main -m "$COMMIT_MSG" &>/dev/null; then
            log_success "代码合并成功"
        else
            log_error "合并时出现冲突，需要手动解决"
            log_info "冲突文件:"
            git diff --name-only --diff-filter=U
            exit 1
        fi

        # 合并回main
        git checkout main
        git merge --ff-only "$MERGE_BRANCH" 2>/dev/null || \
        git merge "$MERGE_BRANCH" -m "merge: 完成服务器代码同步"

        # 清理临时分支
        git branch -D "$MERGE_BRANCH"

        log_success "合并完成"
    else
        log_info "服务器代码已同步，无需合并"
    fi
}

# 推送到GitHub
push_to_github() {
    log_info "推送到GitHub..."

    cd "$REPO_DIR"

    LOCAL_COMMITS=$(git rev-list --count origin/main..HEAD)

    if [ "$LOCAL_COMMITS" -gt 0 ]; then
        if git push origin main; then
            log_success "推送成功"
        else
            log_error "推送失败"
            exit 1
        fi
    else
        log_info "没有新的本地提交，无需推送"
    fi
}

# 显示最终状态
show_status() {
    log_info "显示最终状态..."

    cd "$REPO_DIR"

    echo ""
    echo -e "${BLUE}═══ 最新提交 ═══${NC}"
    git log --oneline -5
    echo ""

    STATUS=$(git status --short | wc -l)
    if [ "$STATUS" -eq 0 ]; then
        echo -e "${GREEN}✓ 工作树干净${NC}"
    else
        echo -e "${YELLOW}! 还有 $STATUS 个修改${NC}"
    fi

    echo ""
}

# 主程序
main() {
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   服务器代码自动同步工具              ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""

    check_prerequisites
    echo ""

    load_config
    echo ""

    check_working_tree
    echo ""

    fetch_from_server
    echo ""

    fetch_from_github
    echo ""

    merge_server_code
    echo ""

    push_to_github
    echo ""

    show_status

    log_success "同步完成！"
}

# 执行主程序
main "$@"
