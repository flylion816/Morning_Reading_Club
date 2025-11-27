const mongoose = require('mongoose');
const Enrollment = require('/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/models/Enrollment');

async function test() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

  await mongoose.connect(mongoUri);

  console.log('\n===== 测试批量批准前 =====');
  const statsBefore = await Enrollment.aggregate([
    {
      $group: {
        _id: '$approvalStatus',
        count: { $sum: 1 }
      }
    }
  ]);

  statsBefore.forEach(stat => {
    console.log(`   ${stat._id || 'null'}: ${stat.count}`);
  });

  // 模拟批量批准：获取前3个pending的报名，更新为approved
  const pendingEnrollments = await Enrollment.find({ approvalStatus: 'pending' }).limit(3);
  console.log(`\n📝 找到 ${pendingEnrollments.length} 个待审批报名，准备批准...`);

  for (const enrollment of pendingEnrollments) {
    // 直接更新，模拟 PUT /enrollments/:id 的操作
    const updated = await Enrollment.findByIdAndUpdate(
      enrollment._id,
      { approvalStatus: 'approved' },
      { new: true }
    );
    console.log(`✅ 批准报名 ${enrollment._id}，新状态: ${updated.approvalStatus}`);
  }

  console.log('\n===== 测试批量批准后 =====');
  const statsAfter = await Enrollment.aggregate([
    {
      $group: {
        _id: '$approvalStatus',
        count: { $sum: 1 }
      }
    }
  ]);

  statsAfter.forEach(stat => {
    console.log(`   ${stat._id || 'null'}: ${stat.count}`);
  });

  const approvedCount = await Enrollment.countDocuments({ approvalStatus: 'approved' });
  console.log(`\n✨ 最终结果: 已有 ${approvedCount} 个批准的报名`);

  await mongoose.connection.close();
}

test().catch(console.error);
