/**
 * 清理孤立文档脚本
 * 删除引用不存在的关联记录的文档
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
require('dotenv').config();

const logger = require('../src/utils/logger');

// 导入模型
const User = require('../src/models/User');
const Insight = require('../src/models/Insight');
const Notification = require('../src/models/Notification');
const InsightRequest = require('../src/models/InsightRequest');

async function cleanupOrphanDocuments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info('开始清理孤立文档...');

    // 1. 清理孤立 insights（userId 不存在）
    logger.info('扫描孤立 insights 文档...');
    const insights = await Insight.find().select('_id userId');
    let orphanInsightsCount = 0;

    for (const insight of insights) {
      if (insight.userId) {
        const user = await User.findById(insight.userId);
        if (!user) {
          await Insight.deleteOne({ _id: insight._id });
          orphanInsightsCount++;
          logger.warn(`删除孤立 insight: ${insight._id}, userId: ${insight.userId}`);
        }
      }
    }

    logger.info(`已删除 ${orphanInsightsCount} 个孤立 insights 文档`);

    // 2. 清理孤立 notifications（requestId 或 insightRequestId 不存在）
    logger.info('扫描孤立 notifications 文档...');
    const notifications = await Notification.find().select('_id data');
    let orphanNotificationsCount = 0;

    for (const notification of notifications) {
      let isOrphan = false;

      // 检查 requestId
      if (notification.data?.requestId) {
        const request = await InsightRequest.findById(notification.data.requestId);
        if (!request) {
          isOrphan = true;
          logger.warn(`孤立 notification: ${notification._id}, requestId: ${notification.data.requestId} 不存在`);
        }
      }

      // 检查 insightRequestId
      if (!isOrphan && notification.data?.insightRequestId) {
        const insightRequest = await InsightRequest.findById(notification.data.insightRequestId);
        if (!insightRequest) {
          isOrphan = true;
          logger.warn(`孤立 notification: ${notification._id}, insightRequestId: ${notification.data.insightRequestId} 不存在`);
        }
      }

      if (isOrphan) {
        await Notification.deleteOne({ _id: notification._id });
        orphanNotificationsCount++;
      }
    }

    logger.info(`已删除 ${orphanNotificationsCount} 个孤立 notifications 文档`);

    // 3. 生成清理报告
    const report = {
      timestamp: new Date().toISOString(),
      orphanInsights: orphanInsightsCount,
      orphanNotifications: orphanNotificationsCount,
      totalCleaned: orphanInsightsCount + orphanNotificationsCount,
    };

    logger.info(`\n清理完成！\n${JSON.stringify(report, null, 2)}`);
    console.log('\n✅ 清理报告:');
    console.log(`   孤立 insights: ${orphanInsightsCount}`);
    console.log(`   孤立 notifications: ${orphanNotificationsCount}`);
    console.log(`   总计清理: ${report.totalCleaned} 个文档\n`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    logger.error('清理孤立文档失败:', error);
    console.error('\n❌ 错误:', error.message);
    process.exit(1);
  }
}

// 运行清理
cleanupOrphanDocuments();
