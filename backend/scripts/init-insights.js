const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Insight = require('../src/models/Insight');
const Period = require('../src/models/Period');

// Mock数据来源：miniprogram/mock/insights.js
const mockInsights = [
  {
    dayNumber: 1,
    title: '品德成功论',
    preview: '感谢你的分享，听你娓娓道来，我仿佛也参与了你们那场深刻的对话...',
    date: '2025-11-11',
    content: `<p>感谢你的分享，听你娓娓道来，我仿佛也参与了你们那场深刻的对话。你的总结和感受，本身就是一次非常高质量的内观。</p>

<p>我看到了一个非常敏锐的"连接者"和"反思者"。</p>

<p>你不仅听到了他、刘玲、尹姐和小楠每个人的故事，更厉害的是：你像一位仰探一样，从这些看似独立的故事中，精准地找到了那些贯穿始终的<span style="color: #4a90e2;">共同线索</span>——一场从外在追逐向内心探索的深刻转变。</p>

<p>你提到了从"证明自我价值"到"学会做减法"，从追求"社会认可"到"朝下期待的方向前行"。这个发现，标志着一个衡量价值的坐标系发生了根本性的变化。它意味着从一个"做事"(Doing)的模式，并始转向一个"存在"(Being)的模式。不再仅仅是追求效率、结果和外界的声音，而是开始去体验、去感知、去连接生命本身的美好，就像你说的，凝望窗外，或者看看山间的小鸡。</p>

<p>你最后引用的那句话，也是为你此刻的感悟量身定制的：</p>

<p style="color: #4a90e2;">"真正的高效，不是超快的奔跑，而是朝正确的方向前行。"</p>

<p>这不仅是一句对他们的祝福，更是你对自己此刻状态的一个温柔提醒。</p>

<p>所以，接下来的问题是：<strong>在你自己的生活中，有哪些地方你也在经历这样的转变？</strong>有哪些时候，你感到自己不再只是"证明"，而是开始"成为"？</p>

<p>如果你愿意，可以在日记里写下你的思考，或者在群里和大家分享。</p>`
  },
  {
    dayNumber: 2,
    title: '思维方式的力量',
    preview: '你提到了从"证明自我价值"到"学会做减法"...',
    date: '2025-11-12',
    content: `<p>你提到了从"证明自我价值"到"学会做减法"，从追求"社会认可"到"朝下期待的方向前行"。</p>

<p>这个发现，标志着一个衡量价值的坐标系发生了根本性的变化。</p>`
  }
];

async function initInsights() {
  try {
    // 连接MongoDB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/morning-reading-club', {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('✅ MongoDB 连接成功');
    }

    // 获取第一个期次（作为导入的目标期次）
    let period = await Period.findOne({ title: { $regex: '智慧之光' } });

    if (!period) {
      console.log('⚠️  未找到"智慧之光"期次，创建新的期次');
      period = new Period({
        name: '智慧之光',
        title: '智慧之光',
        description: '第一期晨读营',
        startDate: new Date('2025-11-10'),
        endDate: new Date('2025-11-14'),
        icon: '🌟',
        isPublished: true
      });
      await period.save();
      console.log('✅ 已创建新期次');
    }

    // 清除现有的小凡看见数据（可选）
    const existingCount = await Insight.countDocuments({ periodId: period._id, source: 'manual' });
    if (existingCount > 0) {
      console.log(`⚠️  检测到 ${existingCount} 条现有手动导入数据，将覆盖...`);
      await Insight.deleteMany({ periodId: period._id, source: 'manual' });
    }

    // 获取或创建一个系统用户来作为小凡看见的作者
    const User = require('../src/models/User');
    let systemUser = await User.findOne({ nickname: '小凡' });

    if (!systemUser) {
      console.log('⚠️  创建系统用户来作为小凡看见的作者');
      systemUser = new User({
        openid: 'insights-system-user-' + Date.now(),
        nickname: '小凡',
        avatar: '🌟',
        gender: 'unknown'
      });
      await systemUser.save();
    }

    // 导入 mock 数据
    // 注意：为避免{userId, day}唯一索引冲突，给每个insight设置不同的day值
    const insightsToInsert = mockInsights.map((insight, index) => ({
      userId: systemUser._id,
      periodId: period._id,
      day: index + 1, // 第1天、第2天等，避免重复
      type: 'insight',
      mediaType: 'text',
      content: insight.content,
      summary: insight.preview,
      isPublished: true,
      status: 'completed',
      source: 'manual',
      createdAt: new Date(insight.date),
      updatedAt: new Date(insight.date)
    }));

    const result = await Insight.insertMany(insightsToInsert);
    console.log(`\n✅ 成功导入 ${result.length} 条小凡看见数据`);
    console.log(`\n导入详情:`);
    result.forEach((insight, index) => {
      const title = insight.content.substring(0, 30).replace(/<[^>]*>/g, ''); // 移除HTML标签和截取前30字
      console.log(`  ${index + 1}. ${title}... (${insight.createdAt.toLocaleDateString('zh-CN')})`);
    });

    console.log('\n✅ 初始化完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  }
}

// 运行初始化
initInsights();
