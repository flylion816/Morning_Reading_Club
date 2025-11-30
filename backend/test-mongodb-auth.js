const mongoose = require('mongoose');
require('dotenv').config();

// 使用.env中的凭证连接
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('✅ 已连接到MongoDB\n');

  const Period = require('./src/models/Period');
  const User = require('./src/models/User');
  const Insight = require('./src/models/Insight');

  try {
    // 1. 查找平衡之道期次
    console.log('========== 1️⃣ 查找平衡之道期次 ==========');
    const period = await Period.findOne({ name: '平衡之道' });
    if (period) {
      console.log('✅ 找到期次: ' + period._id + ' (' + period.name + ')');
      console.log('   status: ' + period.status);
      console.log('   createdAt: ' + period.createdAt);
    } else {
      console.log('❌ 未找到期次');
    }

    // 2. 查找阿泰用户
    console.log('\n========== 2️⃣ 查找阿泰用户 ==========');
    const user = await User.findOne({ nickname: '阿泰' });
    if (user) {
      console.log('✅ 找到用户: ' + user._id + ' (' + user.nickname + ')');
    } else {
      console.log('❌ 未找到用户');
    }

    // 3. 查找该期次的所有insights
    if (period) {
      console.log('\n========== 3️⃣ 该期次的所有insights ==========');
      const insights = await Insight.find({
        periodId: period._id,
        status: 'completed'
      }).populate('userId', 'nickname _id').populate('targetUserId', 'nickname _id');

      console.log('✅ 找到 ' + insights.length + ' 条数据:');
      insights.forEach((i, idx) => {
        const creatorName = i.userId?.nickname || '未知';
        const assignedTo = i.targetUserId?.nickname || '公开';
        console.log('  [' + (idx + 1) + '] type=' + i.type + ', createdBy=' + creatorName + ', assignedTo=' + assignedTo);
      });
    }

    // 4. 测试用户查询逻辑
    if (period && user) {
      console.log('\n========== 4️⃣ 用户' + user.nickname + '能看到的insights ==========');
      
      const baseQuery = {
        periodId: period._id,
        status: 'completed'
      };

      const orConditions = [
        { userId: user._id, ...baseQuery },           // 用户创建的
        { targetUserId: user._id, ...baseQuery }  // 分配给用户的
      ];

      const query = { $or: orConditions };
      const results = await Insight.find(query).populate('userId', 'nickname _id').populate('targetUserId', 'nickname _id');

      console.log('✅ 找到 ' + results.length + ' 条可见的insights:');
      results.forEach((i, idx) => {
        const isCreator = i.userId._id.toString() === user._id.toString();
        const isAssigned = i.targetUserId && i.targetUserId._id.toString() === user._id.toString();
        console.log('  [' + (idx + 1) + '] type=' + i.type + ', content=' + (i.content?.substring(0, 30) || 'N/A') + '...');
        if (isCreator) console.log('           └─ ✓ 你创建的');
        if (isAssigned) console.log('           └─ ✓ 分配给你的');
      });
    }

    await mongoose.connection.close();
    console.log('\n✅ 数据库查询完成');
    process.exit(0);
  } catch (err) {
    console.error('❌ 查询失败:', err.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}).catch(err => {
  console.error('❌ 连接失败:', err.message);
  process.exit(1);
});
