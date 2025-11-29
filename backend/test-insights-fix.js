/**
 * 测试脚本：验证getUserInsights函数的$or查询是否有效
 * 用法: node test-insights-fix.js
 */

const mongoose = require('mongoose');

// 连接到数据库
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/morning-reading';

async function testInsightsFix() {
  try {
    console.log('\n========== 小凡看见($or查询)修复测试 ==========\n');

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ 数据库连接成功\n');

    const Insight = require('./src/models/Insight');
    const User = require('./src/models/User');

    // 1. 获取所有用户
    console.log('📋 第1步：获取所有用户');
    const users = await User.find().limit(3).select('_id nickname');
    console.log(`找到 ${users.length} 个用户\n`);

    if (users.length === 0) {
      console.log('⚠️  数据库中没有用户，无法继续测试');
      process.exit(0);
    }

    // 2. 检查是否有targetUserId数据
    console.log('📋 第2步：检查是否有targetUserId的insights');
    const insightsWithTarget = await Insight.countDocuments({ targetUserId: { $ne: null } });
    console.log(`有targetUserId的insights数量: ${insightsWithTarget}\n`);

    if (insightsWithTarget === 0) {
      console.log('⚠️  警告：数据库中没有targetUserId的insights');
      console.log('   需要在admin后台手动分配insights给用户\n');
    }

    // 3. 测试第一个用户的$or查询
    console.log('📋 第3步：测试$or查询逻辑');
    const testUserId = users[0]._id.toString();
    console.log(`测试用户: ${users[0].nickname} (ID: ${testUserId})\n`);

    // 构建$or查询（和后端一样的逻辑）
    const orConditions = [
      { userId: testUserId, status: 'completed' },
      { targetUserId: testUserId, status: 'completed' }
    ];
    const query = { $or: orConditions };

    console.log('查询条件:');
    console.log(JSON.stringify(query, null, 2));
    console.log();

    // 4. 执行查询
    const insights = await Insight.find(query)
      .populate('userId', 'nickname _id')
      .populate('targetUserId', 'nickname _id')
      .populate('periodId', 'name')
      .limit(5)
      .lean();

    console.log(`✅ 查询返回 ${insights.length} 条insights\n`);

    if (insights.length === 0) {
      console.log('⚠️  该用户没有任何insights（创建的或被分配的）');
    } else {
      console.log('查询结果详情:');
      insights.forEach((insight, idx) => {
        console.log(`\n${idx + 1}. Insight ID: ${insight._id}`);
        console.log(`   创建者: ${insight.userId?.nickname || insight.userId} ${insight.userId ? '✅ (已populate)' : ''}`);
        console.log(`   被分配给: ${insight.targetUserId?.nickname || insight.targetUserId || 'N/A'} ${insight.targetUserId ? '✅ (已populate)' : ''}`);
        console.log(`   期次: ${insight.periodId?.name || insight.periodId || 'N/A'}`);
        console.log(`   来源: ${insight.userId?._id === testUserId ? '用户创建' : '用户被分配'}`);
      });
    }

    // 5. 对比两个单独的查询结果
    console.log('\n\n📋 第4步：对比单独查询的结果');

    const createdByUser = await Insight.find({ userId: testUserId, status: 'completed' }).countDocuments();
    const assignedToUser = await Insight.find({ targetUserId: testUserId, status: 'completed' }).countDocuments();

    console.log(`用户创建的insights: ${createdByUser}`);
    console.log(`分配给用户的insights: ${assignedToUser}`);
    console.log(`总计（应该等于上面的$or查询结果）: ${createdByUser + assignedToUser}`);
    console.log(`实际$or查询结果: ${insights.length}`);

    if (insights.length === createdByUser + assignedToUser) {
      console.log('✅ 数字匹配！$or查询逻辑正确');
    } else {
      console.log('❌ 数字不匹配！可能有重复或其他问题');
    }

    // 6. 测试多个用户
    console.log('\n\n📋 第5步：测试其他用户');
    for (let i = 1; i < users.length; i++) {
      const userId = users[i]._id.toString();
      const count = await Insight.find({
        $or: [
          { userId, status: 'completed' },
          { targetUserId: userId, status: 'completed' }
        ]
      }).countDocuments();
      console.log(`${users[i].nickname}: ${count} 条insights`);
    }

    console.log('\n✅ 测试完成！');
    console.log('\n📝 总结:');
    console.log('   如果上面的查询返回了结果，说明修复有效！');
    console.log('   小程序应该能看到被分配的insights。');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:');
    console.error(error.message);
    process.exit(1);
  }
}

testInsightsFix();
