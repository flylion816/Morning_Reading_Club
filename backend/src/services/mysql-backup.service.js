/**
 * MySQL 备份服务（简化版）
 *
 * 职责：
 * - 将 MongoDB 数据异步写入 MySQL 作为热备份
 * - 对所有表使用统一的同步方法
 * - 存储完整的 raw_json，支持灵活扩展
 */

const { mysqlPool } = require('../config/database');
const logger = require('../utils/logger');

class MysqlBackupService {
  /**
   * 通用同步函数 - 对所有类型的文档适用
   * @param {string} tableName - MySQL 表名
   * @param {object} document - MongoDB 文档
   */
  // eslint-disable-next-line class-methods-use-this
  async syncDocument(tableName, document) {
    if (!document || !document._id) return;

    try {
      const conn = await mysqlPool.getConnection();
      try {
        // 统一使用简单的 UPSERT 模式：id 和 raw_json
        const sql = `
          INSERT INTO ${tableName} (id, raw_json, created_at, updated_at)
          VALUES (?, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            raw_json = VALUES(raw_json),
            updated_at = CURRENT_TIMESTAMP
        `;

        const params = [document._id.toString(), JSON.stringify(document)];

        await conn.query(sql, params);
      } finally {
        conn.release();
      }
    } catch (error) {
      logger.warn(`MySQL backup failed for ${tableName}`, {
        docId: document?._id,
        error: error.message
      });
    }
  }

  // ===================== 为每个模型提供便捷方法 =====================

  async syncUser(user) {
    return this.syncDocument('users', user);
  }

  async syncAdmin(admin) {
    return this.syncDocument('admins', admin);
  }

  async syncPeriod(period) {
    return this.syncDocument('periods', period);
  }

  async syncSection(section) {
    return this.syncDocument('sections', section);
  }

  async syncCheckin(checkin) {
    return this.syncDocument('checkins', checkin);
  }

  async syncEnrollment(enrollment) {
    return this.syncDocument('enrollments', enrollment);
  }

  async syncPayment(payment) {
    return this.syncDocument('payments', payment);
  }

  async syncInsight(insight) {
    return this.syncDocument('insights', insight);
  }

  async syncInsightRequest(request) {
    return this.syncDocument('insight_requests', request);
  }

  async syncComment(comment) {
    return this.syncDocument('comments', comment);
  }

  async syncNotification(notification) {
    return this.syncDocument('notifications', notification);
  }
}

module.exports = new MysqlBackupService();
