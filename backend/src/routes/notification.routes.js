const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
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

// 所有 notification 路由都需要登录 + 租户上下文
router.use(authMiddleware, userTenantContext);

/**
 * @route   GET /api/v1/notifications
 * @desc    获取用户通知列表
 * @access  Private
 */
router.get('/', getUserNotifications);

/**
 * @route   GET /api/v1/notifications/unread
 * @desc    获取未读通知数量
 * @access  Private
 */
router.get('/unread', getUnreadCount);

/**
 * @route   GET /api/v1/notifications/subscriptions
 * @desc    获取当前用户订阅消息场景状态
 * @access  Private
 */
router.get('/subscriptions', getSubscriptionSettings);

/**
 * @route   POST /api/v1/notifications/subscriptions/grants
 * @desc    保存订阅消息授权结果
 * @access  Private
 */
router.post('/subscriptions/grants', saveSubscriptionGrants);

/**
 * @route   GET /api/v1/notifications/archived
 * @desc    获取已归档的通知列表
 * @access  Private
 */
router.get('/archived', getArchivedNotifications);

/**
 * @route   PUT /api/v1/notifications/:notificationId/read
 * @desc    标记单个通知为已读
 * @access  Private
 */
router.put('/:notificationId/read', markNotificationAsRead);

/**
 * @route   PUT /api/v1/notifications/read-all
 * @desc    标记所有通知为已读
 * @access  Private
 */
router.put('/read-all', markAllAsRead);

/**
 * @route   PUT /api/v1/notifications/:notificationId/archive
 * @desc    归档单个通知
 * @access  Private
 */
router.put('/:notificationId/archive', archiveNotification);

/**
 * @route   PUT /api/v1/notifications/:notificationId/unarchive
 * @desc    取消归档通知
 * @access  Private
 */
router.put('/:notificationId/unarchive', unarchiveNotification);

/**
 * @route   PUT /api/v1/notifications/archive-all
 * @desc    归档所有通知
 * @access  Private
 */
router.put('/archive-all', archiveAllNotifications);

/**
 * @route   DELETE /api/v1/notifications/:notificationId
 * @desc    删除通知
 * @access  Private
 */
router.delete('/:notificationId', deleteNotification);

/**
 * @route   DELETE /api/v1/notifications
 * @desc    删除所有通知
 * @access  Private
 */
router.delete('/', deleteAllNotifications);

module.exports = router;
