const mongoose = require('mongoose');
const User = require('../src/models/User');

mongoose.connect('mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin')
  .then(async () => {
    console.log('MongoDB连接成功\n');
    
    // 删除所有测试创建的用户（openid包含时间戳的）
    const testUsers = await User.find({ 
      openid: { $regex: /^mock_\d+_/ }  
    });
    
    console.log(`找到 ${testUsers.length} 个测试用户，准备删除...`);
    for (const user of testUsers) {
      console.log(`- 删除: ${user.nickname} (${user.openid})`);
      await User.deleteOne({ _id: user._id });
    }
    
    console.log('\n删除完成！');
    console.log('\n当前用户列表:');
    const allUsers = await User.find({});
    allUsers.forEach(u => console.log(`- ${u.nickname}: ${u.openid}`));
    
    await mongoose.connection.close();
    console.log('\nMongoDB连接已关闭');
  });
