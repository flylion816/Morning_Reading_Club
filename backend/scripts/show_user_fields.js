const mongoose = require('mongoose');
const User = require('../src/models/User');
const Enrollment = require('../src/models/Enrollment');

const mongoUrl = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

async function showFields() {
  try {
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('\n========== 用户表 vs 报名表的字段对比 ==========\n');

    // 查询用户
    const user = await User.findOne({ nickname: '阿泰' });
    console.log('📌 用户表 (User Collection) - 用户"阿泰"的字段：');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('_id:', user._id);
    console.log('nickname:', user.nickname, '👈 这是微信昵称');
    console.log('avatar:', user.avatar);
    console.log('openid:', user.openid);
    console.log('gender:', user.gender);
    console.log('signature:', user.signature);
    console.log('level:', user.level);

    // 查询报名
    const enrollment = await Enrollment.findOne({
      userId: user._id
    });

    console.log('\n📌 报名表 (Enrollment Collection) - 同一用户的报名信息：');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('userId:', enrollment.userId, '👈 引用的用户ID（same as User._id）');
    console.log('name:', enrollment.name, '👈 这是报名表单中填写的真实姓名');
    console.log('gender:', enrollment.gender, '👈 报名表单中的性别选择');
    console.log('province:', enrollment.province);
    console.log('detailedAddress:', enrollment.detailedAddress);
    console.log('age:', enrollment.age);

    console.log('\n💡 关键发现：');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚡ User.nickname   = "' + user.nickname + '" (微信昵称)');
    console.log('⚡ Enrollment.name = "' + enrollment.name + '" (报名表单中的真实姓名)');
    console.log('\n📍 这是两个完全不同的字段：');
    console.log('  • nickname: 来自微信登录，用户在微信中设置的昵称');
    console.log('  • name: 来自报名时用户填写的表单，通常是真实姓名');

    console.log('\n========== User 模型的完整字段 ==========\n');
    const userObj = user.toObject();
    Object.keys(userObj).forEach(key => {
      let value = userObj[key];
      if (typeof value === 'object') value = JSON.stringify(value);
      if (typeof value === 'string' && value.length > 50) value = value.substring(0, 50) + '...';
      console.log('  • ' + key + ': ' + value);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    await mongoose.disconnect();
  }
}

showFields();
