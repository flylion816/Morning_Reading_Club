const mongoose = require('mongoose');
require('dotenv').config();

const Enrollment = require('./src/models/Enrollment');

async function checkEnrollments() {
  try {
    const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_reading_db';
    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      authSource: 'admin',
      retryWrites: false
    });

    console.log('✅ MongoDB 连接成功\n');

    // 获取所有报名记录
    const enrollments = await Enrollment.find({}).populate('userId').populate('periodId');
    
    console.log(`📊 总共有 ${enrollments.length} 条报名记录\n`);
    
    enrollments.forEach((e, idx) => {
      console.log(`报名 ${idx + 1}:`);
      console.log(`  用户: ${e.userId?.nickname} (${e.userId?.openid})`);
      console.log(`  期次: ${e.periodId?.name}`);
      console.log(`  状态: ${e.status}`);
      console.log(`  支付状态: ${e.paymentStatus}`);
      console.log();
    });

    await mongoose.connection.close();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkEnrollments();
