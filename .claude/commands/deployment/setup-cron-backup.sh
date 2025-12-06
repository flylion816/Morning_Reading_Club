#!/bin/bash
# 设置定时数据库备份任务（cron job）
# 用于在每天指定时间自动备份 MongoDB 数据库

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}⏰ 设置定时数据库备份${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# 获取项目根目录
PROJECT_ROOT="$(pwd)"
while [ ! -d "$PROJECT_ROOT/.claude/commands/deployment" ] && [ "$PROJECT_ROOT" != "/" ]; do
    PROJECT_ROOT="$(dirname "$PROJECT_ROOT")"
done

if [ ! -d "$PROJECT_ROOT/.claude/commands/deployment" ]; then
    PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)"
fi

BACKUP_SCRIPT="$PROJECT_ROOT/.claude/commands/deployment/backup-db.sh"
CRON_LOG="/tmp/db_backup_cron.log"

# 检查备份脚本是否存在
if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo -e "${RED}❌ 错误: 找不到备份脚本 $BACKUP_SCRIPT${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 配置选项：${NC}"
echo ""
echo "1. 每天 10:00 备份（推荐）"
echo "2. 每天 22:00 备份"
echo "3. 自定义时间"
echo ""

read -p "请选择 (1/2/3): " choice

case $choice in
    1)
        HOUR="10"
        MINUTE="00"
        TIME_DESC="每天 10:00"
        ;;
    2)
        HOUR="22"
        MINUTE="00"
        TIME_DESC="每天 22:00"
        ;;
    3)
        read -p "输入小时 (0-23): " HOUR
        read -p "输入分钟 (0-59): " MINUTE
        TIME_DESC="每天 $HOUR:$MINUTE"

        # 验证输入
        if ! [[ "$HOUR" =~ ^[0-9]{1,2}$ ]] || [ "$HOUR" -gt 23 ]; then
            echo -e "${RED}❌ 错误: 无效的小时 ($HOUR)${NC}"
            exit 1
        fi
        if ! [[ "$MINUTE" =~ ^[0-9]{1,2}$ ]] || [ "$MINUTE" -gt 59 ]; then
            echo -e "${RED}❌ 错误: 无效的分钟 ($MINUTE)${NC}"
            exit 1
        fi
        ;;
    *)
        echo -e "${RED}❌ 无效的选择${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${YELLOW}📝 即将创建的定时任务：${NC}"
echo "  时间: $TIME_DESC"
echo "  脚本: $BACKUP_SCRIPT"
echo "  日志: $CRON_LOG"
echo ""

read -p "确认设置？(y/n): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "已取消"
    exit 0
fi

echo ""
echo -e "${YELLOW}🔧 正在配置...${NC}"

# 生成 cron 表达式
CRON_EXPR="$MINUTE $HOUR * * *"

# 创建临时 cron 文件
TEMP_CRON=$(mktemp)

# 导出现有的 cron 任务（如果有的话）
crontab -l > "$TEMP_CRON" 2>/dev/null || true

# 检查是否已存在相同的任务
if grep -q "backup-db.sh" "$TEMP_CRON"; then
    echo -e "${YELLOW}⚠️  检测到已存在的备份任务，将其替换...${NC}"
    # 移除旧的备份任务
    grep -v "backup-db.sh" "$TEMP_CRON" > "${TEMP_CRON}.new"
    mv "${TEMP_CRON}.new" "$TEMP_CRON"
fi

# 添加新的 cron 任务
# 格式: 分 时 日 月 周 命令
cat >> "$TEMP_CRON" << EOF

# 晨读营数据库自动备份 - $TIME_DESC
$CRON_EXPR bash $BACKUP_SCRIPT >> $CRON_LOG 2>&1
EOF

# 安装新的 cron 任务
if crontab "$TEMP_CRON"; then
    echo -e "${GREEN}✓ Cron 任务安装成功${NC}"
else
    echo -e "${RED}❌ Cron 任务安装失败${NC}"
    rm -f "$TEMP_CRON"
    exit 1
fi

rm -f "$TEMP_CRON"

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 定时备份配置完成!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${PURPLE}📊 任务信息：${NC}"
echo "  触发时间: $TIME_DESC"
echo "  执行脚本: $BACKUP_SCRIPT"
echo "  日志文件: $CRON_LOG"
echo "  Cron 表达式: $CRON_EXPR"
echo ""

echo -e "${YELLOW}💡 常用命令：${NC}"
echo "  • 查看所有定时任务: crontab -l"
echo "  • 编辑定时任务: crontab -e"
echo "  • 查看备份日志: tail -f $CRON_LOG"
echo "  • 删除定时任务: crontab -r"
echo "  • 测试备份脚本: bash $BACKUP_SCRIPT"
echo ""

echo -e "${YELLOW}📌 注意事项：${NC}"
echo "  • cron 运行时的 PATH 环境可能不同，确保 mongosh 和 mongodump 在 PATH 中"
echo "  • 如果备份失败，请检查 $CRON_LOG 日志"
echo "  • 备份文件存储在项目根目录下的 ./backups 目录"
echo "  • 定期清理旧备份以节省磁盘空间"
echo ""

echo -e "${YELLOW}✅ 设置完毕${NC}"
echo ""
