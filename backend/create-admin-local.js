const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 连接 MongoDB
const mongodbUri = 'mongodb://127.0.0.1:27017/morning_reading_db';

mongoose.connect(mongodbUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('✅ MongoDB 连接成功');

  // 创建管理员模型
  const adminSchema = new mongoose.Schema({
    email: String,
    password: String,
    role: String,
    status: String,
    createdAt: { type: Date, default: Date.now }
  });

  const Admin = mongoose.model('Admin', adminSchema, 'admins');

  try {
    // 删除旧的管理员（如果存在）
    await Admin.deleteOne({ email: 'admin@morningreading.com' });

    // 创建新管理员
    const hashedPassword = await bcrypt.hash('admin123456', 10);
    
    const admin = await Admin.create({
      email: 'admin@morningreading.com',
      password: hashedPassword,
      role: 'superadmin',
      status: 'active'
    });

    console.log('✅ 管理员创建成功');
    console.log('📧 邮箱: admin@morningreading.com');
    console.log('🔑 密码: admin123456');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 创建管理员失败:', error.message);
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ 数据库连接失败:', error.message);
  process.exit(1);
});
