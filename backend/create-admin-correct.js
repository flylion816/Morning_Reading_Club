const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const mongodbUri = 'mongodb://127.0.0.1:27017/morning_reading_db';

mongoose.connect(mongodbUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('✅ MongoDB 连接成功');

  const adminSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    role: { type: String, default: 'admin' },
    status: { type: String, default: 'active' },
    createdAt: { type: Date, default: Date.now }
  });

  const Admin = mongoose.model('Admin', adminSchema, 'admins');

  try {
    // 删除旧的管理员
    await Admin.deleteOne({ email: 'admin@morningreading.com' });
    console.log('已删除旧管理员');

    // 创建新管理员
    const hashedPassword = await bcrypt.hash('admin123456', 10);
    
    const admin = await Admin.create({
      name: '系统管理员',
      email: 'admin@morningreading.com',
      password: hashedPassword,
      role: 'admin',
      status: 'active'
    });

    console.log('✅ 管理员创建成功');
    console.log('📧 邮箱: admin@morningreading.com');
    console.log('🔑 密码: admin123456');
    console.log('👤 名称: 系统管理员');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ 数据库连接失败:', error.message);
  process.exit(1);
});
