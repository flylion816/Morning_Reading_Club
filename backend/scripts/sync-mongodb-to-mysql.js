#!/usr/bin/env node

/**
 * 同步脚本：从 MongoDB 全量同步数据到 MySQL
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { mysqlPool } = require('../src/config/database');
const logger = require('../src/utils/logger');

// 导入所有模型
const User = require('../src/models/User');
const Admin = require('../src/models/Admin');
const Period = require('../src/models/Period');
const Section = require('../src/models/Section');
const Checkin = require('../src/models/Checkin');
const Enrollment = require('../src/models/Enrollment');
const Payment = require('../src/models/Payment');
const Insight = require('../src/models/Insight');
const InsightRequest = require('../src/models/InsightRequest');
const Comment = require('../src/models/Comment');
const Notification = require('../src/models/Notification');

// 导入备份服务
const mysqlBackupService = require('../src/services/mysql-backup.service');

async function syncData() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('    🔄 MongoDB → MySQL 全量同步');
    console.log('='.repeat(70) + '\n');

    // 连接 MongoDB
    if (mongoose.connection.readyState === 0) {
      console.log('正在连接 MongoDB...');
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ MongoDB 已连接\n');
    }

    const syncResults = {};
    let totalSynced = 0;

    // 同步 users
    console.log('[1/11] 正在同步 users...');
    const users = await User.find();
    for (const user of users) {
      await mysqlBackupService.syncUser(user);
    }
    syncResults.users = users.length;
    totalSynced += users.length;
    console.log(`✅ users: ${users.length} 条\n`);

    // 同步 admins
    console.log('[2/11] 正在同步 admins...');
    const admins = await Admin.find();
    for (const admin of admins) {
      await mysqlBackupService.syncAdmin(admin);
    }
    syncResults.admins = admins.length;
    totalSynced += admins.length;
    console.log(`✅ admins: ${admins.length} 条\n`);

    // 同步 periods
    console.log('[3/11] 正在同步 periods...');
    const periods = await Period.find();
    for (const period of periods) {
      await mysqlBackupService.syncPeriod(period);
    }
    syncResults.periods = periods.length;
    totalSynced += periods.length;
    console.log(`✅ periods: ${periods.length} 条\n`);

    // 同步 sections
    console.log('[4/11] 正在同步 sections...');
    const sections = await Section.find();
    for (const section of sections) {
      await mysqlBackupService.syncSection(section);
    }
    syncResults.sections = sections.length;
    totalSynced += sections.length;
    console.log(`✅ sections: ${sections.length} 条\n`);

    // 同步 checkins
    console.log('[5/11] 正在同步 checkins...');
    const checkins = await Checkin.find();
    for (const checkin of checkins) {
      await mysqlBackupService.syncCheckin(checkin);
    }
    syncResults.checkins = checkins.length;
    totalSynced += checkins.length;
    console.log(`✅ checkins: ${checkins.length} 条\n`);

    // 同步 enrollments
    console.log('[6/11] 正在同步 enrollments...');
    const enrollments = await Enrollment.find();
    for (const enrollment of enrollments) {
      await mysqlBackupService.syncEnrollment(enrollment);
    }
    syncResults.enrollments = enrollments.length;
    totalSynced += enrollments.length;
    console.log(`✅ enrollments: ${enrollments.length} 条\n`);

    // 同步 payments
    console.log('[7/11] 正在同步 payments...');
    const payments = await Payment.find();
    for (const payment of payments) {
      await mysqlBackupService.syncPayment(payment);
    }
    syncResults.payments = payments.length;
    totalSynced += payments.length;
    console.log(`✅ payments: ${payments.length} 条\n`);

    // 同步 insights
    console.log('[8/11] 正在同步 insights...');
    const insights = await Insight.find();
    for (const insight of insights) {
      await mysqlBackupService.syncInsight(insight);
    }
    syncResults.insights = insights.length;
    totalSynced += insights.length;
    console.log(`✅ insights: ${insights.length} 条\n`);

    // 同步 insight_requests
    console.log('[9/11] 正在同步 insight_requests...');
    const insightRequests = await InsightRequest.find();
    for (const request of insightRequests) {
      await mysqlBackupService.syncInsightRequest(request);
    }
    syncResults.insight_requests = insightRequests.length;
    totalSynced += insightRequests.length;
    console.log(`✅ insight_requests: ${insightRequests.length} 条\n`);

    // 同步 comments
    console.log('[10/11] 正在同步 comments...');
    const comments = await Comment.find();
    for (const comment of comments) {
      await mysqlBackupService.syncComment(comment);
    }
    syncResults.comments = comments.length;
    totalSynced += comments.length;
    console.log(`✅ comments: ${comments.length} 条\n`);

    // 同步 notifications
    console.log('[11/11] 正在同步 notifications...');
    const notifications = await Notification.find();
    for (const notification of notifications) {
      await mysqlBackupService.syncNotification(notification);
    }
    syncResults.notifications = notifications.length;
    totalSynced += notifications.length;
    console.log(`✅ notifications: ${notifications.length} 条\n`);

    // 打印总结
    console.log('='.repeat(70));
    console.log('✅ 同步完成！');
    console.log('='.repeat(70));
    console.log('\n📊 同步详情：');
    Object.entries(syncResults).forEach(([table, count]) => {
      console.log(`   ${table}: ${count} 条`);
    });
    console.log(`\n   总计: ${totalSynced} 条数据\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 同步失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mysqlPool.end();
  }
}

// 运行同步
if (require.main === module) {
  syncData();
}

module.exports = { syncData };
