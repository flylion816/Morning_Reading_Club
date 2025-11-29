const mongoose = require('mongoose');
const User = require('../src/models/User');

mongoose.connect('mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin')
  .then(async () => {
    // 创建阿泰用户
    const atai = new User({
      openid: 'mock_atai_12345',
      nickname: '阿泰',
      email: 'atai@example.com',
      status: 'active',
      role: 'user'
    });

    await atai.save();
    console.log('✅ 已创建 mock 用户"阿泰"');
    console.log(`   ID: ${atai._id}`);
    console.log(`   nickname: ${atai.nickname}`);
    console.log(`   email: ${atai.email}`);

    const users = await User.find({});
    console.log('\n📋 当前系统中的所有用户:');
    users.forEach(u => console.log(`   - ${u.nickname} (${u.email})`));

    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
  });
