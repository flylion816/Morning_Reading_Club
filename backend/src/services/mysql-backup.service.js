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

  // eslint-disable-next-line class-methods-use-this
  async syncAdmin(admin) {
    if (!admin || !admin._id) return;

    try {
      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO admins (
            id, name, email, password, avatar, role, permissions, status,
            last_login_at, login_count, created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name=VALUES(name), email=VALUES(email), password=VALUES(password),
            avatar=VALUES(avatar), role=VALUES(role), permissions=VALUES(permissions),
            status=VALUES(status), last_login_at=VALUES(last_login_at),
            login_count=VALUES(login_count), updated_at=CURRENT_TIMESTAMP,
            raw_json=VALUES(raw_json)
        `;

        const params = [
          admin._id.toString(),
          admin.name || null,
          admin.email || null,
          admin.password || null,
          admin.avatar || null,
          admin.role || 'operator',
          admin.permissions ? JSON.stringify(admin.permissions) : null,
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

  // eslint-disable-next-line class-methods-use-this
  async syncPeriod(period) {
    if (!period || !period._id) return;

    try {
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
            description=VALUES(description), icon=VALUES(icon),
            cover_color=VALUES(cover_color), cover_emoji=VALUES(cover_emoji),
            start_date=VALUES(start_date), end_date=VALUES(end_date),
            total_days=VALUES(total_days), price=VALUES(price),
            original_price=VALUES(original_price), max_enrollment=VALUES(max_enrollment),
            current_enrollment=VALUES(current_enrollment),
            enrollment_count=VALUES(enrollment_count), status=VALUES(status),
            is_published=VALUES(is_published), sort_order=VALUES(sort_order),
            checkin_count=VALUES(checkin_count), total_checkins=VALUES(total_checkins),
            updated_at=CURRENT_TIMESTAMP, raw_json=VALUES(raw_json)
        `;

        const params = [
          period._id.toString(),
          period.name || null,
          period.subtitle || null,
          period.title || null,
          period.description || null,
          period.icon || null,
          period.coverColor || null,
          period.coverEmoji || null,
          period.startDate || null,
          period.endDate || null,
          period.totalDays || 0,
          period.price || 0,
          period.originalPrice || null,
          period.maxEnrollment || null,
          period.currentEnrollment || 0,
          period.enrollmentCount || 0,
          period.status || 'draft',
          period.isPublished ? 1 : 0,
          period.sortOrder || null,
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

  // eslint-disable-next-line class-methods-use-this
  async syncSection(section) {
    if (!section || !section._id) return;

    try {
      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO sections (
            id, period_id, day, title, subtitle, icon, meditation, question,
            content, description, reflection, action, learn, extract, say,
            audio_url, video_cover, duration, sort_order, \`order\`,
            is_published, created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            period_id=VALUES(period_id), day=VALUES(day), title=VALUES(title),
            subtitle=VALUES(subtitle), icon=VALUES(icon), meditation=VALUES(meditation),
            question=VALUES(question), content=VALUES(content),
            description=VALUES(description), reflection=VALUES(reflection),
            action=VALUES(action), learn=VALUES(learn), extract=VALUES(extract),
            say=VALUES(say), audio_url=VALUES(audio_url),
            video_cover=VALUES(video_cover), duration=VALUES(duration),
            sort_order=VALUES(sort_order), \`order\`=VALUES(\`order\`),
            is_published=VALUES(is_published), updated_at=CURRENT_TIMESTAMP,
            raw_json=VALUES(raw_json)
        `;

        const params = [
          section._id.toString(),
          section.periodId?.toString() || null,
          section.day || null,
          section.title || null,
          section.subtitle || null,
          section.icon || null,
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
          section.sortOrder || null,
          section.order || null,
          section.isPublished ? 1 : 0,
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

  // eslint-disable-next-line class-methods-use-this
  async syncCheckin(checkin) {
    if (!checkin || !checkin._id) return;

    try {
      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO checkins (
            id, user_id, period_id, section_id, day, checkin_date,
            reading_time, completion_rate, note, images, mood, points,
            is_public, like_count, is_featured, status,
            created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            user_id=VALUES(user_id), period_id=VALUES(period_id),
            section_id=VALUES(section_id), day=VALUES(day),
            checkin_date=VALUES(checkin_date), reading_time=VALUES(reading_time),
            completion_rate=VALUES(completion_rate), note=VALUES(note),
            images=VALUES(images), mood=VALUES(mood), points=VALUES(points),
            is_public=VALUES(is_public), like_count=VALUES(like_count),
            is_featured=VALUES(is_featured), status=VALUES(status),
            updated_at=CURRENT_TIMESTAMP, raw_json=VALUES(raw_json)
        `;

        const params = [
          checkin._id.toString(),
          checkin.userId?.toString() || null,
          checkin.periodId?.toString() || null,
          checkin.sectionId?.toString() || null,
          checkin.day || null,
          checkin.checkinDate || null,
          checkin.readingTime || null,
          checkin.completionRate || null,
          checkin.note || null,
          checkin.images ? JSON.stringify(checkin.images) : null,
          checkin.mood || null,
          checkin.points || 0,
          checkin.isPublic ? 1 : 0,
          checkin.likeCount || 0,
          checkin.isFeatured ? 1 : 0,
          checkin.status || null,
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

  // eslint-disable-next-line class-methods-use-this
  async syncEnrollment(enrollment) {
    if (!enrollment || !enrollment._id) return;

    try {
      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO enrollments (
            id, user_id, period_id, enrolled_at, status, payment_status,
            payment_amount, paid_at, completed_at, withdrawn_at,
            name, gender, province, detailed_address, age, referrer,
            has_read_book, read_times, enroll_reason, expectation, commitment,
            created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            user_id=VALUES(user_id), period_id=VALUES(period_id),
            enrolled_at=VALUES(enrolled_at), status=VALUES(status),
            payment_status=VALUES(payment_status), payment_amount=VALUES(payment_amount),
            paid_at=VALUES(paid_at), completed_at=VALUES(completed_at),
            withdrawn_at=VALUES(withdrawn_at), name=VALUES(name),
            gender=VALUES(gender), province=VALUES(province),
            detailed_address=VALUES(detailed_address), age=VALUES(age),
            referrer=VALUES(referrer), has_read_book=VALUES(has_read_book),
            read_times=VALUES(read_times), enroll_reason=VALUES(enroll_reason),
            expectation=VALUES(expectation), commitment=VALUES(commitment),
            updated_at=CURRENT_TIMESTAMP, raw_json=VALUES(raw_json)
        `;

        const params = [
          enrollment._id.toString(),
          enrollment.userId?.toString() || null,
          enrollment.periodId?.toString() || null,
          enrollment.enrolledAt || null,
          enrollment.status || 'pending',
          enrollment.paymentStatus || null,
          enrollment.paymentAmount || null,
          enrollment.paidAt || null,
          enrollment.completedAt || null,
          enrollment.withdrawnAt || null,
          enrollment.name || null,
          enrollment.gender || null,
          enrollment.province || null,
          enrollment.detailedAddress || null,
          enrollment.age || null,
          enrollment.referrer || null,
          enrollment.hasReadBook ? 1 : 0,
          enrollment.readTimes || null,
          enrollment.enrollReason || null,
          enrollment.expectation || null,
          enrollment.commitment || null,
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

  // eslint-disable-next-line class-methods-use-this
  async syncPayment(payment) {
    if (!payment || !payment._id) return;

    try {
      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO payments (
            id, enrollment_id, user_id, period_id, amount, payment_method,
            status, wechat, order_no, reconciled, created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            enrollment_id=VALUES(enrollment_id), user_id=VALUES(user_id),
            period_id=VALUES(period_id), amount=VALUES(amount),
            payment_method=VALUES(payment_method), status=VALUES(status),
            wechat=VALUES(wechat), order_no=VALUES(order_no),
            reconciled=VALUES(reconciled), updated_at=CURRENT_TIMESTAMP,
            raw_json=VALUES(raw_json)
        `;

        const params = [
          payment._id.toString(),
          payment.enrollmentId?.toString() || null,
          payment.userId?.toString() || null,
          payment.periodId?.toString() || null,
          payment.amount || null,
          payment.paymentMethod || null,
          payment.status || 'pending',
          payment.wechat ? JSON.stringify(payment.wechat) : null,
          payment.orderNo || null,
          payment.reconciled ? 1 : 0,
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

  // eslint-disable-next-line class-methods-use-this
  async syncInsight(insight) {
    if (!insight || !insight._id) return;

    try {
      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO insights (
            id, user_id, target_user_id, checkin_id, period_id, section_id,
            day, type, media_type, content, image_url, summary, tags,
            status, source, is_published, likes, like_count,
            created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            user_id=VALUES(user_id), target_user_id=VALUES(target_user_id),
            checkin_id=VALUES(checkin_id), period_id=VALUES(period_id),
            section_id=VALUES(section_id), day=VALUES(day), type=VALUES(type),
            media_type=VALUES(media_type), content=VALUES(content),
            image_url=VALUES(image_url), summary=VALUES(summary),
            tags=VALUES(tags), status=VALUES(status), source=VALUES(source),
            is_published=VALUES(is_published), likes=VALUES(likes),
            like_count=VALUES(like_count), updated_at=CURRENT_TIMESTAMP,
            raw_json=VALUES(raw_json)
        `;

        const params = [
          insight._id.toString(),
          insight.userId?.toString() || null,
          insight.targetUserId?.toString() || null,
          insight.checkinId?.toString() || null,
          insight.periodId?.toString() || null,
          insight.sectionId?.toString() || null,
          insight.day || null,
          insight.type || null,
          insight.mediaType || null,
          insight.content || null,
          insight.imageUrl || null,
          insight.summary || null,
          insight.tags ? JSON.stringify(insight.tags) : null,
          insight.status || null,
          insight.source || null,
          insight.isPublished ? 1 : 0,
          insight.likes ? JSON.stringify(insight.likes) : null,
          insight.likeCount || 0,
          insight.createdAt,
          insight.updatedAt,
          JSON.stringify(insight)
        ];

        await conn.query(sql, params);
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

  // eslint-disable-next-line class-methods-use-this
  async syncInsightRequest(request) {
    if (!request || !request._id) return;

    try {
      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO insight_requests (
            id, from_user_id, to_user_id, status, reason, period_id,
            approved_at, rejected_at, revoked_at, created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            from_user_id=VALUES(from_user_id), to_user_id=VALUES(to_user_id),
            status=VALUES(status), reason=VALUES(reason), period_id=VALUES(period_id),
            approved_at=VALUES(approved_at), rejected_at=VALUES(rejected_at),
            revoked_at=VALUES(revoked_at), updated_at=CURRENT_TIMESTAMP,
            raw_json=VALUES(raw_json)
        `;

        const params = [
          request._id.toString(),
          request.fromUserId?.toString() || null,
          request.toUserId?.toString() || null,
          request.status || 'pending',
          request.reason || null,
          request.periodId?.toString() || null,
          request.approvedAt || null,
          request.rejectedAt || null,
          request.revokedAt || null,
          request.createdAt,
          request.updatedAt,
          JSON.stringify(request)
        ];

        await conn.query(sql, params);
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

  // eslint-disable-next-line class-methods-use-this
  async syncComment(comment) {
    if (!comment || !comment._id) return;

    try {
      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO comments (
            id, user_id, content, reply_to_user_id, checkin_id, reply_count,
            created_at, updated_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            user_id=VALUES(user_id), content=VALUES(content),
            reply_to_user_id=VALUES(reply_to_user_id),
            checkin_id=VALUES(checkin_id), reply_count=VALUES(reply_count),
            updated_at=CURRENT_TIMESTAMP, raw_json=VALUES(raw_json)
        `;

        const params = [
          comment._id.toString(),
          comment.userId?.toString() || null,
          comment.content || null,
          comment.replyToUserId?.toString() || null,
          comment.checkinId?.toString() || null,
          comment.replyCount || 0,
          comment.createdAt,
          comment.updatedAt,
          JSON.stringify(comment)
        ];

        await conn.query(sql, params);
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

  // eslint-disable-next-line class-methods-use-this
  async syncNotification(notification) {
    if (!notification || !notification._id) return;

    try {
      const conn = await mysqlPool.getConnection();
      try {
        const sql = `
          INSERT INTO notifications (
            id, user_id, type, title, content, request_id, sender_id,
            is_read, read_at, is_archived, archived_at, data,
            created_at, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            user_id=VALUES(user_id), type=VALUES(type), title=VALUES(title),
            content=VALUES(content), request_id=VALUES(request_id),
            sender_id=VALUES(sender_id), is_read=VALUES(is_read),
            read_at=VALUES(read_at), is_archived=VALUES(is_archived),
            archived_at=VALUES(archived_at), data=VALUES(data),
            raw_json=VALUES(raw_json)
        `;

        const params = [
          notification._id.toString(),
          notification.userId?.toString() || null,
          notification.type || null,
          notification.title || null,
          notification.content || null,
          notification.requestId || null,
          notification.senderId?.toString() || null,
          notification.isRead ? 1 : 0,
          notification.readAt || null,
          notification.isArchived ? 1 : 0,
          notification.archivedAt || null,
          notification.data ? JSON.stringify(notification.data) : null,
          notification.createdAt,
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
}

module.exports = new MysqlBackupService();
