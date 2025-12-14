#!/bin/bash

# 数据库数据查询脚本
# 用途：快速查询 MongoDB 中的各个集合数据
# 使用：./check-data.sh [选项]
# 选项：
#   (无参数) - 显示所有集合的数据统计
#   courses    - 显示课程信息
#   periods    - 显示期次信息
#   users      - 显示用户信息
#   admins     - 显示管理员信息
#   enrollments - 显示报名信息
#   all        - 显示完整统计

set -e

# 配置 - 从环境变量或 .env 文件读取
if [ -z "$MONGODB_URI" ]; then
  # 尝试从 .env 文件读取
  if [ -f "/var/www/Morning_Reading_Club/backend/.env.production" ]; then
    MONGO_URI=$(grep "^MONGODB_URI=" /var/www/Morning_Reading_Club/backend/.env.production | cut -d'=' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  elif [ -f "/var/www/Morning_Reading_Club/backend/.env" ]; then
    MONGO_URI=$(grep "^MONGODB_URI=" /var/www/Morning_Reading_Club/backend/.env | cut -d'=' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  else
    MONGO_URI="mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin"
  fi
else
  MONGO_URI="$MONGODB_URI"
fi
DB_NAME="morning_reading"

# 颜色定义
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 参数处理
QUERY_TYPE="${1:-summary}"

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 晨读营数据库查询${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}\n"

case "$QUERY_TYPE" in
  summary|"")
    # 默认：显示数据统计摘要
    mongosh "$MONGO_URI" --eval "
    console.log('========== 数据统计摘要 ==========\n');

    const collections = ['users', 'periods', 'sections', 'admins', 'insights', 'checkins', 'enrollments', 'comments'];
    collections.forEach(col => {
      const count = db[col].countDocuments();
      console.log('  • ' + col + ': ' + count + ' 条记录');
    });

    console.log('\n========== 课程信息 ==========\n');
    const sectionsCount = db.sections.countDocuments();
    if (sectionsCount > 0) {
      const maxDay = db.sections.findOne({}, {sort: {day: -1}});
      console.log('课程总数: ' + sectionsCount + ' 节');
      if (maxDay) {
        console.log('范围: Day 0 - Day ' + maxDay.day);
      }
    } else {
      console.log('暂无课程数据');
    }
    "
    ;;

  courses)
    # 显示所有课程
    mongosh "$MONGO_URI" --eval "
    console.log('========== 📚 完整课程列表 ==========\n');

    const sections = db.sections.find().sort({day: 1}).toArray();
    console.log('总共 ' + sections.length + ' 节课程\n');

    sections.forEach((s, i) => {
      const wordCount = s.content ? s.content.length : 0;
      console.log((i+1).toString().padStart(2, ' ') + '. Day ' + s.day.toString().padStart(2, ' ') + ' - ' + s.title + ' (' + wordCount + ' 字)');
    });
    "
    ;;

  periods)
    # 显示所有期次
    mongosh "$MONGO_URI" --eval "
    console.log('========== 期次列表 ==========\n');

    const periods = db.periods.find().toArray();
    console.log('总共 ' + periods.length + ' 个期次\n');

    periods.forEach((p, i) => {
      const sectionCount = db.sections.countDocuments({periodId: p._id});
      console.log((i+1) + '. ' + p.name + ' (' + sectionCount + ' 节课程)');
    });
    "
    ;;

  users)
    # 显示所有用户
    mongosh "$MONGO_URI" --eval "
    console.log('========== 用户列表 ==========\n');

    const users = db.users.find().toArray();
    console.log('总共 ' + users.length + ' 个用户\n');

    users.forEach((u, i) => {
      console.log((i+1) + '. ' + (u.nickname || u.email || '未知') + ' (ID: ' + u._id + ')');
    });
    "
    ;;

  admins)
    # 显示所有管理员
    mongosh "$MONGO_URI" --eval "
    console.log('========== 管理员列表 ==========\n');

    const admins = db.admins.find().toArray();
    console.log('总共 ' + admins.length + ' 个管理员\n');

    admins.forEach((a, i) => {
      console.log((i+1) + '. ' + a.email);
    });
    "
    ;;

  enrollments)
    # 显示所有报名
    mongosh "$MONGO_URI" --eval "
    console.log('========== 报名信息 ==========\n');

    const enrollments = db.enrollments.find().toArray();
    console.log('总共 ' + enrollments.length + ' 条报名记录\n');

    enrollments.forEach((e, i) => {
      const user = db.users.findOne({_id: e.userId});
      const period = db.periods.findOne({_id: e.periodId});
      const userName = user ? (user.nickname || user.email || '未知') : '未知';
      const periodName = period ? period.name : '未知';
      console.log((i+1) + '. ' + userName + ' - ' + periodName + ' (报名时间: ' + (e.createdAt || '未记录') + ')');
    });
    "
    ;;

  all)
    # 完整统计
    mongosh "$MONGO_URI" --eval "
    console.log('========== 📊 数据库完整统计 ==========\n');

    const collections = ['users', 'periods', 'sections', 'admins', 'insights', 'checkins', 'enrollments', 'comments'];
    let totalRecords = 0;

    console.log('集合数据统计：\n');
    collections.forEach(col => {
      const count = db[col].countDocuments();
      totalRecords += count;
      console.log('  • ' + col.padEnd(15) + ': ' + count.toString().padStart(4) + ' 条记录');
    });

    console.log('\n总记录数: ' + totalRecords + ' 条');

    console.log('\n========== 关键信息 ==========\n');

    // 课程信息
    const sectionsCount = db.sections.countDocuments();
    if (sectionsCount > 0) {
      const maxDay = db.sections.findOne({}, {sort: {day: -1}});
      let totalWords = 0;
      db.sections.find().toArray().forEach(s => {
        if (s.content) totalWords += s.content.length;
      });
      console.log('课程: ' + sectionsCount + ' 节 (' + totalWords + ' 字)');
    }

    console.log('期次: ' + db.periods.countDocuments() + ' 个');
    console.log('用户: ' + db.users.countDocuments() + ' 个');
    console.log('管理员: ' + db.admins.countDocuments() + ' 个');
    "
    ;;

  *)
    echo -e "${YELLOW}❌ 未知参数: $QUERY_TYPE${NC}"
    echo ""
    echo -e "${GREEN}使用方式:${NC}"
    echo "  ./check-data.sh              # 显示数据统计摘要（默认）"
    echo "  ./check-data.sh courses      # 显示所有课程"
    echo "  ./check-data.sh periods      # 显示所有期次"
    echo "  ./check-data.sh users        # 显示所有用户"
    echo "  ./check-data.sh admins       # 显示所有管理员"
    echo "  ./check-data.sh enrollments  # 显示所有报名信息"
    echo "  ./check-data.sh all          # 显示完整统计"
    echo ""
    exit 1
    ;;
esac

echo ""
