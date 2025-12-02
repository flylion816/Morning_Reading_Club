const mongoose = require('mongoose');
const User = require('../src/models/User');
const Enrollment = require('../src/models/Enrollment');
const Period = require('../src/models/Period');

const mongoUrl = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

async function testDisplay() {
  try {
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('\n========== 报名管理表格显示测试 ==========\n');

    const enrollments = await Enrollment.find({ deleted: { $ne: true } })
      .populate('userId', 'nickname avatar')
      .populate('periodId', 'name')
      .limit(5)
      .lean();

    if (enrollments.length === 0) {
      console.log('❌ 没有报名记录');
      await mongoose.disconnect();
      return;
    }

    console.log(`📋 找到 ${enrollments.length} 条报名记录\n`);
    console.log('表格列显示效果:');
    console.log('─'.repeat(100));

    enrollments.forEach((e, i) => {
      const id = e.userId._id.toString();
      const nickname = e.userId.nickname || '-';
      const name = e.name || '-';
      const period = e.periodId && e.periodId.name ? e.periodId.name : '未知';

      console.log(`[${i+1}] ID: ${id} | 昵称: ${nickname.padEnd(10)} | 报名名称: ${name.padEnd(10)} | 期次: ${period}`);
    });

    console.log('─'.repeat(100));
    console.log('\n✅ 前端显示测试完成！');
    console.log('   - ID 列显示完整的用户ID');
    console.log('   - 昵称 列显示用户的微信昵称');
    console.log('   - 报名名称 列显示用户填写的真实姓名\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    await mongoose.disconnect();
  }
}

testDisplay();
