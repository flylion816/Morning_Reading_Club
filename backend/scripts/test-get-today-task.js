const mongoose = require('mongoose');

// 测试 getTodayTask API 的 userId 提取
async function test() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

  await mongoose.connect(mongoUri);

  const User = require('../src/models/User');
  const Enrollment = require('../src/models/Enrollment');
  const Period = require('../src/models/Period');

  // 获取第一个用户
  const user = await User.findOne();
  if (!user) {
    console.log('❌ 没有用户数据');
    await mongoose.connection.close();
    return;
  }

  console.log('\n===== 用户信息 =====');
  console.log('User._id:', user._id);
  console.log('User.nickname:', user.nickname);

  // 模拟 JWT 中的 payload
  const jwtPayload = {
    userId: user._id,  // JWT 中使用 userId
    openid: user.openid,
    role: user.role || 'user'
  };

  console.log('\n===== JWT Payload =====');
  console.log(JSON.stringify(jwtPayload, null, 2));

  // 模拟 getTodayTask 的逻辑
  const userId = jwtPayload.userId;  // 正确的提取方式
  console.log('\n===== getTodayTask 逻辑 =====');
  console.log('提取的 userId:', userId);

  // 查询用户的报名
  const enrollments = await Enrollment.find({
    userId,
    approvalStatus: { $in: ['approved', 'pending'] }
  }).populate('periodId');

  console.log('\n===== 报名信息 =====');
  console.log('找到的报名数:', enrollments.length);

  if (enrollments.length > 0) {
    const enrollment = enrollments[0];
    const period = enrollment.periodId;

    console.log('第一条报名:');
    console.log('  - enrollmentId:', enrollment._id);
    console.log('  - periodName:', period?.name);
    console.log('  - periodStartDate:', period?.startDate);
    console.log('  - periodTotalDays:', period?.totalDays);

    // 计算今天的 day
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const periodStartDate = new Date(period.startDate);
    periodStartDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((today - periodStartDate) / (1000 * 60 * 60 * 24));

    console.log('\n===== 日期计算 =====');
    console.log('今天:', today);
    console.log('期次开始:', periodStartDate);
    console.log('相差天数:', daysDiff);

    if (daysDiff >= 0 && daysDiff < period.totalDays) {
      console.log('✅ 在期次范围内');
      console.log('当前应该学习的 day:', daysDiff);
    } else {
      console.log('❌ 不在期次范围内');
    }
  }

  console.log('\n✅ 测试完成');
  await mongoose.connection.close();
}

test().catch(console.error);
