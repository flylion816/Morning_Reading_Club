/**
 * 初始化 Enrollment 数据
 * 为现有用户创建报名记录
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Enrollment = require('../src/models/Enrollment');
const User = require('../src/models/User');
const Period = require('../src/models/Period');

async function initEnrollments() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ 数据库连接成功');

    // 获取所有用户和期次
    const users = await User.find().select('_id nickname');
    const periods = await Period.find().select('_id title');

    if (users.length === 0 || periods.length === 0) {
      console.log('⚠️  没有找到用户或期次，无法创建报名记录');
      process.exit(0);
    }

    console.log(`找到 ${users.length} 个用户，${periods.length} 个期次`);

    // 清除现有报名记录（可选）
    await Enrollment.deleteMany({});
    console.log('清除现有报名记录');

    // 创建报名记录
    const enrollments = [];
    const enrollmentDates = [
      new Date('2025-10-10'),
      new Date('2025-10-17'),
      new Date('2025-10-24'),
      new Date('2025-10-31')
    ];

    users.forEach((user, userIndex) => {
      periods.forEach((period, periodIndex) => {
        // 为每个用户创建对应期次的报名记录
        // 报名时间根据期次顺序递推
        const enrolledAt = new Date(enrollmentDates[periodIndex]);
        enrolledAt.setDate(enrolledAt.getDate() + (userIndex % 7));  // 错开几天

        enrollments.push({
          userId: user._id,
          periodId: period._id,
          enrolledAt,
          status: 'active',
          paymentStatus: 'free',
          notes: `${user.nickname} 报名了 ${period.title}`
        });
      });
    });

    // 批量插入
    const result = await Enrollment.insertMany(enrollments);
    console.log(`✅ 成功创建 ${result.length} 条报名记录`);

    // 统计每个期次的报名人数
    const enrollmentCount = {};
    for (const period of periods) {
      const count = await Enrollment.countDocuments({
        periodId: period._id,
        status: 'active'
      });
      enrollmentCount[period._id] = count;
    }

    console.log('\n期次报名人数统计:');
    for (const period of periods) {
      console.log(`  ${period.title}: ${enrollmentCount[period._id]} 人`);
    }

    console.log('\n✅ Enrollment 初始化完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  }
}

// 执行
initEnrollments();
