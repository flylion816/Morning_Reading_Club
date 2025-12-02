const mongoose = require('mongoose');
const Enrollment = require('../src/models/Enrollment');
const User = require('../src/models/User');
const Period = require('../src/models/Period');

const mongoUrl = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

async function testCheckEnrollment() {
  try {
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // 找到"阿泰"用户
    const user = await User.findOne({ nickname: '阿泰' });
    console.log('\n========== 用户信息 ==========');
    console.log('nickname:', user.nickname);
    console.log('_id:', user._id);
    console.log('_id类型:', typeof user._id);

    // 找到平衡之道期次
    const period = await Period.findOne({ name: '平衡之道' });
    console.log('\n========== 期次信息 ==========');
    console.log('name:', period.name);
    console.log('_id:', period._id);

    // 模拟 checkEnrollment 逻辑
    console.log('\n========== 查询 Enrollment ==========');
    const enrollment = await Enrollment.findOne({
      userId: user._id,
      periodId: period._id,
      status: { $in: ['active', 'completed'] }
    });

    if (enrollment) {
      console.log('✅ 找到报名记录');
      console.log('status:', enrollment.status);
      console.log('_id:', enrollment._id);
    } else {
      console.log('❌ 没有找到报名记录');
      
      // 调试：列出所有报名记录
      const allEnrollments = await Enrollment.find({ periodId: period._id });
      console.log('\n所有的报名记录数:', allEnrollments.length);
      allEnrollments.forEach(e => {
        console.log(`  - userId: ${e.userId}, status: ${e.status}`);
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('错误:', error.message);
    await mongoose.disconnect();
  }
}

testCheckEnrollment();
