/**
 * 测试脚本：查找阿泰用户的平衡之道期次小凡看见
 * 用法: node test-atai-insights.js
 */

const mongoose = require('mongoose');

// 连接到数据库
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/morning-reading';

async function testAtaiInsights() {
  try {
    console.log('\n========== 查找阿泰用户的小凡看见 ==========\n');

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ 数据库连接成功\n');

    const Insight = require('./src/models/Insight');
    const User = require('./src/models/User');
    const Period = require('./src/models/Period');

    // 1. 查找阿泰用户
    console.log('📋 第1步：查找用户"阿泰"');
    const ataiUser = await User.findOne({ nickname: '阿泰' }).select('_id nickname');
    console.log(`查询条件: { nickname: "阿泰" }`);

    if (!ataiUser) {
      console.log('❌ 未找到用户"阿泰"，尝试模糊查询...\n');
      const users = await User.find({ nickname: { $regex: '泰', $options: 'i' } }).select('_id nickname').limit(5);
      console.log(`模糊查询结果 (包含"泰"的用户):`);
      users.forEach(u => console.log(`  - ${u.nickname} (ID: ${u._id})`));
      console.log();

      if (users.length === 0) {
        console.log('尝试查询所有用户...\n');
        const allUsers = await User.find().select('_id nickname').limit(10);
        console.log('数据库中的用户列表:');
        allUsers.forEach(u => console.log(`  - ${u.nickname} (ID: ${u._id})`));
        process.exit(0);
      }
    } else {
      console.log(`✅ 找到用户: ${ataiUser.nickname} (ID: ${ataiUser._id})\n`);
    }

    // 2. 查找平衡之道期次
    console.log('📋 第2步：查找期次"平衡之道"');
    let balancePeriod = await Period.findOne({ name: { $regex: '平衡之道', $options: 'i' } });

    if (!balancePeriod) {
      balancePeriod = await Period.findOne({ title: { $regex: '平衡之道', $options: 'i' } });
    }

    console.log(`查询条件: { name: /平衡之道/ }`);

    if (!balancePeriod) {
      console.log('❌ 未找到期次"平衡之道"，查询所有期次...\n');
      const periods = await Period.find().select('_id name title').limit(10);
      console.log('数据库中的期次列表:');
      periods.forEach(p => console.log(`  - ${p.name || p.title} (ID: ${p._id})`));
      process.exit(0);
    } else {
      console.log(`✅ 找到期次: ${balancePeriod.name || balancePeriod.title} (ID: ${balancePeriod._id})\n`);
    }

    // 3. 查询该用户在该期次的所有insights（无论是否是用户创建或被分配）
    console.log('📋 第3步：查询阿泰在平衡之道期次的insights');

    const userId = ataiUser._id.toString();
    const periodId = balancePeriod._id.toString();

    const orConditions = [
      { userId, periodId, status: 'completed' },  // 阿泰创建的
      { targetUserId: userId, periodId, status: 'completed' }  // 分配给阿泰的
    ];
    const query = { $or: orConditions };

    console.log(`用户ID: ${userId}`);
    console.log(`期次ID: ${periodId}`);
    console.log(`查询条件:`);
    console.log(JSON.stringify(query, null, 2));
    console.log();

    // 执行查询
    const insights = await Insight.find(query)
      .populate('userId', 'nickname _id')
      .populate('targetUserId', 'nickname _id')
      .populate('sectionId', 'title day')
      .sort({ createdAt: -1 });

    console.log(`✅ 查询返回 ${insights.length} 条insights\n`);

    if (insights.length === 0) {
      console.log('❌ 阿泰在平衡之道期次没有任何insights');
      console.log('\n🔍 排查建议:');
      console.log('  1. 检查阿泰是否真的创建过insights');
      console.log('  2. 检查是否有管理员为阿泰分配过insights');
      console.log('  3. 检查数据库中是否有完整的userId或targetUserId数据\n');

      // 查询该期次的所有insights
      console.log('该期次的所有insights:');
      const allPeriodInsights = await Insight.find({ periodId }).select('userId targetUserId type createdAt');
      console.log(`总数: ${allPeriodInsights.length}\n`);

      if (allPeriodInsights.length > 0) {
        allPeriodInsights.slice(0, 5).forEach((i, idx) => {
          console.log(`${idx + 1}. userId: ${i.userId}, targetUserId: ${i.targetUserId}, type: ${i.type}`);
        });
      }
    } else {
      console.log('📋 Insights详情:');
      insights.forEach((insight, idx) => {
        console.log(`\n${idx + 1}. Insight ID: ${insight._id}`);
        console.log(`   类型: ${insight.type}`);
        console.log(`   创建者: ${insight.userId?.nickname || insight.userId} ${insight.userId ? '✅' : ''}`);
        console.log(`   被分配给: ${insight.targetUserId?.nickname || insight.targetUserId || 'N/A'} ${insight.targetUserId ? '✅' : ''}`);
        console.log(`   所属章节: ${insight.sectionId?.title || insight.sectionId || 'N/A'}`);
        console.log(`   来源: ${insight.userId?._id?.toString() === userId ? '用户创建' : '用户被分配'}`);
        console.log(`   创建时间: ${insight.createdAt}`);
      });

      console.log('\n✅ 数据验证成功！');
      console.log('\n📝 这说明:');
      console.log('  ✅ 阿泰确实在平衡之道期次有小凡看见记录');
      console.log('  ✅ 后端$or查询逻辑正常工作');
      console.log('  ⚠️  问题应该在小程序端的API调用或数据处理上');
    }

    // 4. 对比两个单独的查询结果
    console.log('\n\n📋 第4步：对比单独查询的结果');

    const createdByUser = await Insight.find({
      userId,
      periodId,
      status: 'completed'
    }).countDocuments();

    const assignedToUser = await Insight.find({
      targetUserId: userId,
      periodId,
      status: 'completed'
    }).countDocuments();

    console.log(`阿泰创建的insights: ${createdByUser}`);
    console.log(`分配给阿泰的insights: ${assignedToUser}`);
    console.log(`总计: ${createdByUser + assignedToUser}`);
    console.log(`实际$or查询结果: ${insights.length}`);

    if (insights.length === createdByUser + assignedToUser) {
      console.log('✅ 数字匹配！$or查询逻辑正确');
    } else {
      console.log('❌ 数字不匹配！');
    }

    console.log('\n✅ 测试完成！');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAtaiInsights();
