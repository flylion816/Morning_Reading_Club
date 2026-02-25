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

// ===================== 数据类型转换辅助函数 =====================

/**
 * 正确处理值的转换，保留 0、false、""等 falsy 值
 * @param {*} value - 要转换的值
 * @param {*} defaultValue - 默认值（当value为undefined或null时使用）
 */
function coerce(value, defaultValue = null) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return value;
}

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
          coerce(period.name),
          coerce(period.subtitle),
          coerce(period.title),
          coerce(period.description),
          coerce(period.icon),
          coerce(period.coverColor),
          coerce(period.coverEmoji),
          coerce(period.startDate),
          coerce(period.endDate),
          coerce(period.totalDays, 0),
          coerce(period.price, 0),
          coerce(period.originalPrice),
          coerce(period.maxEnrollment),
          coerce(period.currentEnrollment, 0),
          coerce(period.enrollmentCount, 0),
          coerce(period.status, 'draft'),
          period.isPublished === true ? 1 : (period.isPublished === false ? 0 : null),
          coerce(period.sortOrder),
          coerce(period.checkinCount, 0),
          coerce(period.totalCheckins, 0),
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
          coerce(section.periodId?.toString()),
          coerce(section.day),
          coerce(section.title),
          coerce(section.subtitle),
          coerce(section.icon),
          coerce(section.meditation),
          coerce(section.question),
          coerce(section.content),
          coerce(section.description),
          coerce(section.reflection),
          coerce(section.action),
          coerce(section.learn),
          coerce(section.extract),
          coerce(section.say),
          coerce(section.audioUrl),
          coerce(section.videoCover),
          coerce(section.duration),
          coerce(section.sortOrder),
          coerce(section.order),
          section.isPublished === true ? true : (section.isPublished === false ? false : null),
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
          coerce(checkin.userId?.toString()),
          coerce(checkin.periodId?.toString()),
          coerce(checkin.sectionId?.toString()),
          coerce(checkin.day),
          coerce(checkin.checkinDate),
          coerce(checkin.readingTime),
          coerce(checkin.completionRate),
          coerce(checkin.note),
          checkin.images ? JSON.stringify(checkin.images) : null,
          coerce(checkin.mood),
          coerce(checkin.points, 0),
          checkin.isPublic === true ? 1 : (checkin.isPublic === false ? 0 : null),
          coerce(checkin.likeCount, 0),
          checkin.isFeatured === true ? 1 : (checkin.isFeatured === false ? 0 : null),
          coerce(checkin.status),
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
          coerce(enrollment.userId?.toString()),
          coerce(enrollment.periodId?.toString()),
          coerce(enrollment.enrolledAt),
          coerce(enrollment.status, 'pending'),
          coerce(enrollment.paymentStatus),
          coerce(enrollment.paymentAmount),
          coerce(enrollment.paidAt),
          coerce(enrollment.completedAt),
          coerce(enrollment.withdrawnAt),
          coerce(enrollment.name),
          coerce(enrollment.gender),
          coerce(enrollment.province),
          coerce(enrollment.detailedAddress),
          coerce(enrollment.age),
          coerce(enrollment.referrer),
          enrollment.hasReadBook === true ? 1 : (enrollment.hasReadBook === false ? 0 : null),
          coerce(enrollment.readTimes),
          coerce(enrollment.enrollReason),
          coerce(enrollment.expectation),
          coerce(enrollment.commitment),
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
          coerce(payment.enrollmentId?.toString()),
          coerce(payment.userId?.toString()),
          coerce(payment.periodId?.toString()),
          coerce(payment.amount),
          coerce(payment.paymentMethod),
          coerce(payment.status, 'pending'),
          payment.wechat ? JSON.stringify(payment.wechat) : null,
          coerce(payment.orderNo),
          payment.reconciled === true ? 1 : (payment.reconciled === false ? 0 : null),
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
          coerce(insight.userId?.toString()),
          coerce(insight.targetUserId?.toString()),
          coerce(insight.checkinId?.toString()),
          coerce(insight.periodId?.toString()),
          coerce(insight.sectionId?.toString()),
          coerce(insight.day),
          coerce(insight.type),
          coerce(insight.mediaType),
          coerce(insight.content),
          coerce(insight.imageUrl),
          coerce(insight.summary),
          insight.tags ? JSON.stringify(insight.tags) : null,
          coerce(insight.status),
          coerce(insight.source),
          insight.isPublished === true ? 1 : (insight.isPublished === false ? 0 : null),
          insight.likes ? JSON.stringify(insight.likes) : null,
          coerce(insight.likeCount, 0),
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
          coerce(request.fromUserId?.toString()),
          coerce(request.toUserId?.toString()),
          coerce(request.status, 'pending'),
          coerce(request.reason),
          coerce(request.periodId?.toString()),
          coerce(request.approvedAt),
          coerce(request.rejectedAt),
          coerce(request.revokedAt),
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
          coerce(comment.userId?.toString()),
          coerce(comment.content),
          coerce(comment.replyToUserId?.toString()),
          coerce(comment.checkinId?.toString()),
          coerce(comment.replyCount, 0),
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
          coerce(notification.userId?.toString()),
          coerce(notification.type),
          coerce(notification.title),
          coerce(notification.content),
          coerce(notification.requestId),
          coerce(notification.senderId?.toString()),
          notification.isRead === true ? 1 : (notification.isRead === false ? 0 : null),
          coerce(notification.readAt),
          notification.isArchived === true ? 1 : (notification.isArchived === false ? 0 : null),
          coerce(notification.archivedAt),
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
