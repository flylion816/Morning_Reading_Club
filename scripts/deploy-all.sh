#!/bin/bash

################################################################################
# 一键完整部署脚本 - 适用于全新服务器
# 执行位置：远程服务器（通过 SSH 执行）
# 执行方式：bash scripts/deploy-all.sh
#
# 说明：
# 此脚本自动按顺序执行 scripts 1-6 的完整部署流程
# 适用于全新的 Ubuntu 服务器部署
# 耗时：15-25 分钟（取决于网络和服务器性能）
################################################################################

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 源加载库
source "$SCRIPT_DIR/lib/utils.sh"

################################################################################
# 配置
################################################################################

STAGES=(
  "1-initial-setup.sh|系统初始化"
  "2-install-dependencies.sh|安装依赖"
  "3-setup-infrastructure.sh|基础设施设置"
  "4-init-database.sh|数据库初始化"
  "5-setup-nginx.sh|Nginx 和 SSL 配置"
  "6-deploy-app.sh|应用部署"
)

TOTAL_STAGES=${#STAGES[@]}
CURRENT_STAGE=0
FAILED_STAGES=()

################################################################################
# 主函数
################################################################################

main() {
  log_header "晨读营小程序 - 一键完整部署"

  log_info "开始时间: $(date)"
  log_info "部署流程: $TOTAL_STAGES 个步骤"
  log_info ""

  for stage_info in "${STAGES[@]}"; do
    IFS='|' read -r script_name stage_desc <<< "$stage_info"
    ((CURRENT_STAGE++))

    local script_path="$SCRIPT_DIR/$script_name"

    if [ ! -f "$script_path" ]; then
      log_error "脚本不存在: $script_path"
      FAILED_STAGES+=("$script_name")
      continue
    fi

    log_header "[$CURRENT_STAGE/$TOTAL_STAGES] $stage_desc"

    if bash "$script_path"; then
      log_success "✓ 第 $CURRENT_STAGE 步完成"
    else
      log_error "✗ 第 $CURRENT_STAGE 步失败: $stage_desc"
      FAILED_STAGES+=("$script_name")

      log_warning ""
      log_warning "⚠️  部署在第 $CURRENT_STAGE 步中止"
      log_warning "可能的解决方法："
      log_warning "1. 查看上面的错误信息"
      log_warning "2. 修复问题后重新运行此脚本"
      log_warning "3. 或手动运行失败的步骤："
      log_warning "   bash $script_path"
      exit 1
    fi

    log_info ""
  done

  # 显示完成信息
  log_header "部署完成！✨"

  log_info "已完成的步骤:"
  for i in $(seq 1 $TOTAL_STAGES); do
    stage_info="${STAGES[$((i-1))]}"
    IFS='|' read -r script_name stage_desc <<< "$stage_info"
    log_success "[$i/$TOTAL_STAGES] $stage_desc"
  done

  log_info ""
  log_info "下一步:"
  log_info "1. 验证部署："
  log_info "   bash $SCRIPT_DIR/verify-deployment.sh"
  log_info ""
  log_info "2. 查看应用日志："
  log_info "   pm2 logs morning-reading-backend"
  log_info ""

  return 0
}

# 捕获错误
trap 'log_error "部署过程中出现错误"; exit 1' ERR

main "$@"
