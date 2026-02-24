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

  // eslint-disable-next-line class-methods-use-this
  async syncUser(user) {
    if (!user || !user._id) return;

    try {
      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO users (
            id, openid, unionid, nickname, avatar, avatar_url, signature,
            gender, total_checkin_days, current_streak, max_streak,
            total_completed_periods, total_points, level, role, status,
            last_login_at, created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            openid=VALUES(openid), unionid=VALUES(unionid), nickname=VALUES(nickname),
            avatar=VALUES(avatar), avatar_url=VALUES(avatar_url), signature=VALUES(signature),
            gender=VALUES(gender), total_checkin_days=VALUES(total_checkin_days),
            current_streak=VALUES(current_streak), max_streak=VALUES(max_streak),
            total_completed_periods=VALUES(total_completed_periods), total_points=VALUES(total_points),
            level=VALUES(level), role=VALUES(role), status=VALUES(status),
            last_login_at=VALUES(last_login_at), updated_at=CURRENT_TIMESTAMP, raw_json=VALUES(raw_json)
        `;

        const params = [
          user._id.toString(),
          user.openid || null,
          user.unionid || null,
          user.nickname || null,
          user.avatar || null,
          user.avatarUrl || null,
          user.signature || null,
          user.gender || 'unknown',
          user.totalCheckinDays || 0,
          user.currentStreak || 0,
          user.maxStreak || 0,
          user.totalCompletedPeriods || 0,
          user.totalPoints || 0,
          user.level || 1,
          user.role || 'user',
          user.status || 'active',
          user.lastLoginAt || null,
          user.createdAt,
          user.updatedAt,
          JSON.stringify(user)
        ];

        await conn.query(sql, params);
      } finally {
        conn.release();
      }
    } catch (error) {
      logger.warn('MySQL backup failed: syncUser', {
        userId: user?._id,
        error: error.message
      });
    }
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
