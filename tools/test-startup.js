async function test() {
  try {
    console.log('测试1: 加载模型...');
    const User = require('./backend/src/models/User');
    console.log('✅ User模型加载成功');
    
    console.log('测试2: 连接数据库...');
    const mongoose = require('mongoose');
    await mongoose.connect('mongodb://admin:admin123@localhost:27017/morning_reading_db?authSource=admin', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ MongoDB连接成功');
    
    console.log('测试3: 查询用户...');
    const users = await User.countDocuments();
    console.log(`✅ 用户总数: ${users}`);
    
    await mongoose.disconnect();
    console.log('✅ 所有测试通过');
    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error('堆栈:', error.stack);
    process.exit(1);
  }
}

test();
