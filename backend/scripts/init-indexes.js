#!/usr/bin/env node

/**
 * 创建数据库索引
 *
 * 用途：为所有集合创建必要的索引，提升查询性能
 *
 * 使用方法：
 *   node backend/scripts/init-indexes.js
 */

const mongoose = require('mongoose');
const path = require('path');

const envFile =
  process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '../.env.production')
    : path.join(__dirname, '../.env');
require('dotenv').config({ path: envFile });

// 导入模型
const AdminUser = require('../src/models/Admin');
const User = require('../src/models/User');
const Period = require('../src/models/Period');
const Section = require('../src/models/Section');
const Insight = require('../src/models/Insight');
const InsightRequest = require('../src/models/InsightRequest');
const Checkin = require('../src/models/Checkin');
const Comment = require('../src/models/Comment');
const AuditLog = require('../src/models/AuditLog');
const Enrollment = require('../src/models/Enrollment');
const Payment = require('../src/models/Payment');
const Notification = require('../src/models/Notification');
const Imprint = require('../src/models/Imprint');
const ImprintReaction = require('../src/models/ImprintReaction');
const ImprintComment = require('../src/models/ImprintComment');
const ImprintActivityType = require('../src/models/ImprintActivityType');
const CommunityActivity = require('../src/models/CommunityActivity');
const ActivityRegistration = require('../src/models/ActivityRegistration');
const SubscribeMessageGrant = require('../src/models/SubscribeMessageGrant');
const SubscribeMessageDelivery = require('../src/models/SubscribeMessageDelivery');
const UserActivity = require('../src/models/UserActivity');
const UserReadingCompletion = require('../src/models/UserReadingCompletion');
const CheckinCelebrationConfig = require('../src/models/CheckinCelebrationConfig');
const Tenant = require('../src/models/Tenant');
const InsightDanmaku = require('../src/models/InsightDanmaku');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_reading_db';

async function createIndexes() {
  let connection = null;

  try {
    console.log('\n' + '='.repeat(60));
    console.log('    📇 创建数据库索引');
    console.log('='.repeat(60) + '\n');

    console.log('🔗 连接 MongoDB...');
    console.log('📍 连接字符串:', MONGODB_URI.replace(/:[\w!@#$%^&*()_+-=]*@/, ':****@'));

    connection = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      authSource: 'admin',
      retryWrites: false
    });
    console.log('✅ MongoDB 连接成功\n');

    console.log('📇 创建索引...');
    const models = [
      AdminUser, User, Period, Section, Insight, InsightRequest, Checkin, Comment, AuditLog,
      Enrollment, Payment, Notification, Imprint, ImprintReaction, ImprintComment,
      ImprintActivityType, CommunityActivity, ActivityRegistration,
      SubscribeMessageGrant, SubscribeMessageDelivery, UserActivity,
      UserReadingCompletion, CheckinCelebrationConfig, Tenant, InsightDanmaku
    ];
    let totalIndexCount = 0;

    for (const model of models) {
      try {
        // 主动同步索引：确保模型定义中的所有索引都被创建
        await model.syncIndexes();

        // 获取所有现有索引
        const indexes = await model.collection.getIndexes();
        const indexNames = Object.keys(indexes);
        totalIndexCount += indexNames.length;
        console.log(`  ✓ ${model.modelName}: ${indexNames.length} 个索引`);

        // 详细输出每个索引（开发环境用于调试）
        if (process.env.NODE_ENV !== 'production') {
          indexNames.forEach(name => {
            const spec = indexes[name];
            console.log(`      - ${name}: ${JSON.stringify(spec.key)}`);
          });
        }
      } catch (err) {
        console.warn(`  ⚠ ${model.modelName}: ${err.message}`);
      }
    }

    console.log(`\n✅ 索引创建/同步完成 (共 ${totalIndexCount} 个索引)\n`);

    console.log('='.repeat(60));
    console.log('    ✅ 索引创建完成！');
    console.log('='.repeat(60) + '\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ 索引创建失败:', err.message);
    try {
      if (connection) await mongoose.connection.close();
    } catch (e) {
      // 忽略关闭连接时的错误
    }
    process.exit(1);
  }
}

// 运行索引创建
if (require.main === module) {
  createIndexes();
}

module.exports = { createIndexes };
