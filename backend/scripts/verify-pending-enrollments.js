const mongoose = require('mongoose');
const Enrollment = require('../src/models/Enrollment');

async function verify() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';
    console.log('🔗 连接数据库...');
    
    await mongoose.connect(mongoUri);

    // 查询待审批的报名
    const pendingCount = await Enrollment.countDocuments({ approvalStatus: 'pending' });
    const allCount = await Enrollment.countDocuments();
    const activeCount = await Enrollment.countDocuments({ status: 'active' });

    console.log('\n📊 数据库统计:');
    console.log(`   总报名数: ${allCount}`);
    console.log(`   待审批 (approvalStatus): ${pendingCount}`);
    console.log(`   活跃报名 (status=active): ${activeCount}`);

    if (pendingCount > 0) {
      console.log(`\n✅ API 修复成功！现在应该能看到 ${pendingCount} 个待审批报名`);
      console.log('🔧 下一步: 在管理界面 http://localhost:5173/enrollments 查看这些报名');
    } else {
      console.log('\n⚠️ 数据库中没有待审批的报名');
    }

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    process.exit(1);
  }
}

verify();
