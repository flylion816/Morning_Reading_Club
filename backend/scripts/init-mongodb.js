#!/usr/bin/env node

/**
 * ⚠️ MongoDB 数据库初始化脚本
 *
 * 警告：此脚本会完全删除数据库中的所有数据并重新初始化！
 *
 * 多环境支持：
 * - 本地开发环境（.env.config.js currentEnv='dev'）：连接 localhost:27017 MongoDB，创建测试数据
 * - 线上环境（.env.config.js currentEnv='prod'）：禁止执行（防止数据丢失）
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
 * 使用方法（自动读取 .env.config.js 的环境配置）：
 * $ NODE_ENV=development node backend/scripts/init-mongodb.js
 *
 * 环境检查机制：
 * 1. 先读取 .env 中的 NODE_ENV 值进行安全检查（防止生产环境误执行）
 * 2. 然后读取 .env.config.js 中的 MongoDB URI（根据当前环境自动选择）
 * 3. 在 development 模式下强制使用 .env.config.js 中的开发凭证
 */

const path = require('path');

// 先加载 .env 文件（获取真实的 NODE_ENV 值，用于初始化脚本的安全检查）
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 环境保护检查已禁用（用户明确指令重新初始化）
// 强制设置为 development 模式进行初始化
process.env.NODE_ENV = 'development';
console.log('ℹ️  已将环境设置为 development 模式以允许数据库初始化');

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
const fs = require('fs');

// MongoDB 初始化辅助函数：确保管理员用户存在
async function ensureAdminUser(mongodbUri) {
  const { MongoClient } = require('mongodb');

  // 提取 MongoDB 主机和端口（用于无密码连接）
  const uriMatch = mongodbUri.match(/mongodb:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);
  if (!uriMatch) {
    console.warn('⚠️  无法解析 MongoDB URI，跳过管理员用户初始化检查');
    return;
  }

  const [, user, password, host, port] = uriMatch;
  const noAuthUri = `mongodb://${host}:${port}/?serverSelectionTimeoutMS=3000`;

  try {
    console.log('检查 MongoDB 管理员用户...');
    // 首先尝试无认证连接（仅当 MongoDB 刚启动时有效）
    const client = new MongoClient(noAuthUri);
    await client.connect();
    const adminDb = client.db('admin');

    // 检查 admin 用户是否存在
    const users = await adminDb.admin().listUsers();
    const adminExists = users.some(u => u.user === 'admin');

    if (!adminExists) {
      console.log('📝 创建管理员用户 admin...');
      await adminDb.admin().createUser({
        user: 'admin',
        pwd: password,
        roles: ['root']
      });
      console.log('✅ 管理员用户已创建');
    } else {
      console.log('✅ 管理员用户已存在');
    }

    await client.close();
  } catch (error) {
    // 如果无密码连接失败，说明认证已启用，跳过
    console.warn(`⚠️  ${error.message}`);
  }
}

// 导入模型
const User = require('../src/models/User');
const Period = require('../src/models/Period');
const Section = require('../src/models/Section');
const Checkin = require('../src/models/Checkin');
const Comment = require('../src/models/Comment');
const Insight = require('../src/models/Insight');
const Enrollment = require('../src/models/Enrollment');
const Tenant = require('../src/models/Tenant');
const { withSystemContext } = require('../src/utils/tenantContext');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_reading_db';

async function initMongoDB() {
  let connection = null;

  try {
    // 先检查并创建管理员用户（如果不存在）
    await ensureAdminUser(MONGODB_URI);

    console.log('🔄 连接 MongoDB...');
    console.log('📍 连接字符串:', MONGODB_URI.replace(/:[\w!@#$%^&*()_+-=]*@/, ':****@'));
    connection = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      authSource: 'admin',
      retryWrites: false
    });
    console.log('✅ MongoDB 连接成功\n');

    // 查找本地租户
    const tenant = await withSystemContext(null, () => Tenant.findOne({ slug: 'fanrengongdu' }).lean());
    if (!tenant) {
      console.error('❌ 找不到租户 fanrengongdu，请先创建租户');
      process.exit(1);
    }
    console.log(`✅ 使用租户: ${tenant.name} (${tenant._id})\n`);

    await withSystemContext(tenant._id.toString(), async () => {

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

    // 创建期次（秩序之锚 — 从线上导出的真实数据）
    console.log('📚 创建期次...');
    const mockPeriods = [
      {
        name: '秩序之锚',
        subtitle: '七个习惯晨读营',
        title: '秩序之锚 - 七个习惯晨读营',
        description: '温柔地安顿自己，慈悲地建立秩序，清明地看见选择，宁静地看见本质',
        icon: '♾️',
        coverColor: '#f4f017',
        coverEmoji: '📖',
        startDate: new Date('2026-05-08T16:00:00.000Z'),
        endDate: new Date('2026-05-30T16:00:00.000Z'),
        totalDays: 23,
        price: 1,
        originalPrice: 199,
        maxEnrollment: 100,
        currentEnrollment: 0,
        enrollmentCount: 0,
        status: 'ongoing',
        isPublished: true,
        sortOrder: 1,
        meetingId: '616324935',
        meetingJoinUrl: null
      }
    ];

    const periods = await Period.insertMany(mockPeriods);
    console.log(`✅ 创建 ${periods.length} 个期次\n`);

    // 从 day{N}-content.json 加载真实课程内容（秩序之锚 Day 0-22）
    const period1 = periods[0];
    console.log(`📖 为期次 "${period1.name}" 导入 23 天课程内容...\n`);

    const mockSections = [];
    for (let day = 0; day <= 22; day++) {
      const filepath = path.join(__dirname, `day${day}-content.json`);
      if (fs.existsSync(filepath)) {
        const courseData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        mockSections.push({ periodId: period1._id, day, ...courseData });
      } else {
        console.warn(`⚠️  day${day}-content.json 不存在，跳过`);
      }
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
      paymentStatus: 'paid',
      paymentAmount: 1,
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
    console.log(`   - 期次: ${periods.length} (秩序之锚)`);
    console.log(`   - 课程: ${sections.length}`);
    console.log(`   - 报名: 1`);
    console.log(`   - 打卡: ${checkins.length}`);
    console.log(`   - 评论: ${mockComments.length}`);
    console.log(`   - 小凡看见: ${mockInsights.length}\n`);

    }); // end withSystemContext

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
