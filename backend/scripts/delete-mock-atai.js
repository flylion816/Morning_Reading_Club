const mongoose = require('mongoose');
const User = require('../src/models/User');

mongoose.connect('mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin')
  .then(async () => {
    await User.deleteOne({ openid: 'mock_atai_12345' });
    console.log('已删除 mock_atai_12345 用户');
    
    const users = await User.find({});
    console.log('\n当前用户:');
    users.forEach(u => console.log(`- ${u.nickname}: ${u.openid}`));
    
    process.exit(0);
  });
