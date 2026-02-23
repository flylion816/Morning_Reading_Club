/**
 * MySQL 备份服务
 *
 * 职责：
 * - 将 MongoDB 数据异步写入 MySQL 作为热备份
 * - 不影响主业务性能（异步无阻塞）
 * - 处理 ObjectId <-> CHAR(24) 的转换
 * - 处理嵌套数组和子文档的拆分
 */

const { mysqlPool } = require('../config/database');
const logger = require('../utils/logger');

class MysqlBackupService {
  /**
   * 将 MongoDB 文档转为 MySQL 插入参数
   * 注意：实际调用时，调用方应该已经从 MongoDB 取到原始数据
   */

  // ===================== User =====================
  async syncUser(user) {
    try {
      if (!user || !user._id) return;

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
            total_completed_periods=VALUES(total_completed_periods),
            total_points=VALUES(total_points), level=VALUES(level), role=VALUES(role),
            status=VALUES(status), last_login_at=VALUES(last_login_at),
            updated_at=CURRENT_TIMESTAMP, raw_json=VALUES(raw_json)
        `;

        const params = [
          user._id.toString(),
          user.openid,
          user.unionid || null,
          user.nickname,
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

  // ===================== Admin =====================
  async syncAdmin(admin) {
    try {
      if (!admin || !admin._id) return;

      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO admins (
            id, name, email, avatar, role, permissions, status,
            last_login_at, login_count, created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name=VALUES(name), avatar=VALUES(avatar), role=VALUES(role),
            permissions=VALUES(permissions), status=VALUES(status),
            last_login_at=VALUES(last_login_at), login_count=VALUES(login_count),
            updated_at=CURRENT_TIMESTAMP, raw_json=VALUES(raw_json)
        `;

        const params = [
          admin._id.toString(),
          admin.name,
          admin.email,
          admin.avatar || null,
          admin.role || 'operator',
          JSON.stringify(admin.permissions || []),
          admin.status || 'active',
          admin.lastLoginAt || null,
          admin.loginCount || 0,
          admin.createdAt,
          admin.updatedAt,
          JSON.stringify(admin)
        ];

        await conn.query(sql, params);
      } finally {
        conn.release();
      }
    } catch (error) {
      logger.warn('MySQL backup failed: syncAdmin', {
        adminId: admin?._id,
        error: error.message
      });
    }
  }

  // ===================== Period =====================
  async syncPeriod(period) {
    try {
      if (!period || !period._id) return;

      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO periods (
            id, name, subtitle, title, description, icon, cover_color,
            cover_emoji, start_date, end_date, total_days, price, original_price,
            max_enrollment, current_enrollment, enrollment_count, status,
            is_published, sort_order, checkin_count, total_checkins,
            created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name=VALUES(name), subtitle=VALUES(subtitle), title=VALUES(title),
            description=VALUES(description), status=VALUES(status),
            is_published=VALUES(is_published), current_enrollment=VALUES(current_enrollment),
            checkin_count=VALUES(checkin_count), total_checkins=VALUES(total_checkins),
            updated_at=CURRENT_TIMESTAMP, raw_json=VALUES(raw_json)
        `;

        const params = [
          period._id.toString(),
          period.name,
          period.subtitle || null,
          period.title || null,
          period.description || null,
          period.icon || '📚',
          period.coverColor || null,
          period.coverEmoji || '📖',
          period.startDate,
          period.endDate,
          period.totalDays || 23,
          period.price || 0,
          period.originalPrice || 0,
          period.maxEnrollment || null,
          period.currentEnrollment || 0,
          period.enrollmentCount || 0,
          period.status || 'not_started',
          period.isPublished || false,
          period.sortOrder || 0,
          period.checkinCount || 0,
          period.totalCheckins || 0,
          period.createdAt,
          period.updatedAt,
          JSON.stringify(period)
        ];

        await conn.query(sql, params);
      } finally {
        conn.release();
      }
    } catch (error) {
      logger.warn('MySQL backup failed: syncPeriod', {
        periodId: period?._id,
        error: error.message
      });
    }
  }

  // ===================== Section =====================
  async syncSection(section) {
    try {
      if (!section || !section._id) return;

      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO sections (
            id, period_id, day, title, subtitle, icon, meditation, question,
            content, description, reflection, action, learn, extract, say,
            audio_url, video_cover, duration, sort_order, order_num,
            is_published, checkin_count, created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            title=VALUES(title), subtitle=VALUES(subtitle),
            content=VALUES(content), description=VALUES(description),
            is_published=VALUES(is_published), checkin_count=VALUES(checkin_count),
            updated_at=CURRENT_TIMESTAMP, raw_json=VALUES(raw_json)
        `;

        const params = [
          section._id.toString(),
          section.periodId.toString(),
          section.day,
          section.title,
          section.subtitle || null,
          section.icon || '📖',
          section.meditation || null,
          section.question || null,
          section.content || null,
          section.description || null,
          section.reflection || null,
          section.action || null,
          section.learn || null,
          section.extract || null,
          section.say || null,
          section.audioUrl || null,
          section.videoCover || null,
          section.duration || null,
          section.sortOrder || 0,
          section.order || 0,
          section.isPublished !== false,
          section.checkinCount || 0,
          section.createdAt,
          section.updatedAt,
          JSON.stringify(section)
        ];

        await conn.query(sql, params);
      } finally {
        conn.release();
      }
    } catch (error) {
      logger.warn('MySQL backup failed: syncSection', {
        sectionId: section?._id,
        error: error.message
      });
    }
  }

  // ===================== Checkin =====================
  async syncCheckin(checkin) {
    try {
      if (!checkin || !checkin._id) return;

      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO checkins (
            id, user_id, period_id, section_id, day, checkin_date,
            reading_time, completion_rate, note, images, mood, points,
            is_public, like_count, is_featured, created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            reading_time=VALUES(reading_time), completion_rate=VALUES(completion_rate),
            note=VALUES(note), mood=VALUES(mood), like_count=VALUES(like_count),
            updated_at=CURRENT_TIMESTAMP, raw_json=VALUES(raw_json)
        `;

        const params = [
          checkin._id.toString(),
          checkin.userId.toString(),
          checkin.periodId.toString(),
          checkin.sectionId.toString(),
          checkin.day,
          checkin.checkinDate,
          checkin.readingTime || 0,
          checkin.completionRate || 0,
          checkin.note || null,
          JSON.stringify(checkin.images || []),
          checkin.mood || null,
          checkin.points || 10,
          checkin.isPublic !== false,
          checkin.likeCount || 0,
          checkin.isFeatured || false,
          checkin.createdAt,
          checkin.updatedAt,
          JSON.stringify(checkin)
        ];

        await conn.query(sql, params);
      } finally {
        conn.release();
      }
    } catch (error) {
      logger.warn('MySQL backup failed: syncCheckin', {
        checkinId: checkin?._id,
        error: error.message
      });
    }
  }

  // ===================== Enrollment =====================
  async syncEnrollment(enrollment) {
    try {
      if (!enrollment || !enrollment._id) return;

      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO enrollments (
            id, user_id, period_id, enrolled_at, status, payment_status,
            payment_amount, paid_at, completed_at, withdrawn_at, name, gender,
            province, detailed_address, age, referrer, has_read_book, read_times,
            enroll_reason, expectation, commitment, notes, deleted,
            created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            status=VALUES(status), payment_status=VALUES(payment_status),
            payment_amount=VALUES(payment_amount), paid_at=VALUES(paid_at),
            completed_at=VALUES(completed_at), withdrawn_at=VALUES(withdrawn_at),
            deleted=VALUES(deleted), updated_at=CURRENT_TIMESTAMP, raw_json=VALUES(raw_json)
        `;

        const params = [
          enrollment._id.toString(),
          enrollment.userId.toString(),
          enrollment.periodId.toString(),
          enrollment.enrolledAt || new Date(),
          enrollment.status || 'active',
          enrollment.paymentStatus || 'free',
          enrollment.paymentAmount || 0,
          enrollment.paidAt || null,
          enrollment.completedAt || null,
          enrollment.withdrawnAt || null,
          enrollment.name || null,
          enrollment.gender || null,
          enrollment.province || null,
          enrollment.detailedAddress || null,
          enrollment.age || null,
          enrollment.referrer || null,
          enrollment.hasReadBook || null,
          enrollment.readTimes || 0,
          enrollment.enrollReason || null,
          enrollment.expectation || null,
          enrollment.commitment || null,
          enrollment.notes || null,
          enrollment.deleted || false,
          enrollment.createdAt,
          enrollment.updatedAt,
          JSON.stringify(enrollment)
        ];

        await conn.query(sql, params);
      } finally {
        conn.release();
      }
    } catch (error) {
      logger.warn('MySQL backup failed: syncEnrollment', {
        enrollmentId: enrollment?._id,
        error: error.message
      });
    }
  }

  // ===================== Payment =====================
  async syncPayment(payment) {
    try {
      if (!payment || !payment._id) return;

      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO payments (
            id, enrollment_id, user_id, period_id, amount, payment_method, status,
            wechat_prepay_id, wechat_transaction_id, wechat_success_time,
            paid_at, failure_reason, notes, order_no, reconciled, reconciled_at,
            created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            status=VALUES(status), paid_at=VALUES(paid_at),
            failure_reason=VALUES(failure_reason), reconciled=VALUES(reconciled),
            reconciled_at=VALUES(reconciled_at), updated_at=CURRENT_TIMESTAMP, raw_json=VALUES(raw_json)
        `;

        const params = [
          payment._id.toString(),
          payment.enrollmentId.toString(),
          payment.userId.toString(),
          payment.periodId.toString(),
          payment.amount,
          payment.paymentMethod || 'wechat',
          payment.status || 'pending',
          payment.wechat?.prepayId || null,
          payment.wechat?.transactionId || null,
          payment.wechat?.successTime || null,
          payment.paidAt || null,
          payment.failureReason || null,
          payment.notes || null,
          payment.orderNo,
          payment.reconciled || false,
          payment.reconciledAt || null,
          payment.createdAt,
          payment.updatedAt,
          JSON.stringify(payment)
        ];

        await conn.query(sql, params);
      } finally {
        conn.release();
      }
    } catch (error) {
      logger.warn('MySQL backup failed: syncPayment', {
        paymentId: payment?._id,
        error: error.message
      });
    }
  }

  // ===================== Insight =====================
  async syncInsight(insight) {
    try {
      if (!insight || !insight._id) return;

      const conn = await mysqlPool.getConnection();
      try {
        // 1. 主表
        const mainSql = `
          INSERT INTO insights (
            id, user_id, target_user_id, checkin_id, period_id, section_id, day,
            type, media_type, content, image_url, summary, tags, status, source,
            is_published, like_count, created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            content=VALUES(content), image_url=VALUES(image_url),
            summary=VALUES(summary), is_published=VALUES(is_published),
            like_count=VALUES(like_count), updated_at=CURRENT_TIMESTAMP, raw_json=VALUES(raw_json)
        `;

        const mainParams = [
          insight._id.toString(),
          insight.userId.toString(),
          insight.targetUserId ? insight.targetUserId.toString() : null,
          insight.checkinId ? insight.checkinId.toString() : null,
          insight.periodId.toString(),
          insight.sectionId ? insight.sectionId.toString() : null,
          insight.day || null,
          insight.type || 'daily',
          insight.mediaType || 'text',
          insight.content,
          insight.imageUrl || null,
          insight.summary || null,
          JSON.stringify(insight.tags || []),
          insight.status || 'completed',
          insight.source || 'manual',
          insight.isPublished !== false,
          insight.likeCount || 0,
          insight.createdAt,
          insight.updatedAt,
          JSON.stringify(insight)
        ];

        await conn.query(mainSql, mainParams);

        // 2. 拆分 likes 数组
        if (insight.likes && insight.likes.length > 0) {
          // 先删除旧的 likes
          await conn.query('DELETE FROM insight_likes WHERE insight_id = ?', [insight._id.toString()]);

          // 再插入新的 likes
          for (const like of insight.likes) {
            const likeSql = 'INSERT INTO insight_likes (insight_id, user_id, created_at) VALUES (?, ?, ?)';
            await conn.query(likeSql, [
              insight._id.toString(),
              like.userId.toString(),
              like.createdAt
            ]);
          }
        }
      } finally {
        conn.release();
      }
    } catch (error) {
      logger.warn('MySQL backup failed: syncInsight', {
        insightId: insight?._id,
        error: error.message
      });
    }
  }

  // ===================== InsightRequest =====================
  async syncInsightRequest(request) {
    try {
      if (!request || !request._id) return;

      const conn = await mysqlPool.getConnection();
      try {
        // 1. 主表
        const mainSql = `
          INSERT INTO insight_requests (
            id, from_user_id, to_user_id, status, reason, period_id,
            approved_at, rejected_at, revoked_at, created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            status=VALUES(status), approved_at=VALUES(approved_at),
            rejected_at=VALUES(rejected_at), revoked_at=VALUES(revoked_at),
            updated_at=CURRENT_TIMESTAMP, raw_json=VALUES(raw_json)
        `;

        const mainParams = [
          request._id.toString(),
          request.fromUserId.toString(),
          request.toUserId.toString(),
          request.status || 'pending',
          request.reason || null,
          request.periodId ? request.periodId.toString() : null,
          request.approvedAt || null,
          request.rejectedAt || null,
          request.revokedAt || null,
          request.createdAt,
          request.updatedAt,
          JSON.stringify(request)
        ];

        await conn.query(mainSql, mainParams);

        // 2. 拆分 auditLog 数组
        if (request.auditLog && request.auditLog.length > 0) {
          // 先删除旧的 auditLog
          await conn.query('DELETE FROM insight_request_audit_logs WHERE request_id = ?', [request._id.toString()]);

          // 再插入新的 auditLog
          for (const log of request.auditLog) {
            const logSql = `
              INSERT INTO insight_request_audit_logs
              (request_id, action, actor_id, actor_type, timestamp, note, reason)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            await conn.query(logSql, [
              request._id.toString(),
              log.action || null,
              log.actor ? log.actor.toString() : null,
              log.actorType || null,
              log.timestamp,
              log.note || null,
              log.reason || null
            ]);
          }
        }
      } finally {
        conn.release();
      }
    } catch (error) {
      logger.warn('MySQL backup failed: syncInsightRequest', {
        requestId: request?._id,
        error: error.message
      });
    }
  }

  // ===================== Comment =====================
  async syncComment(comment) {
    try {
      if (!comment || !comment._id) return;

      const conn = await mysqlPool.getConnection();
      try {
        // 1. 主表
        const mainSql = `
          INSERT INTO comments (
            id, checkin_id, user_id, content, reply_count, created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            content=VALUES(content), reply_count=VALUES(reply_count),
            updated_at=CURRENT_TIMESTAMP, raw_json=VALUES(raw_json)
        `;

        const mainParams = [
          comment._id.toString(),
          comment.checkinId.toString(),
          comment.userId.toString(),
          comment.content,
          comment.replyCount || 0,
          comment.createdAt,
          comment.updatedAt,
          JSON.stringify(comment)
        ];

        await conn.query(mainSql, mainParams);

        // 2. 拆分 replies 数组
        if (comment.replies && comment.replies.length > 0) {
          // 先删除旧的 replies
          await conn.query('DELETE FROM comment_replies WHERE comment_id = ?', [comment._id.toString()]);

          // 再插入新的 replies
          for (const reply of comment.replies) {
            const replySql = `
              INSERT INTO comment_replies (id, comment_id, user_id, content, reply_to_user_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
            `;
            await conn.query(replySql, [
              reply._id.toString(),
              comment._id.toString(),
              reply.userId.toString(),
              reply.content,
              reply.replyToUserId ? reply.replyToUserId.toString() : null,
              reply.createdAt
            ]);
          }
        }
      } finally {
        conn.release();
      }
    } catch (error) {
      logger.warn('MySQL backup failed: syncComment', {
        commentId: comment?._id,
        error: error.message
      });
    }
  }

  // ===================== Notification =====================
  async syncNotification(notification) {
    try {
      if (!notification || !notification._id) return;

      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO notifications (
            id, user_id, type, title, content, request_id, sender_id,
            is_read, read_at, is_archived, archived_at, data,
            created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            is_read=VALUES(is_read), read_at=VALUES(read_at),
            is_archived=VALUES(is_archived), archived_at=VALUES(archived_at),
            updated_at=CURRENT_TIMESTAMP, raw_json=VALUES(raw_json)
        `;

        const params = [
          notification._id.toString(),
          notification.userId.toString(),
          notification.type,
          notification.title,
          notification.content,
          notification.requestId ? notification.requestId.toString() : null,
          notification.senderId ? notification.senderId.toString() : null,
          notification.isRead || false,
          notification.readAt || null,
          notification.isArchived || false,
          notification.archivedAt || null,
          JSON.stringify(notification.data || {}),
          notification.createdAt,
          notification.updatedAt,
          JSON.stringify(notification)
        ];

        await conn.query(sql, params);
      } finally {
        conn.release();
      }
    } catch (error) {
      logger.warn('MySQL backup failed: syncNotification', {
        notificationId: notification?._id,
        error: error.message
      });
    }
  }

  // ===================== 删除操作 =====================
  async deleteRecord(table, mongoId) {
    try {
      const conn = await mysqlPool.getConnection();
      try {
        const sql = `DELETE FROM ${table} WHERE id = ?`;
        await conn.query(sql, [mongoId.toString()]);
      } finally {
        conn.release();
      }
    } catch (error) {
      logger.warn('MySQL backup failed: deleteRecord', {
        table,
        mongoId,
        error: error.message
      });
    }
  }
}

// 导出单例
module.exports = new MysqlBackupService();
