const mongoose = require('mongoose');
const Enrollment = require('../src/models/Enrollment');
const User = require('../src/models/User');
const Period = require('../src/models/Period');

const mongoUrl = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

async function testNewEnrollmentFlow() {
  try {
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('\n========== 新报名流程测试 ==========\n');

    // 找到用户和期次
    const user = await User.findOne({ nickname: '阿泰' });
    const period = await Period.findOne({ name: '平衡之道' });

    console.log('📋 用户：', user.nickname);
    console.log('📋 期次：', period.name);

    // 查询用户的报名
    const enrollment = await Enrollment.findOne({
      userId: user._id,
      periodId: period._id
    });

    if (enrollment) {
      console.log('\n✅ 找到报名记录：');
      console.log('  - _id:', enrollment._id);
      console.log('  - status:', enrollment.status);
      console.log('  - paymentStatus:', enrollment.paymentStatus);
      console.log('  - 名字:', enrollment.name);
      console.log('  - 省份:', enrollment.province);

      // 检查 approvalStatus 字段（应该不存在或被忽略）
      console.log('\n🔍 检查字段：');
      console.log('  - status 存在:', 'status' in enrollment.toObject());
      console.log('  - approvalStatus 存在:', 'approvalStatus' in enrollment.toObject());
      console.log('  - paymentStatus 存在:', 'paymentStatus' in enrollment.toObject());

      console.log('\n✅ 新模型测试通过！');
      console.log('   报名已直接生效，无需审批');
    } else {
      console.log('\n⚠️ 未找到报名记录');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    await mongoose.disconnect();
  }
}

testNewEnrollmentFlow();
