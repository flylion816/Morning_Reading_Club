/**
 * 通知服务
 * 处理所有与通知相关的API调用
 */

import { request } from './request';

class NotificationService {
  /**
   * 获取用户通知列表
   * @param {number} page 页码
   * @param {number} limit 每页数量
   * @param {string} isRead 过滤条件：'all'|'true'|'false'
   * @returns {Promise}
   */
  getNotifications(page = 1, limit = 20, isRead = 'all') {
    return request.get('/notifications', {
      page,
      limit,
      isRead
    });
  }

  /**
   * 获取未读通知数量
   * @returns {Promise}
   */
  getUnreadCount() {
    return request.get('/notifications/unread');
  }

  /**
   * 标记单个通知为已读
   * @param {string} notificationId 通知ID
   * @returns {Promise}
   */
  markAsRead(notificationId) {
    return request.put(`/notifications/${notificationId}/read`);
  }

  /**
   * 标记所有通知为已读
   * @returns {Promise}
   */
  markAllAsRead() {
    return request.put('/notifications/read-all');
  }

  /**
   * 删除单个通知
   * @param {string} notificationId 通知ID
   * @returns {Promise}
   */
  deleteNotification(notificationId) {
    return request.delete(`/notifications/${notificationId}`);
  }

  /**
   * 删除所有通知
   * @returns {Promise}
   */
  deleteAllNotifications() {
    return request.delete('/notifications');
  }

  /**
   * 获取通知类型对应的标签
   * @param {string} type 通知类型
   * @returns {string}
   */
  getTypeLabel(type) {
    const labels = {
      request_created: '新申请',
      request_approved: '申请已同意',
      request_rejected: '申请已拒绝',
      permission_revoked: '权限已撤销',
      admin_approved: '管理员已同意',
      admin_rejected: '管理员已拒绝'
    };
    return labels[type] || '通知';
  }

  /**
   * 获取通知类型对应的图标
   * @param {string} type 通知类型
   * @returns {string}
   */
  getTypeIcon(type) {
    const icons = {
      request_created: '📝',
      request_approved: '✅',
      request_rejected: '❌',
      permission_revoked: '🚫',
      admin_approved: '✅',
      admin_rejected: '❌'
    };
    return icons[type] || '📬';
  }

  /**
   * 获取通知类型对应的颜色
   * @param {string} type 通知类型
   * @returns {string}
   */
  getTypeColor(type) {
    const colors = {
      request_created: '#FFB800',
      request_approved: '#07C160',
      request_rejected: '#FA5151',
      permission_revoked: '#E64340',
      admin_approved: '#07C160',
      admin_rejected: '#FA5151'
    };
    return colors[type] || '#999';
  }

  /**
   * 格式化时间戳为相对时间
   * @param {string|Date} timestamp 时间戳
   * @returns {string}
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // 分钟
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;

    // 小时
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return `${hours} 小时前`;

    // 天数
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 7) return `${days} 天前`;

    // 日期格式
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    });
  }
}

export default new NotificationService();
