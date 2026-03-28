const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const {
  getUserNotifications,
  getUnreadCount,
  getSubscriptionSettings,
  markNotificationAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  saveSubscriptionGrants,
  archiveNotification,
  getArchivedNotifications,
  archiveAllNotifications,
  unarchiveNotification
} = require('../controllers/notification.controller');

/**
 * @route   GET /api/v1/notifications
 * @desc    获取用户通知列表
 * @access  Private
 */
router.get('/', authMiddleware, getUserNotifications);

/**
 * @route   GET /api/v1/notifications/unread
 * @desc    获取未读通知数量
 * @access  Private
 */
router.get('/unread', authMiddleware, getUnreadCount);

/**
 * @route   GET /api/v1/notifications/subscriptions
 * @desc    获取当前用户订阅消息场景状态
 * @access  Private
 */
router.get('/subscriptions', authMiddleware, getSubscriptionSettings);

/**
 * @route   POST /api/v1/notifications/subscriptions/grants
 * @desc    保存订阅消息授权结果
 * @access  Private
 */
router.post('/subscriptions/grants', authMiddleware, saveSubscriptionGrants);

/**
 * @route   GET /api/v1/notifications/archived
 * @desc    获取已归档的通知列表
 * @access  Private
 */
router.get('/archived', authMiddleware, getArchivedNotifications);

/**
 * @route   PUT /api/v1/notifications/:notificationId/read
 * @desc    标记单个通知为已读
 * @access  Private
 */
router.put('/:notificationId/read', authMiddleware, markNotificationAsRead);

/**
 * @route   PUT /api/v1/notifications/read-all
 * @desc    标记所有通知为已读
 * @access  Private
 */
router.put('/read-all', authMiddleware, markAllAsRead);

/**
 * @route   PUT /api/v1/notifications/:notificationId/archive
 * @desc    归档单个通知
 * @access  Private
 */
router.put('/:notificationId/archive', authMiddleware, archiveNotification);

/**
 * @route   PUT /api/v1/notifications/:notificationId/unarchive
 * @desc    取消归档通知
 * @access  Private
 */
router.put('/:notificationId/unarchive', authMiddleware, unarchiveNotification);

/**
 * @route   PUT /api/v1/notifications/archive-all
 * @desc    归档所有通知
 * @access  Private
 */
router.put('/archive-all', authMiddleware, archiveAllNotifications);

/**
 * @route   DELETE /api/v1/notifications/:notificationId
 * @desc    删除通知
 * @access  Private
 */
router.delete('/:notificationId', authMiddleware, deleteNotification);

/**
 * @route   DELETE /api/v1/notifications
 * @desc    删除所有通知
 * @access  Private
 */
router.delete('/', authMiddleware, deleteAllNotifications);

module.exports = router;
