const mongoose = require('mongoose');

// 连接数据库
mongoose.connect('mongodb://localhost:27017/morning_reading', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('✅ 已连接到MongoDB\n');

  const Period = require('./src/models/Period');
  const User = require('./src/models/User');
  const Insight = require('./src/models/Insight');

  // 1. 查找平衡之道期次
  console.log('========== 1️⃣ 查找平衡之道期次 ==========');
  const period = await Period.findOne({ name: '平衡之道' });
  if (period) {
    console.log('✅ 找到期次:', period._id, '(' + period.name + ')');
    console.log('   status:', period.status);
  } else {
    console.log('❌ 未找到期次');
  }

  // 2. 查找阿泰用户
  console.log('\n========== 2️⃣ 查找阿泰用户 ==========');
  const user = await User.findOne({ nickname: '阿泰' });
  if (user) {
    console.log('✅ 找到用户:', user._id, '(' + user.nickname + ')');
  } else {
    console.log('❌ 未找到用户');
  }

  // 3. 查找所有insights（不过滤）
  console.log('\n========== 3️⃣ 查找所有insights ==========');
  const allInsights = await Insight.find().limit(5);
  console.log('数据库中前5条insights:');
  allInsights.forEach(i => {
    console.log('  - ' + i._id + '\n    type: ' + i.type + '\n    userId: ' + i.userId + '\n    targetUserId: ' + i.targetUserId + '\n    periodId: ' + i.periodId);
  });

  // 4. 查找用户创建或被分配的insights
  if (period && user) {
    console.log('\n========== 4️⃣ 查找用户的insights（创建的或被分配的） ==========');
    const userInsights = await Insight.find({
      $or: [
        { userId: user._id },
        { targetUserId: user._id }
      ]
    });
    console.log('✅ 找到 ' + userInsights.length + ' 条数据');
    userInsights.forEach(i => {
      console.log('  - ' + i._id + ' (type: ' + i.type + ', createdBy: ' + i.userId + ', assignedTo: ' + i.targetUserId + ')');
    });
  }

  // 5. 查找该期次的所有insights
  if (period) {
    console.log('\n========== 5️⃣ 查找该期次的所有insights ==========');
    const periodInsights = await Insight.find({
      periodId: period._id,
      status: 'completed'
    });
    console.log('✅ 找到 ' + periodInsights.length + ' 条数据:');
    periodInsights.forEach(i => {
      console.log('  - ' + i._id + ' (type: ' + i.type + ', userId: ' + i.userId + ', targetUserId: ' + i.targetUserId + ')');
    });
  }

  // 6. 测试API查询逻辑
  if (period && user) {
    console.log('\n========== 6️⃣ 测试API查询逻辑（模拟getInsightsForPeriod） ==========');
    console.log('用户:', user._id);
    console.log('期次:', period._id);

    const baseQuery = {
      periodId: period._id,
      status: 'completed'
    };

    const orConditions = [
      { userId: user._id, ...baseQuery },           // 当前用户创建的
      { targetUserId: user._id, ...baseQuery }  // 分配给当前用户的
    ];

    const query = { $or: orConditions };
    console.log('\n查询条件:', JSON.stringify(query, null, 2));

    const results = await Insight.find(query);
    console.log('\n查询结果 (' + results.length + ' 条):');
    results.forEach(i => {
      const isCreator = i.userId.toString() === user._id.toString();
      const isAssigned = i.targetUserId && i.targetUserId.toString() === user._id.toString();
      console.log('  - ' + i._id);
      console.log('    type: ' + i.type);
      console.log('    creator(userId): ' + i.userId + (isCreator ? ' ← 是创建者' : ''));
      console.log('    assigned(targetUserId): ' + i.targetUserId + (isAssigned ? ' ← 被分配给你' : ''));
    });
  }

  await mongoose.connection.close();
  console.log('\n✅ 数据库查询完成');
  process.exit(0);
}).catch(err => {
  console.error('❌ 连接失败:', err.message);
  process.exit(1);
});
