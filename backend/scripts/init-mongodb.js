#!/usr/bin/env node

/**
 * ⚠️ MongoDB 数据库初始化脚本
 *
 * 警告：此脚本会完全删除数据库中的所有数据并重新初始化！
 *
 * 使用场景：
 * - 本地开发环境：创建测试数据和演示环境
 * - 测试环境：重置测试数据
 *
 * ❌ 禁用场景：
 * - 生产环境：绝对禁止运行此脚本
 *
 * 历史教训（2025-12-03）：
 * 一次误执行导致丢失 90+ 天的真实用户数据和业务数据。
 *
 * 使用方法：
 * $ NODE_ENV=development node backend/scripts/init-mongodb.js
 */

const path = require('path');

// 先加载 .env 文件（获取真实的 NODE_ENV 值，用于初始化脚本的安全检查）
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 环境保护检查：禁止在生产环境运行（使用 .env 中的真实值，不覆盖）
if (process.env.NODE_ENV === 'production') {
  console.error('\n╔════════════════════════════════════════════════════════╗');
  console.error('║                   🚫 致命错误                         ║');
  console.error('╚════════════════════════════════════════════════════════╝\n');
  console.error('❌ 此脚本禁止在生产环境运行！\n');
  console.error('原因：此脚本会删除数据库中的所有数据。');
  console.error('      在生产环境执行会导致不可恢复的数据丧失。\n');
  console.error('允许的环境：development 或 test\n');
  console.error('如需在生产环境初始化数据，请联系数据库管理员。\n');
  process.exit(1);
}

// 增强的警告提示
if (process.env.NODE_ENV !== 'test') {
  console.warn('\n╔════════════════════════════════════════════════════════╗');
  console.warn('║             ⚠️ 重要警告：即将删除所有数据！             ║');
  console.warn('╚════════════════════════════════════════════════════════╝\n');
  console.warn('此脚本将：');
  console.warn('  1. 删除数据库中的所有用户数据');
  console.warn('  2. 删除所有期次、课程、打卡记录');
  console.warn('  3. 删除所有评论和小凡看见');
  console.warn('\n请确保：');
  console.warn('  ✓ 你在开发环境（NODE_ENV=development 或 test）');
  console.warn('  ✓ 本地数据库中没有重要数据');
  console.warn('  ✓ 你知道这个操作的后果\n');
  console.warn('继续执行...\n');
}

// 加载 .env.config.js 获取数据库连接信息（只在通过环境检查后才使用）
try {
  const envConfigPath = path.resolve(__dirname, '../../.env.config.js');
  const envConfig = require(envConfigPath);
  // 在 development 模式下，强制使用 .env.config.js 中的 dev 配置
  // （因为 .env 中可能是生产配置或有错误的凭证）
  if (process.env.NODE_ENV === 'development') {
    process.env.MONGODB_URI = envConfig.config.backend.mongodbUri;
  } else if (!process.env.MONGODB_URI) {
    // 其他环境下，只在 .env 中没有时才使用
    process.env.MONGODB_URI = envConfig.config.backend.mongodbUri;
  }
} catch (error) {
  // 如果找不到 .env.config.js，继续使用 .env 中的值
  console.warn('⚠️  无法加载 .env.config.js，使用 .env 中的配置');
}

const mongoose = require('mongoose');

// 导入模型
const User = require('../src/models/User');
const Period = require('../src/models/Period');
const Section = require('../src/models/Section');
const Checkin = require('../src/models/Checkin');
const Comment = require('../src/models/Comment');
const Insight = require('../src/models/Insight');
const Enrollment = require('../src/models/Enrollment');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_reading_db';

async function initMongoDB() {
  let connection = null;

  try {
    console.log('🔄 连接 MongoDB...');
    console.log('📍 连接字符串:', MONGODB_URI.replace(/:[\w!@#$%^&*()_+-=]*@/, ':****@'));
    connection = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      authSource: 'admin',
      retryWrites: false
    });
    console.log('✅ MongoDB 连接成功\n');

    // 清空数据库
    console.log('🧹 清空现有数据...');
    try {
      await Promise.all([
        User.deleteMany({}),
        Period.deleteMany({}),
        Section.deleteMany({}),
        Checkin.deleteMany({}),
        Comment.deleteMany({}),
        Insight.deleteMany({}),
        Enrollment.deleteMany({})
      ]);
      console.log('✅ 数据已清空\n');
    } catch (err) {
      if (err.message.includes('requires authentication')) {
        console.log('⚠️  跳过清空步骤（认证错误），将继续插入新数据\n');
      } else {
        throw err;
      }
    }

    // 创建用户
    console.log('👥 创建用户...');
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
        signature: '在每一次看见中不住相，在每一次倾听中生慈悲',
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

    const users = await User.insertMany(mockUsers, { ordered: false }).catch(err => {
      // insertMany with ordered: false 会继续插入即使某些失败
      // 验证创建成功的用户数
      if (err.insertedDocs) {
        console.log(`⚠️  部分用户创建失败，已创建 ${err.insertedDocs.length} 个用户`);
        return err.insertedDocs;
      }
      throw err;
    });
    console.log(`✅ 创建 ${users.length} 个用户\n`);

    // 创建期次
    console.log('📚 创建期次...');
    const mockPeriods = [
      {
        name: '平衡之道',
        subtitle: '七个习惯晨读营',
        title: '平衡之道 - 七个习惯晨读营',
        description: '21天养成阅读习惯，培养品德成功论思维',
        icon: '⛰️',
        coverColor: 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)',
        coverEmoji: '⛰️',
        startDate: new Date('2025-11-28'),
        endDate: new Date('2025-12-20'),
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
        name: '勇敢的心',
        subtitle: '七个习惯晨读营',
        title: '勇敢的心 - 七个习惯晨读营',
        description: '21天养成阅读习惯，培养品德成功论思维',
        icon: '💪',
        coverColor: 'linear-gradient(135deg, #ff6b6b 0%, #e63946 100%)',
        coverEmoji: '💪',
        startDate: new Date('2025-10-11'),
        endDate: new Date('2025-11-13'),
        totalDays: 23,
        price: 99,
        originalPrice: 199,
        maxEnrollment: 100,
        currentEnrollment: 35,
        status: 'ongoing',
        isPublished: true,
        sortOrder: 2
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
        sortOrder: 3
      },
      {
        name: '静心之镜',
        subtitle: '七个习惯晨读营',
        title: '静心之镜 - 七个习惯晨读营',
        description: '深层心灵成长之旅',
        icon: '🪞',
        coverColor: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
        coverEmoji: '🪞',
        startDate: new Date('2025-06-01'),
        endDate: new Date('2025-07-04'),
        totalDays: 23,
        price: 99,
        originalPrice: 199,
        maxEnrollment: 100,
        currentEnrollment: 42,
        status: 'completed',
        isPublished: true,
        sortOrder: 4
      }
    ];

    const periods = await Period.insertMany(mockPeriods);
    console.log(`✅ 创建 ${periods.length} 个期次\n`);

    // 创建课程（为第一个期次创建基础课程框架）
    const period1 = periods[0];
    console.log(`📖 为期次 "${period1.name}" 创建课程框架...\n`);

    const mockSections = [];
    for (let day = 0; day < 5; day++) {
      mockSections.push({
        periodId: period1._id,
        day: day,
        title: `第 ${day} 天课程`,
        subtitle: `Day ${day}`,
        icon: '📖',
        description: `这是${period1.name}的第 ${day} 天课程`,
        content: '<p>课程内容待导入...</p>',
        isPublished: true,
        checkinCount: 0,
        sortOrder: day
      });
    }

    const sections = await Section.insertMany(mockSections);
    console.log(`✅ 创建 ${sections.length} 个课程\n`);

    // 为第一个期次创建报名
    console.log('📝 创建报名记录...');
    const enrollment = await Enrollment.create({
      userId: users[1]._id,
      periodId: period1._id,
      enrollmentDate: new Date(),
      approvalStatus: 'approved',
      approvalDate: new Date(),
      source: 'init',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`✅ 创建报名记录\n`);

    // 创建打卡记录
    console.log('✅ 创建打卡记录...');
    const mockCheckins = [];
    for (let i = 0; i < 3; i++) {
      mockCheckins.push({
        userId: users[1]._id,
        periodId: period1._id,
        sectionId: sections[i]._id,
        day: i,
        checkinDate: new Date(Date.now() - i * 86400000),
        readingTime: 20 + Math.random() * 30,
        completionRate: 100,
        note: `第 ${i} 天的打卡记录`,
        mood: ['happy', 'calm', 'thoughtful'][i],
        points: 10,
        isPublic: true
      });
    }

    const checkins = await Checkin.insertMany(mockCheckins);
    console.log(`✅ 创建 ${checkins.length} 个打卡记录\n`);

    // 更新课程的打卡计数
    for (let i = 0; i < checkins.length; i++) {
      await Section.updateOne({ _id: sections[i]._id }, { $inc: { checkinCount: 1 } });
    }
    console.log('✅ 更新课程打卡计数\n');

    // 创建评论
    console.log('💬 创建评论...');
    const mockComments = [];
    if (checkins.length > 0) {
      mockComments.push({
        checkinId: checkins[0]._id,
        userId: users[2]._id,
        content: '很棒的思考！',
        replyCount: 0,
        replies: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    if (mockComments.length > 0) {
      const comments = await Comment.insertMany(mockComments);
      console.log(`✅ 创建 ${comments.length} 个评论\n`);
    }

    // 创建 Insights
    console.log('🤖 创建小凡看见...');
    const mockInsights = [];
    if (checkins.length > 0) {
      mockInsights.push({
        userId: users[1]._id,
        checkinId: checkins[0]._id,
        periodId: period1._id,
        sectionId: sections[0]._id,
        day: 0,
        type: 'daily',
        content: '这是一条小凡的看见...',
        preview: '这是一条小凡的看见...',
        typeConfig: {
          color: '#4a90e2',
          bgColor: 'rgba(74, 144, 226, 0.1)',
          icon: '✨'
        },
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    if (mockInsights.length > 0) {
      const insights = await Insight.insertMany(mockInsights);
      console.log(`✅ 创建 ${insights.length} 个小凡看见\n`);
    }

    // 最终统计
    console.log('🎉 MongoDB 初始化完成！\n');
    console.log('📊 数据统计：');
    console.log(`   - 用户: ${users.length}`);
    console.log(`   - 期次: ${periods.length}`);
    console.log(`   - 课程: ${sections.length}`);
    console.log(`   - 报名: 1`);
    console.log(`   - 打卡: ${checkins.length}`);
    console.log(`   - 评论: ${mockComments.length}`);
    console.log(`   - 小凡看见: ${mockInsights.length}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ MongoDB 初始化失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await mongoose.disconnect();
    }
  }
}

// 运行初始化
initMongoDB();
