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
const {
  buildSyncReferenceContext,
  filterDocumentsForMysqlSync
} = require('../src/services/mongo-mysql-sync-filter.service');

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
    const skippedResults = {};
    let totalSynced = 0;
    const syncContext = await buildSyncReferenceContext();

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
    const admins = await Admin.find().select('+password');
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
    const sectionBatch = filterDocumentsForMysqlSync('sections', sections, syncContext);
    for (const section of sectionBatch.syncableDocs) {
      await mysqlBackupService.syncSection(section);
    }
    syncResults.sections = sectionBatch.syncableDocs.length;
    skippedResults.sections = sectionBatch.skippedDocs.length;
    totalSynced += sectionBatch.syncableDocs.length;
    console.log(`✅ sections: ${sectionBatch.syncableDocs.length} 条`);
    if (sectionBatch.skippedDocs.length) {
      console.log(`⚠️  sections 跳过: ${sectionBatch.skippedDocs.length} 条\n`);
    } else {
      console.log('');
    }

    // 同步 checkins
    console.log('[5/11] 正在同步 checkins...');
    const checkins = await Checkin.find();
    const checkinBatch = filterDocumentsForMysqlSync('checkins', checkins, syncContext);
    for (const checkin of checkinBatch.syncableDocs) {
      await mysqlBackupService.syncCheckin(checkin);
    }
    syncResults.checkins = checkinBatch.syncableDocs.length;
    skippedResults.checkins = checkinBatch.skippedDocs.length;
    totalSynced += checkinBatch.syncableDocs.length;
    console.log(`✅ checkins: ${checkinBatch.syncableDocs.length} 条`);
    if (checkinBatch.skippedDocs.length) {
      console.log(`⚠️  checkins 跳过: ${checkinBatch.skippedDocs.length} 条\n`);
    } else {
      console.log('');
    }

    // 同步 enrollments
    console.log('[6/11] 正在同步 enrollments...');
    const enrollments = await Enrollment.find();
    const enrollmentBatch = filterDocumentsForMysqlSync('enrollments', enrollments, syncContext);
    for (const enrollment of enrollmentBatch.syncableDocs) {
      await mysqlBackupService.syncEnrollment(enrollment);
    }
    syncResults.enrollments = enrollmentBatch.syncableDocs.length;
    skippedResults.enrollments = enrollmentBatch.skippedDocs.length;
    totalSynced += enrollmentBatch.syncableDocs.length;
    console.log(`✅ enrollments: ${enrollmentBatch.syncableDocs.length} 条`);
    if (enrollmentBatch.skippedDocs.length) {
      console.log(`⚠️  enrollments 跳过: ${enrollmentBatch.skippedDocs.length} 条\n`);
    } else {
      console.log('');
    }

    // 同步 payments
    console.log('[7/11] 正在同步 payments...');
    const payments = await Payment.find();
    const paymentBatch = filterDocumentsForMysqlSync('payments', payments, syncContext);
    for (const payment of paymentBatch.syncableDocs) {
      await mysqlBackupService.syncPayment(payment);
    }
    syncResults.payments = paymentBatch.syncableDocs.length;
    skippedResults.payments = paymentBatch.skippedDocs.length;
    totalSynced += paymentBatch.syncableDocs.length;
    console.log(`✅ payments: ${paymentBatch.syncableDocs.length} 条`);
    if (paymentBatch.skippedDocs.length) {
      console.log(`⚠️  payments 跳过: ${paymentBatch.skippedDocs.length} 条\n`);
    } else {
      console.log('');
    }

    // 同步 insights
    console.log('[8/11] 正在同步 insights...');
    const insights = await Insight.find();
    const insightBatch = filterDocumentsForMysqlSync('insights', insights, syncContext);
    for (const insight of insightBatch.syncableDocs) {
      await mysqlBackupService.syncInsight(insight);
    }
    syncResults.insights = insightBatch.syncableDocs.length;
    skippedResults.insights = insightBatch.skippedDocs.length;
    totalSynced += insightBatch.syncableDocs.length;
    console.log(`✅ insights: ${insightBatch.syncableDocs.length} 条`);
    if (insightBatch.skippedDocs.length) {
      console.log(`⚠️  insights 跳过: ${insightBatch.skippedDocs.length} 条\n`);
    } else {
      console.log('');
    }

    // 同步 insight_requests
    console.log('[9/11] 正在同步 insight_requests...');
    const insightRequests = await InsightRequest.find();
    const requestBatch = filterDocumentsForMysqlSync('insight_requests', insightRequests, syncContext);
    for (const request of requestBatch.syncableDocs) {
      await mysqlBackupService.syncInsightRequest(request);
    }
    syncResults.insight_requests = requestBatch.syncableDocs.length;
    skippedResults.insight_requests = requestBatch.skippedDocs.length;
    totalSynced += requestBatch.syncableDocs.length;
    console.log(`✅ insight_requests: ${requestBatch.syncableDocs.length} 条`);
    if (requestBatch.skippedDocs.length) {
      console.log(`⚠️  insight_requests 跳过: ${requestBatch.skippedDocs.length} 条\n`);
    } else {
      console.log('');
    }

    // 同步 comments
    console.log('[10/11] 正在同步 comments...');
    const comments = await Comment.find();
    const commentBatch = filterDocumentsForMysqlSync('comments', comments, syncContext);
    for (const comment of commentBatch.syncableDocs) {
      await mysqlBackupService.syncComment(comment);
    }
    syncResults.comments = commentBatch.syncableDocs.length;
    skippedResults.comments = commentBatch.skippedDocs.length;
    totalSynced += commentBatch.syncableDocs.length;
    console.log(`✅ comments: ${commentBatch.syncableDocs.length} 条`);
    if (commentBatch.skippedDocs.length) {
      console.log(`⚠️  comments 跳过: ${commentBatch.skippedDocs.length} 条\n`);
    } else {
      console.log('');
    }

    // 同步 notifications
    console.log('[11/11] 正在同步 notifications...');
    const notifications = await Notification.find();
    const notificationBatch = filterDocumentsForMysqlSync(
      'notifications',
      notifications,
      syncContext
    );
    for (const notification of notificationBatch.syncableDocs) {
      await mysqlBackupService.syncNotification(notification);
    }
    syncResults.notifications = notificationBatch.syncableDocs.length;
    skippedResults.notifications = notificationBatch.skippedDocs.length;
    totalSynced += notificationBatch.syncableDocs.length;
    console.log(`✅ notifications: ${notificationBatch.syncableDocs.length} 条`);
    if (notificationBatch.skippedDocs.length) {
      console.log(`⚠️  notifications 跳过: ${notificationBatch.skippedDocs.length} 条\n`);
    } else {
      console.log('');
    }

    // 打印总结
    console.log('='.repeat(70));
    console.log('✅ 同步完成！');
    console.log('='.repeat(70));
    console.log('\n📊 同步详情：');
    Object.entries(syncResults).forEach(([table, count]) => {
      console.log(`   ${table}: ${count} 条`);
    });
    const skippedEntries = Object.entries(skippedResults).filter(([, count]) => count > 0);
    if (skippedEntries.length > 0) {
      console.log('\n   跳过：');
      skippedEntries.forEach(([table, count]) => {
        console.log(`   ${table}: ${count} 条`);
      });
    }
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
