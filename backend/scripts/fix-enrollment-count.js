/**
 * 修复数据库中的报名计数
 * 根据实际的enrollment记录数更新period表中的enrollmentCount字段
 */

const mongoose = require('mongoose');
const Enrollment = require('../src/models/Enrollment');
const Period = require('../src/models/Period');

async function fixEnrollmentCount() {
  try {
    console.log('🔧 开始修复报名计数...\n');

    // 连接MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_reading';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ MongoDB 连接成功\n');

    // 获取所有期次
    const periods = await Period.find({});
    console.log(`📋 找到 ${periods.length} 个期次\n`);

    let fixedCount = 0;

    // 对每个期次统计报名人数
    for (const period of periods) {
      const enrollmentCount = await Enrollment.countDocuments({
        periodId: period._id,
        status: { $in: ['active', 'completed'] }
      });

      // 如果计数不一致，更新
      if (period.enrollmentCount !== enrollmentCount) {
        console.log(`⚠️  期次: ${period.name || period.title}`);
        console.log(`   旧值: ${period.enrollmentCount}, 新值: ${enrollmentCount}`);

        await Period.findByIdAndUpdate(period._id, {
          enrollmentCount: enrollmentCount
        });

        fixedCount++;
        console.log(`   ✅ 已更新\n`);
      } else {
        console.log(`✅ 期次: ${period.name || period.title} - 计数正确 (${enrollmentCount})\n`);
      }
    }

    console.log(`\n📊 修复结果:`);
    console.log(`   总期次: ${periods.length}`);
    console.log(`   已修复: ${fixedCount}`);
    console.log(`   正确的: ${periods.length - fixedCount}`);

    console.log('\n✅ 修复完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(1);
  }
}

fixEnrollmentCount();
