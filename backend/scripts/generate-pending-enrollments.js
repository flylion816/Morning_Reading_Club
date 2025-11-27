/**
 * 生成待审批的报名记录脚本
 * 用法: node generate-pending-enrollments.js [用户数] [期次索引]
 * 示例: node generate-pending-enrollments.js 24 0  // 为前24个用户生成第一个期次的报名
 */

const mongoose = require('mongoose');
const User = require('../src/models/User');
const Period = require('../src/models/Period');
const Enrollment = require('../src/models/Enrollment');

async function generateEnrollments() {
  try {
    // 连接数据库
    const mongoUri = process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';
    console.log('🔗 连接数据库:', mongoUri.replace(/:[^:]*@/, ':***@'));
    await mongoose.connect(mongoUri);

    // 获取参数
    const userCount = parseInt(process.argv[2]) || 24;
    const periodIndex = parseInt(process.argv[3]) || 0;

    console.log(`📝 开始生成 ${userCount} 个待审批报名记录...`);

    // 获取用户列表
    const users = await User.find({}).limit(userCount);
    if (users.length === 0) {
      console.error('❌ 找不到用户，请先创建用户');
      process.exit(1);
    }

    console.log(`✅ 找到 ${users.length} 个用户`);

    // 获取期次
    const periods = await Period.find({});
    if (periods.length === 0) {
      console.error('❌ 找不到期次，请先创建期次');
      process.exit(1);
    }

    const period = periods[periodIndex];
    console.log(`✅ 选择期次: ${period.name} (${period.title})`);

    // 删除旧的报名记录（可选）
    const existingCount = await Enrollment.countDocuments({
      periodId: period._id,
      approvalStatus: 'pending'
    });
    console.log(`⚠️  已存在 ${existingCount} 个待审批报名`);

    // 生成报名记录
    const enrollments = [];
    for (const user of users) {
      // 检查是否已存在
      const existing = await Enrollment.findOne({
        userId: user._id,
        periodId: period._id
      });

      if (!existing) {
        enrollments.push({
          userId: user._id,
          periodId: period._id,
          // 标准报名表单字段
          name: user.nickname || user.name || '用户',
          gender: ['male', 'female', 'prefer_not_to_say'][Math.floor(Math.random() * 3)],
          province: '北京',
          detailedAddress: '测试地址',
          age: Math.floor(Math.random() * 40) + 20,
          referrer: '推荐人',
          hasReadBefore: Math.random() > 0.5,
          readCount: Math.floor(Math.random() * 5),
          enrollReason: `测试报名 - 用户 ${user.nickname || user.name}`,
          expectation: '期待学习更多内容',
          commitment: 'yes',
          // 审批相关
          approvalStatus: 'pending',
          enrolledAt: new Date(),
          paymentStatus: 'pending'
        });
      }
    }

    console.log(`\n📊 准备生成 ${enrollments.length} 个新报名记录...`);

    if (enrollments.length > 0) {
      const result = await Enrollment.insertMany(enrollments);
      console.log(`\n✅ 成功生成 ${result.length} 个报名记录！`);

      // 更新期次的报名人数
      const totalEnrollments = await Enrollment.countDocuments({
        periodId: period._id
      });
      await Period.findByIdAndUpdate(
        period._id,
        { enrolmentCount: totalEnrollments },
        { new: true }
      );
      console.log(`✅ 已更新期次报名人数: ${totalEnrollments}`);
    } else {
      console.log('⚠️  所有用户都已有报名记录');
    }

    // 显示统计
    const pendingCount = await Enrollment.countDocuments({
      periodId: period._id,
      approvalStatus: 'pending'
    });
    const approvedCount = await Enrollment.countDocuments({
      periodId: period._id,
      approvalStatus: 'approved'
    });

    console.log(`\n📈 报名统计:`);
    console.log(`   待审批: ${pendingCount}`);
    console.log(`   已批准: ${approvedCount}`);
    console.log(`   总计: ${pendingCount + approvedCount}`);

    await mongoose.connection.close();
    console.log('\n✨ 完成！');
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

generateEnrollments();
