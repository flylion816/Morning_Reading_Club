require('dotenv').config();
const mongoose = require('mongoose');

// 导入模型
const User = require('../src/models/User');
const Period = require('../src/models/Period');
const Section = require('../src/models/Section');
const Checkin = require('../src/models/Checkin');
const Comment = require('../src/models/Comment');
const Insight = require('../src/models/Insight');

// Mock数据
const mockUsers = [
  {
    openid: 'mock_admin_001',
    nickname: '管理员',
    avatar: '👨‍💼',
    avatarUrl: null,
    signature: '七个习惯晨读营 - 让阅读成为习惯',
    gender: 'unknown',
    totalCheckinDays: 150,
    currentStreak: 45,
    maxStreak: 60,
    totalCompletedPeriods: 5,
    totalPoints: 1500,
    level: 10,
    role: 'admin',
    status: 'active'
  },
  {
    openid: 'mock_user_001',
    nickname: '狮子',
    avatar: '🦁',
    avatarUrl: null,
    signature: '在每一次看见中不住相，/n在每一次倾听中生慈悲',
    gender: 'male',
    totalCheckinDays: 88,
    currentStreak: 22,
    maxStreak: 35,
    totalCompletedPeriods: 3,
    totalPoints: 880,
    level: 6,
    role: 'user',
    status: 'active'
  },
  {
    openid: 'mock_user_002',
    nickname: '李四',
    avatar: '🐯',
    avatarUrl: null,
    signature: '每天进步一点点',
    gender: 'female',
    totalCheckinDays: 65,
    currentStreak: 15,
    maxStreak: 28,
    totalCompletedPeriods: 2,
    totalPoints: 650,
    level: 5,
    role: 'user',
    status: 'active'
  },
  {
    openid: 'mock_user_003',
    nickname: '王五',
    avatar: '🐼',
    avatarUrl: null,
    signature: '读书使人明智',
    gender: 'male',
    totalCheckinDays: 42,
    currentStreak: 8,
    maxStreak: 20,
    totalCompletedPeriods: 1,
    totalPoints: 420,
    level: 4,
    role: 'user',
    status: 'active'
  },
  {
    openid: 'mock_user_004',
    nickname: '赵六',
    avatar: '🦊',
    avatarUrl: null,
    signature: '终身学习，永不止步',
    gender: 'female',
    totalCheckinDays: 120,
    currentStreak: 30,
    maxStreak: 45,
    totalCompletedPeriods: 4,
    totalPoints: 1200,
    level: 8,
    role: 'user',
    status: 'active'
  }
];

const mockPeriods = [
  {
    name: '勇敢的心',
    subtitle: '七个习惯晨读营',
    title: '勇敢的心 - 七个习惯晨读营',
    description: '21天养成阅读习惯，培养品德成功论思维',
    icon: '⛰️',
    coverColor: 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)',
    coverEmoji: '⛰️',
    startDate: new Date('2025-10-11'),
    endDate: new Date('2025-11-13'),
    totalDays: 23,
    price: 99,
    originalPrice: 199,
    maxEnrollment: 100,
    currentEnrollment: 35,
    status: 'ongoing',
    isPublished: true,
    sortOrder: 1
  },
  {
    name: '能量之泉',
    subtitle: '七个习惯晨读营',
    title: '能量之泉 - 七个习惯晨读营',
    description: '探索内在能量，提升自我效能',
    icon: '🌊',
    coverColor: 'linear-gradient(135deg, #7ed321 0%, #63b520 100%)',
    coverEmoji: '🌊',
    startDate: new Date('2025-08-09'),
    endDate: new Date('2025-09-12'),
    totalDays: 23,
    price: 99,
    originalPrice: 199,
    maxEnrollment: 100,
    currentEnrollment: 28,
    status: 'completed',
    isPublished: true,
    sortOrder: 2
  },
  {
    name: '心流之境',
    subtitle: '七个习惯晨读营',
    title: '心流之境 - 七个习惯晨读营',
    description: '进入心流状态，提升专注力',
    icon: '✨',
    coverColor: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)',
    coverEmoji: '✨',
    startDate: new Date('2025-06-14'),
    endDate: new Date('2025-07-06'),
    totalDays: 23,
    price: 99,
    originalPrice: 199,
    maxEnrollment: 100,
    currentEnrollment: 45,
    status: 'completed',
    isPublished: true,
    sortOrder: 3
  }
];

// 初始化函数
async function initMongoDB() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected');

    // 清空现有数据
    console.log('\n🧹 Clearing existing data...');
    await User.deleteMany({});
    await Period.deleteMany({});
    await Section.deleteMany({});
    await Checkin.deleteMany({});
    await Comment.deleteMany({});
    await Insight.deleteMany({});
    console.log('✅ Data cleared');

    // 创建用户
    console.log('\n👥 Creating users...');
    const users = await User.create(mockUsers);
    console.log(`✅ Created ${users.length} users`);

    // 创建期次
    console.log('\n📚 Creating periods...');
    const periods = await Period.create(mockPeriods);
    console.log(`✅ Created ${periods.length} periods`);

    // 创建课节（为第一个期次创建5天课程）
    const period1 = periods[0];
    console.log(`\n📖 Creating sections for period: ${period1.name}...`);

    const mockSections = [
      {
        periodId: period1._id,
        day: 0,
        title: '开营词',
        subtitle: '欢迎来到七个习惯晨读营',
        icon: '📢',
        meditation: '开始学习之前，给自己1分钟的时间，深呼吸，静静心，然后开始学习。',
        question: null,
        content: `<p>欢迎来到七个习惯晨读营！</p>
          <p>在接下来的23天里，我们将一起学习史蒂芬·柯维的经典著作《高效能人士的七个习惯》。</p>
          <p><strong style="color: #4a90e2;">这是一次改变人生的旅程，让我们一起出发！</strong></p>`,
        reflection: null,
        action: '在日记中写下你的学习目标和期望',
        sortOrder: 0,
        isPublished: true
      },
      {
        periodId: period1._id,
        day: 1,
        title: '品德成功论',
        subtitle: '第一天',
        icon: '📖',
        meditation: '开始学习之前，给自己1分钟的时间，深呼吸，静静心，然后开始学习。',
        question: '品德成功论和个性成功论有什么区别？哪一个更本质？',
        content: `<p>纵观历史，成功学著作有两种截然不同的思想体系。</p>
          <p>美国建国以来的 150 年里，<strong style="color: #4a90e2;">成功学著作重视品德，强调诚信、谦虚、忠诚、节制、勇气、正义、耐心、勤勉、朴素以及黄金法则。</strong></p>
          <p>但在此后不久，成功学的基调突然发生了变化，从"品德成功论"转向"个性成功论"。</p>
          <p>现在的成功学著作着重于社交形象、态度与行为、技巧与手段，以便应用于人际关系、销售等。然而在相互依赖的环境中，单凭技巧与手段很难获得成功。要想获得持久的成功，关键在于培养优秀的品德。</p>
          <p><strong style="color: #4a90e2;">品德是真正的根本，它在每个人内心深处起作用，会影响我们如何看待世界。</strong>品德犹如灯塔，是永恒不变的原则，能帮助我们建立一张无懈可击的人生地图。</p>
          <p>个性成功论的技巧也能发挥作用，但只有在品德成功论的基础之上才是有用的。</p>`,
        reflection: '上文中，哪一句话特别触动我？引起了我哪些感触？我的生活中有哪些例子可以印证品德成功论的重要性？',
        action: '把感触记录在日记中，与营友们分享你的收获。如果有触动你的金句，也可以摘抄下来。',
        sortOrder: 1,
        isPublished: true
      },
      {
        periodId: period1._id,
        day: 2,
        title: '思维方式的力量',
        subtitle: '第二天',
        icon: '💡',
        meditation: '深呼吸，让自己进入学习状态。',
        question: '思维方式如何影响我们的行为和结果？',
        content: `<p>我们的思维方式决定了我们如何看待世界，也决定了我们的行为和结果。</p>
          <p><strong style="color: #4a90e2;">改变思维方式，才能改变人生。</strong></p>
          <p>思维方式是我们观察世界的方式，它源于我们的经历、价值观和信念。</p>`,
        reflection: '我的思维方式是怎样的？它如何影响了我的生活？',
        action: '记录一个具体例子，说明思维方式如何影响了你的决策',
        sortOrder: 2,
        isPublished: true
      },
      {
        periodId: period1._id,
        day: 3,
        title: '以原则为中心的思维方式',
        subtitle: '第三天',
        icon: '🎯',
        meditation: '静心，专注于当下的学习。',
        question: '什么是以原则为中心的思维方式？',
        content: `<p>以原则为中心的思维方式意味着我们的行为基于不变的自然法则。</p>
          <p><strong style="color: #4a90e2;">原则是客观存在的，不以人的意志为转移。</strong></p>
          <p>诚信、公正、尊重、勇气等都是永恒的原则。</p>`,
        reflection: '在我的生活中，哪些原则是我最看重的？',
        action: '列出你的核心原则清单',
        sortOrder: 3,
        isPublished: true
      },
      {
        periodId: period1._id,
        day: 4,
        title: '成长和改变的原则',
        subtitle: '第四天',
        icon: '🌱',
        meditation: '深呼吸三次，准备开始今天的学习。',
        question: '真正的成长需要什么？',
        content: `<p>成长是一个循序渐进的过程，不能跨越必经的阶段。</p>
          <p><strong style="color: #4a90e2;">就像种子成长为大树，需要时间和耐心。</strong></p>
          <p>真正的改变来自内在，需要我们持续地努力和实践。</p>`,
        reflection: '我在哪些方面需要成长？我准备如何做？',
        action: '制定一个30天的成长计划',
        sortOrder: 4,
        isPublished: true
      }
    ];

    const sections = await Section.create(mockSections);
    console.log(`✅ Created ${sections.length} sections`);

    // 创建打卡记录（为第二个用户创建前3天的打卡）
    const user2 = users[1];
    console.log(`\n✅ Creating checkins for user: ${user2.nickname}...`);

    const mockCheckins = [
      {
        userId: user2._id,
        periodId: period1._id,
        sectionId: sections[1]._id,
        day: 1,
        checkinDate: new Date(),
        readingTime: 15,
        completionRate: 100,
        note: '品德成功论真的很有道理！诚信、谦虚这些品质确实是成功的基础。我要在生活中更加注重培养自己的品德。',
        images: [],
        mood: 'inspired',
        points: 10,
        isPublic: true
      },
      {
        userId: user2._id,
        periodId: period1._id,
        sectionId: sections[2]._id,
        day: 2,
        checkinDate: new Date(Date.now() - 86400000),
        readingTime: 12,
        completionRate: 100,
        note: '思维方式的力量太强大了！改变思维，就能改变人生。今天学到的内容让我重新审视自己的思维模式。',
        images: [],
        mood: 'thoughtful',
        points: 10,
        isPublic: true
      },
      {
        userId: user2._id,
        periodId: period1._id,
        sectionId: sections[3]._id,
        day: 3,
        checkinDate: new Date(Date.now() - 172800000),
        readingTime: 18,
        completionRate: 100,
        note: '以原则为中心的思维方式让我明白了什么是真正重要的。原则是永恒的，不会因环境改变而改变。',
        images: [],
        mood: 'calm',
        points: 10,
        isPublic: true
      }
    ];

    const checkins = await Checkin.create(mockCheckins);
    console.log(`✅ Created ${checkins.length} checkins`);

    // 创建评论
    console.log('\n💬 Creating comments...');
    const user3 = users[2];
    const user4 = users[3];
    const user5 = users[4];

    const mockComments = [
      {
        checkinId: checkins[0]._id,
        userId: user3._id,
        content: '非常优秀！对品德成功论的理解非常深入！😊',
        replyCount: 0,
        replies: []
      },
      {
        checkinId: checkins[0]._id,
        userId: user4._id,
        content: '诚信确实是基础，感谢分享这个观点！💪',
        replyCount: 1,
        replies: [
          {
            userId: user2._id,
            content: '谢谢认可！一起加油！',
            replyToUserId: user4._id,
            createdAt: new Date()
          }
        ]
      },
      {
        checkinId: checkins[1]._id,
        userId: user5._id,
        content: '点赞！思维方式真的很重要！',
        replyCount: 0,
        replies: []
      }
    ];

    const comments = await Comment.create(mockComments);
    console.log(`✅ Created ${comments.length} comments`);

    // 创建AI反馈
    console.log('\n🤖 Creating AI insights...');
    const mockInsights = [
      {
        userId: user2._id,
        checkinId: checkins[0]._id,
        periodId: period1._id,
        sectionId: sections[1]._id,
        day: 1,
        type: 'daily',
        content: `<div class="insight-content">
          <h3>📊 今日学习洞察</h3>
          <p>恭喜你完成了第 1 天的晨读！</p>
          <h4>💪 你的进步</h4>
          <ul>
            <li>阅读时长: 15 分钟</li>
            <li>完成度: 100%</li>
            <li>坚持天数已达到新高度！</li>
          </ul>
          <h4>🎯 关键收获</h4>
          <p>通过今天的学习，你正在培养品德成功论的思维方式。持续的积累会带来质的飞跃。</p>
          <h4>🌟 下一步建议</h4>
          <ul>
            <li>将今天学到的内容应用到实际生活中</li>
            <li>坚持打卡，保持学习节奏</li>
            <li>在社区中分享你的心得</li>
          </ul>
        </div>`,
        summary: '完成第1天学习，阅读15分钟，收获满满！',
        tags: ['学习反馈', '每日总结', '进步追踪'],
        status: 'completed'
      }
    ];

    const insights = await Insight.create(mockInsights);
    console.log(`✅ Created ${insights.length} AI insights`);

    console.log('\n🎉 MongoDB initialization completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Periods: ${periods.length}`);
    console.log(`   - Sections: ${sections.length}`);
    console.log(`   - Checkins: ${checkins.length}`);
    console.log(`   - Comments: ${comments.length}`);
    console.log(`   - Insights: ${insights.length}`);

  } catch (error) {
    console.error('❌ Error initializing MongoDB:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 MongoDB connection closed');
  }
}

// 运行初始化
initMongoDB();
