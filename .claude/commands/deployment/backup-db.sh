#!/bin/bash
# 数据库备份脚本
# 用于备份 MongoDB 数据库

# 修复 cron 环境的 PATH 问题
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.tar.gz"

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}💾 数据库备份${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

# 创建备份目录
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}📁 创建备份目录: $BACKUP_DIR${NC}"
    mkdir -p "$BACKUP_DIR"
fi

echo -e "${YELLOW}🔍 检查 MongoDB...${NC}"

# 检查 mongosh 是否安装
if ! command -v mongosh &> /dev/null; then
    echo -e "${RED}❌ 错误: mongosh 未安装${NC}"
    echo ""
    echo "请先安装 MongoDB 客户端:"
    echo "  brew install mongodb-community"
    exit 1
fi

echo -e "${GREEN}✓ mongosh 已安装${NC}"
echo ""

# 获取数据库配置
DB_HOST="${MONGO_HOST:-localhost}"
DB_PORT="${MONGO_PORT:-27017}"
DB_NAME="${MONGO_DB_NAME:-morningreading}"
DB_USER="${MONGO_USER:-}"
DB_PASSWORD="${MONGO_PASSWORD:-}"

echo -e "${YELLOW}📊 备份配置:${NC}"
echo "  主机: $DB_HOST"
echo "  端口: $DB_PORT"
echo "  数据库: $DB_NAME"
echo "  备份文件: $BACKUP_FILE"
echo ""

# 检查数据库连接
echo -e "${YELLOW}🔗 检查数据库连接...${NC}"

# 构建 mongosh 认证参数
MONGOSH_AUTH=""
if [ -n "$DB_USER" ] && [ -n "$DB_PASSWORD" ]; then
    MONGOSH_AUTH="-u $DB_USER -p $DB_PASSWORD --authenticationDatabase admin"
fi

if mongosh --host "$DB_HOST:$DB_PORT" $MONGOSH_AUTH --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 数据库连接成功${NC}"
else
    echo -e "${YELLOW}⚠ 警告: 数据库可能未启动或无法连接${NC}"
    echo "  尝试启动 MongoDB: brew services start mongodb-community"
    exit 1
fi
echo ""

# 执行备份
echo -e "${YELLOW}⏳ 正在备份数据库...${NC}"

# 创建临时目录
TEMP_DUMP_DIR="/tmp/db_dump_$TIMESTAMP"
mkdir -p "$TEMP_DUMP_DIR"

# 设置清理函数，确保失败时也清理临时文件
cleanup_temp() {
    if [ -d "$TEMP_DUMP_DIR" ]; then
        rm -rf "$TEMP_DUMP_DIR"
    fi
}
trap cleanup_temp EXIT

# 构建 mongodump 认证参数
MONGODUMP_AUTH=""
if [ -n "$DB_USER" ] && [ -n "$DB_PASSWORD" ]; then
    MONGODUMP_AUTH="-u $DB_USER -p $DB_PASSWORD --authenticationDatabase admin"
fi

# 执行备份
if mongodump --host "$DB_HOST:$DB_PORT" $MONGODUMP_AUTH --db "$DB_NAME" --out "$TEMP_DUMP_DIR" > /tmp/mongodump_$TIMESTAMP.log 2>&1; then
    echo -e "${GREEN}✓ 数据库导出成功${NC}"

    # 压缩备份
    echo -e "${YELLOW}🗜️  压缩备份文件...${NC}"
    if tar -czf "$BACKUP_FILE" -C "$TEMP_DUMP_DIR" . > /tmp/tar_$TIMESTAMP.log 2>&1; then
        echo -e "${GREEN}✓ 压缩成功${NC}"
    else
        echo -e "${RED}❌ 压缩失败${NC}"
        echo "日志: $(cat /tmp/tar_$TIMESTAMP.log)"
        exit 1
    fi

    # 验证备份文件
    if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
        FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        echo -e "${GREEN}✓ 备份文件创建成功${NC}"
        echo "  大小: $FILE_SIZE"
        echo "  路径: $(pwd)/$BACKUP_FILE"
    else
        echo -e "${RED}❌ 备份文件无效或为空${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ 数据库导出失败${NC}"
    echo "日志: $(cat /tmp/mongodump_$TIMESTAMP.log)"
    exit 1
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 备份完成!${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}📝 备份信息:${NC}"
echo "  创建时间: $(date)"
echo "  文件名: $(basename $BACKUP_FILE)"
echo "  文件大小: $FILE_SIZE"
echo "  完整路径: $(pwd)/$BACKUP_FILE"
echo ""

echo -e "${YELLOW}💾 其他备份文件:${NC}"
ls -1t "$BACKUP_DIR"/db_backup_*.tar.gz 2>/dev/null | head -5 | while read file; do
    size=$(du -h "$file" | cut -f1)
    echo "  • $(basename $file) ($size)"
done
echo ""

echo -e "${YELLOW}🔄 恢复备份的方法:${NC}"
echo "  1. 解压备份: tar -xzf $BACKUP_FILE -C /tmp"
echo "  2. 恢复数据: mongorestore --host $DB_HOST:$DB_PORT /tmp/dump"
echo ""

echo -e "${YELLOW}🧹 清理旧备份:${NC}"
echo "  删除7天前的备份: find $BACKUP_DIR -name '*.tar.gz' -mtime +7 -delete"
echo ""

exit 0
