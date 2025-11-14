const mongoose = require('mongoose');
const User = require('../src/models/User');
const Period = require('../src/models/Period');
const Section = require('../src/models/Section');
const Checkin = require('../src/models/Checkin');
const Insight = require('../src/models/Insight');

mongoose.connect('mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin')
  .then(async () => {
    console.log('MongoDB连接成功\n');

    // 获取阿泰用户
    const ataiUser = await User.findOne({ openid: 'mock_user_001' });
    console.log('阿泰用户:', ataiUser.nickname, '(', ataiUser._id, ')');

    // 获取第一个期次
    const period = await Period.findOne({});
    console.log('期次:', period.title);

    // 获取第一个课节（用于第一条insight）
    const firstCheckin = await Checkin.findOne({ userId: ataiUser._id });
    console.log('首个打卡:', firstCheckin._id);

    // 获取第二个课节用于新的insight
    const section = await Section.findOne({ day: 1 });
    console.log('使用课节:', section.title);

    // 创建新的insight
    const newInsight = {
      userId: ataiUser._id,
      checkinId: firstCheckin._id,
      periodId: period._id,
      sectionId: section._id,
      day: 1,
      type: 'daily',
      content: `
    <div class="insight-content">
      <h3>📊 今日学习洞察</h3>
      <p>恭喜你完成了第 1 天的晨读！</p>

      <h4>💪 你的进步</h4>
      <ul>
        <li>阅读时长: 22 分钟</li>
        <li>完成度: 88%</li>
        <li>这是一个好的开始！</li>
      </ul>

      <h4>🎯 关键收获</h4>
      <p>通过今天的学习，你正在培养关于《第四天 成长与改变的原则》的重要习惯。持续的积累会带来质的飞跃。</p>

      <h4>🌟 下一步建议</h4>
      <ul>
        <li>将今天学到的内容应用到实际生活中</li>
        <li>坚持打卡，保持学习节奏</li>
        <li>在社区中分享你的心得</li>
      </ul>
    </div>
  `,
      summary: '完成第1天学习，阅读22分钟，完成度88%，收获满满！',
      tags: ['学习反馈', '每日总结', '进步追踪'],
      status: 'completed'
    };

    const createdInsight = await Insight.create(newInsight);
    console.log('✅ 成功创建新的insight:', createdInsight._id);

    // 验证数据
    const allInsights = await Insight.find({ userId: ataiUser._id });
    console.log(`\n阿泰用户现在有 ${allInsights.length} 条insight记录`);
    allInsights.forEach((insight, index) => {
      console.log(`  ${index + 1}. 第${insight.day}天 - ${insight.summary}`);
    });

    await mongoose.connection.close();
    console.log('\nMongoDB连接已关闭');
  });
