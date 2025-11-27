const mongoose = require('mongoose');
const Enrollment = require('../src/models/Enrollment');

async function check() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

  await mongoose.connect(mongoUri);

  // 统计各状态数量
  const stats = await Enrollment.aggregate([
    {
      $group: {
        _id: '$approvalStatus',
        count: { $sum: 1 }
      }
    }
  ]);

  console.log('\n📊 报名审批状态统计:');
  stats.forEach(stat => {
    console.log(`   ${stat._id || 'null'}: ${stat.count}`);
  });

  // 查看前3条 approved 报名
  const approved = await Enrollment.find({ approvalStatus: 'approved' })
    .limit(3)
    .select('_id userId approvalStatus enrolledAt approvedAt');

  console.log('\n✅ 已批准的报名 (前3条):');
  if (approved.length > 0) {
    approved.forEach(a => {
      console.log(`   userId: ${a.userId}, status: ${a.approvalStatus}, approvedAt: ${a.approvedAt}`);
    });
  } else {
    console.log('   ❌ 没有已批准的报名！');
  }

  await mongoose.connection.close();
}

check().catch(console.error);
