const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const {
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications
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
