const Notification = require('../models/Notification');
const User = require('../models/User');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { publishSyncEvent } = require('../services/sync.service');

/**
 * 获取用户的通知列表
 */
async function getUserNotifications(req, res, next) {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20, isRead } = req.query;

    // 构建查询条件
    const query = { userId };
    if (isRead !== undefined && isRead !== 'all') {
      query.isRead = isRead === 'true';
    }

    // 计算分页
    const skip = (page - 1) * limit;

    // 查询总数
    const total = await Notification.countDocuments(query);

    // 查询通知，populate相关用户信息
    const notifications = await Notification.find(query)
      .populate('senderId', 'nickname avatar')
      .populate('requestId', 'status fromUserId toUserId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json(
      success(
        {
          notifications,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit)
          }
        },
        '获取成功'
      )
    );
  } catch (error) {
    next(error);
  }
}

/**
 * 获取未读通知数量
 */
async function getUnreadCount(req, res, next) {
  try {
    const userId = req.user.userId;

    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false
    });

    res.json(
      success(
        {
          unreadCount
        },
        '获取成功'
      )
    );
  } catch (error) {
    next(error);
  }
}

/**
 * 标记通知为已读
 */
async function markNotificationAsRead(req, res, next) {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    // 查找通知
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json(errors.notFound('通知不存在'));
    }

    // 验证用户是否是通知接收者
    if (notification.userId.toString() !== userId) {
      return res.status(403).json(errors.forbidden('无权操作'));
    }

    // 标记为已读
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'update',
      collection: 'notifications',
      documentId: notification._id.toString(),
      data: notification.toObject()
    });

    res.json(success(notification, '已标记为已读'));
  } catch (error) {
    next(error);
  }
}

/**
 * 标记所有通知为已读
 */
async function markAllAsRead(req, res, next) {
  try {
    const userId = req.user.userId;

    // 更新所有未读通知
    const result = await Notification.updateMany(
      { userId, isRead: false },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    res.json(
      success(
        {
          modifiedCount: result.modifiedCount
        },
        `已标记 ${result.modifiedCount} 条通知为已读`
      )
    );
  } catch (error) {
    next(error);
  }
}

/**
 * 删除通知
 */
async function deleteNotification(req, res, next) {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    // 查找通知
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json(errors.notFound('通知不存在'));
    }

    // 验证用户是否是通知接收者
    if (notification.userId.toString() !== userId) {
      return res.status(403).json(errors.forbidden('无权删除'));
    }

    // 保存通知信息用于同步
    const notificationData = notification.toObject();

    // 删除通知
    await Notification.findByIdAndDelete(notificationId);

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'delete',
      collection: 'notifications',
      documentId: notificationId,
      data: notificationData
    });

    res.json(success(null, '通知已删除'));
  } catch (error) {
    next(error);
  }
}

/**
 * 删除所有通知
 */
async function deleteAllNotifications(req, res, next) {
  try {
    const userId = req.user.userId;

    // 先查询所有要删除的通知
    const notifications = await Notification.find({ userId });

    const result = await Notification.deleteMany({ userId });

    // 异步同步到 MySQL（批量删除）
    notifications.forEach(notification => {
      publishSyncEvent({
        type: 'delete',
        collection: 'notifications',
        documentId: notification._id.toString(),
        data: notification.toObject()
      });
    });

    res.json(
      success(
        {
          deletedCount: result.deletedCount
        },
        `已删除 ${result.deletedCount} 条通知`
      )
    );
  } catch (error) {
    next(error);
  }
}

/**
 * 内部函数：创建通知
 * 供其他controller调用
 */
async function createNotification(userId, type, title, content, options = {}) {
  try {
    const notification = new Notification({
      userId,
      type,
      title,
      content,
      requestId: options.requestId || null,
      senderId: options.senderId || null,
      data: options.data || {}
    });

    await notification.save();

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'create',
      collection: 'notifications',
      documentId: notification._id.toString(),
      data: notification.toObject()
    });

    // 通过 WebSocket 推送通知（如果 wsManager 可用）
    if (options.wsManager) {
      options.wsManager.pushNotificationToUser(userId, {
        type,
        title,
        content,
        notificationId: notification._id,
        data: options.data || {}
      });
    }

    return notification;
  } catch (error) {
    logger.error('Failed to create notification', error, { userId, type });
    return null;
  }
}

/**
 * 内部函数：创建多条通知
 */
async function createNotifications(userIds, type, title, content, options = {}) {
  try {
    const notifications = await Notification.insertMany(
      userIds.map(userId => ({
        userId,
        type,
        title,
        content,
        requestId: options.requestId || null,
        senderId: options.senderId || null,
        data: options.data || {}
      }))
    );

    // 异步同步到 MySQL（批量创建）
    notifications.forEach(notification => {
      publishSyncEvent({
        type: 'create',
        collection: 'notifications',
        documentId: notification._id.toString(),
        data: notification.toObject()
      });
    });

    // 通过 WebSocket 推送所有通知（如果 wsManager 可用）
    if (options.wsManager) {
      userIds.forEach(userId => {
        options.wsManager.pushNotificationToUser(userId, {
          type,
          title,
          content,
          data: options.data || {}
        });
      });
    }

    return notifications;
  } catch (error) {
    logger.error('Failed to batch create notifications', error, {
      userCount: userIds.length,
      type
    });
    return [];
  }
}

/**
 * 归档单个通知
 */
async function archiveNotification(req, res, next) {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    // 查找通知
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json(errors.notFound('通知不存在'));
    }

    // 验证用户是否是通知接收者
    if (notification.userId.toString() !== userId) {
      return res.status(403).json(errors.forbidden('无权操作'));
    }

    // 标记为归档
    notification.isArchived = true;
    notification.archivedAt = new Date();
    await notification.save();

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'update',
      collection: 'notifications',
      documentId: notification._id.toString(),
      data: notification.toObject()
    });

    res.json(success(notification, '已归档'));
  } catch (error) {
    next(error);
  }
}

/**
 * 获取已归档的通知列表
 */
async function getArchivedNotifications(req, res, next) {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    // 计算分页
    const skip = (page - 1) * limit;

    // 查询总数
    const total = await Notification.countDocuments({
      userId,
      isArchived: true
    });

    // 查询通知
    const notifications = await Notification.find({
      userId,
      isArchived: true
    })
      .populate('senderId', 'nickname avatar')
      .populate('requestId', 'status fromUserId toUserId')
      .sort({ archivedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json(
      success(
        {
          notifications,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit)
          }
        },
        '获取成功'
      )
    );
  } catch (error) {
    next(error);
  }
}

/**
 * 归档所有通知
 */
async function archiveAllNotifications(req, res, next) {
  try {
    const userId = req.user.userId;

    // 更新所有未归档的通知
    const result = await Notification.updateMany(
      { userId, isArchived: false },
      {
        $set: {
          isArchived: true,
          archivedAt: new Date()
        }
      }
    );

    res.json(
      success(
        {
          archivedCount: result.modifiedCount
        },
        `已归档 ${result.modifiedCount} 条通知`
      )
    );
  } catch (error) {
    next(error);
  }
}

/**
 * 取消归档通知
 */
async function unarchiveNotification(req, res, next) {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    // 查找通知
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json(errors.notFound('通知不存在'));
    }

    // 验证用户是否是通知接收者
    if (notification.userId.toString() !== userId) {
      return res.status(403).json(errors.forbidden('无权操作'));
    }

    // 取消归档
    notification.isArchived = false;
    notification.archivedAt = null;
    await notification.save();

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'update',
      collection: 'notifications',
      documentId: notification._id.toString(),
      data: notification.toObject()
    });

    res.json(success(notification, '已取消归档'));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  createNotification,
  createNotifications,
  archiveNotification,
  getArchivedNotifications,
  archiveAllNotifications,
  unarchiveNotification
};
