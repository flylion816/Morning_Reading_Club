const mongoose = require('mongoose');
const User = require('../src/models/User');
const Period = require('../src/models/Period');
const Section = require('../src/models/Section');
const Checkin = require('../src/models/Checkin');
const Insight = require('../src/models/Insight');

const MONGODB_URI = 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin';

// 生成打卡内容
function generateCheckinContent(userName, sectionTitle, day) {
  const templates = [
    `今天学习了《${sectionTitle}》，感触很深。这个原则让我重新思考了自己的行为模式。`,
    `第${day}天打卡！《${sectionTitle}》这一章节给我很大启发，我决定从今天开始改变。`,
    `完成今日学习！${sectionTitle}的内容很有价值，我会努力实践这些原则。`,
    `${sectionTitle}让我意识到了自己的不足，接下来要好好反思和改进。`,
    `今天的学习收获满满！特别是关于${sectionTitle}的部分，让我豁然开朗。`
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

// 生成AI反馈内容
function generateInsightContent(sectionTitle, day, readingTime, completionRate) {
  return `
    <div class="insight-content">
      <h3>📊 今日学习洞察</h3>
      <p>恭喜你完成了第 ${day} 天的晨读！</p>

      <h4>💪 你的进步</h4>
      <ul>
        <li>阅读时长: ${readingTime} 分钟</li>
        <li>完成度: ${completionRate}%</li>
        <li>坚持天数已达到新高度！</li>
      </ul>

      <h4>🎯 关键收获</h4>
      <p>通过今天的学习，你正在培养关于《${sectionTitle}》的重要习惯。持续的积累会带来质的飞跃。</p>

      <h4>🌟 下一步建议</h4>
      <ul>
        <li>将今天学到的内容应用到实际生活中</li>
        <li>坚持打卡，保持学习节奏</li>
        <li>在社区中分享你的心得</li>
      </ul>
    </div>
  `;
}

async function initCheckinsAndInsights() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB连接成功\n');

    // 获取现有数据
    const users = await User.find({}).limit(5);
    const periods = await Period.find({});
    const sections = await Section.find({}).sort({ day: 1 });

    console.log(`找到 ${users.length} 个用户`);
    console.log(`找到 ${periods.length} 个期次`);
    console.log(`找到 ${sections.length} 个课节\n`);

    if (users.length === 0 || periods.length === 0 || sections.length === 0) {
      console.log('缺少基础数据，请先运行 init-mongodb.js');
      process.exit(1);
    }

    // 清空现有的打卡和反馈数据
    await Checkin.deleteMany({});
    await Insight.deleteMany({});
    console.log('已清空现有打卡和反馈数据\n');

    const period = periods[0];
    const normalSections = sections.filter(s => s.day > 0);

    // 为每个用户创建打卡记录
    const checkins = [];
    const insights = [];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      // 每个用户随机打卡1-4天
      const checkinDays = Math.floor(Math.random() * 4) + 1;

      console.log(`为用户 ${user.nickname} 创建 ${checkinDays} 条打卡记录...`);

      for (let day = 1; day <= checkinDays && day <= normalSections.length; day++) {
        const section = normalSections[day - 1];
        const readingTime = Math.floor(Math.random() * 20) + 10;
        const completionRate = Math.floor(Math.random() * 30) + 70;

        // 打卡日期：从今天往前推day天
        const checkinDate = new Date();
        checkinDate.setDate(checkinDate.getDate() - (checkinDays - day));

        // 创建打卡记录
        const checkin = {
          userId: user._id,
          periodId: period._id,
          sectionId: section._id,
          day: section.day,
          checkinDate: checkinDate,
          readingTime: readingTime,
          completionRate: completionRate,
          note: generateCheckinContent(user.nickname, section.title, day),
          images: [],
          mood: ['happy', 'calm', 'thoughtful', 'inspired'][Math.floor(Math.random() * 4)],
          isPublic: Math.random() > 0.2,
          points: 10
        };

        const createdCheckin = await Checkin.create(checkin);
        checkins.push(createdCheckin);

        // 50%的概率生成AI反馈
        if (Math.random() > 0.5) {
          const insight = {
            userId: user._id,
            checkinId: createdCheckin._id,
            periodId: period._id,
            sectionId: section._id,
            day: section.day,
            type: 'daily',
            content: generateInsightContent(section.title, day, readingTime, completionRate),
            summary: `完成第${day}天学习，阅读${readingTime}分钟，完成度${completionRate}%，收获满满！`,
            tags: ['学习反馈', '每日总结', '进步追踪'],
            status: 'completed'
          };

          const createdInsight = await Insight.create(insight);
          insights.push(createdInsight);
        }
      }
    }

    console.log(`\n✅ 成功创建 ${checkins.length} 条打卡记录`);
    console.log(`✅ 成功创建 ${insights.length} 条AI反馈\n`);

    // 显示统计信息
    console.log('=== 数据统计 ===');
    console.log(`用户总数: ${users.length}`);
    console.log(`期次总数: ${periods.length}`);
    console.log(`课节总数: ${sections.length}`);
    console.log(`打卡记录: ${checkins.length}`);
    console.log(`AI反馈: ${insights.length}`);

    await mongoose.connection.close();
    console.log('\nMongoDB连接已关闭');
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

initCheckinsAndInsights();
