/**
 * 通知页面
 *
 * 支持两种通知更新模式：
 * 1. WebSocket 实时推送（有新通知立即显示）
 * 2. 重新进入页面时刷新列表
 */

const notificationServiceModule = require('../../services/notification.service');
const websocketServiceModule = require('../../services/websocket.service');
const constants = require('../../config/constants');

const notificationService = notificationServiceModule.default || notificationServiceModule;
const websocketService = websocketServiceModule.default || websocketServiceModule;

function buildQueryString(params = {}) {
  return Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
}

Page({
  data: {
    notifications: [],
    displayedNotifications: [],
    unreadCount: 0,
    activeTab: 'all',
    page: 1,
    limit: 20,
    hasMore: true,
    loading: false,
    error: null,
    useWebSocket: false,
    wsUnsubscribe: null
  },

  onLoad() {
    this._skipNextShowRefresh = true;
    this.refreshNotifications();
  },

  onShow() {
    if (this._skipNextShowRefresh) {
      this._skipNextShowRefresh = false;
      return;
    }

    this.refreshNotifications();
  },

  onPullDownRefresh() {
    this.refreshNotifications().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (!this.data.loading && this.data.hasMore) {
      this.handleLoadMore();
    }
  },

  onUnload() {
    if (this.data.wsUnsubscribe) {
      this.data.wsUnsubscribe();
    }
    websocketService.disconnect();
  },

  refreshNotifications() {
    return Promise.all([this.loadNotifications(false), this.loadUnreadCount()]);
  },

  isImageSource(value = '') {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return false;
    }

    return /^(https?:\/\/|wxfile:\/\/|cloud:\/\/|data:image\/|\/)/i.test(normalized);
  },

  getNotificationRequestId(notification = {}) {
    return (
      notification?.requestId?._id ||
      notification?.requestId ||
      notification?.data?.insightRequestId ||
      ''
    );
  },

  getNotificationTargetUser(notification = {}) {
    const sender = notification?.senderId || {};
    return {
      userId:
        notification?.data?.targetUserId ||
        sender?._id ||
        sender?.id ||
        notification?.senderId ||
        '',
      userName:
        notification?.data?.targetUserName ||
        notification?.data?.senderName ||
        sender?.nickname ||
        ''
    };
  },

  getNotificationPeriodId(notification = {}) {
    return notification?.data?.periodId || '';
  },

  buildProfileOthersTargetPage(userId, params = {}) {
    if (!userId) {
      return '';
    }

    const query = buildQueryString({
      userId,
      ...params
    });

    return query
      ? `pages/profile-others/profile-others?${query}`
      : 'pages/profile-others/profile-others';
  },

  normalizeTargetPage(targetPage = '') {
    return String(targetPage || '').replace(/^\/+/, '').trim();
  },

  getTabPagePath(targetPage = '') {
    return this.normalizeTargetPage(targetPage).split('?')[0];
  },

  isTabPage(pagePath = '') {
    return ['pages/profile/profile', 'pages/index/index'].includes(pagePath);
  },

  navigateByTargetPage(targetPage = '') {
    const normalized = this.normalizeTargetPage(targetPage);
    if (!normalized) {
      return;
    }

    const pagePath = this.getTabPagePath(normalized);
    if (this.isTabPage(pagePath)) {
      wx.switchTab({
        url: `/${pagePath}`
      });
      return;
    }

    wx.navigateTo({
      url: `/${normalized}`
    });
  },

  resolveNotificationTarget(notification = {}) {
    const directTarget = notification?.data?.targetPage;
    if (directTarget) {
      return directTarget;
    }

    const { type } = notification;
    const sectionId = notification?.data?.sectionId || '';
    const checkinId = notification?.data?.checkinId || '';
    const commentId = notification?.data?.commentId || '';
    const replyId = notification?.data?.replyId || '';
    const requestId = this.getNotificationRequestId(notification);
    const periodId = this.getNotificationPeriodId(notification);
    const targetUser = this.getNotificationTargetUser(notification);

    if (sectionId && checkinId && (type === 'comment_received' || type === 'like_received')) {
      const query = buildQueryString({
        id: sectionId,
        checkinId,
        focus: 'comments',
        commentId,
        replyId
      });
      return `pages/course-detail/course-detail?${query}`;
    }

    if (type === 'request_created') {
      return 'pages/profile/profile';
    }

    if (['request_approved', 'admin_approved'].includes(type) && targetUser.userId) {
      return this.buildProfileOthersTargetPage(targetUser.userId, { periodId });
    }

    if (
      ['request_rejected', 'admin_rejected', 'permission_revoked'].includes(type) &&
      targetUser.userId
    ) {
      return this.buildProfileOthersTargetPage(targetUser.userId, { periodId });
    }

    if (['enrollment_result', 'payment_result'].includes(type)) {
      return 'pages/index/index';
    }

    if (requestId) {
      return 'pages/insight-requests/insight-requests';
    }

    return '';
  },

  getNotificationActionText(notification = {}) {
    const actionTextMap = {
      comment_received: '查看打卡详情',
      like_received: '查看打卡详情',
      request_created: '去首页处理',
      request_approved: '查看对方小凡看见',
      admin_approved: '查看对方小凡看见',
      request_rejected: '查看申请状态',
      admin_rejected: '查看申请状态',
      permission_revoked: '查看申请状态',
      enrollment_result: '查看课程首页',
      payment_result: '查看课程首页'
    };

    return actionTextMap[notification?.type] || '';
  },

  decorateNotification(notification = {}) {
    const sender = notification?.senderId || {};
    const senderName = notification?.data?.senderName || sender?.nickname || '';
    const rawSenderAvatar =
      notification?.data?.senderAvatar || sender?.avatarUrl || sender?.avatar || '';
    const senderAvatar = this.isImageSource(rawSenderAvatar) ? rawSenderAvatar : '';

    return {
      ...notification,
      typeIcon: notificationService.getTypeIcon(notification.type),
      typeLabel: notificationService.getTypeLabel(notification.type),
      typeColor: notificationService.getTypeColor(notification.type),
      formattedTime: notificationService.formatTime(notification.createdAt),
      senderName,
      senderAvatar,
      requestIdValue: this.getNotificationRequestId(notification),
      resolvedTargetPage: this.resolveNotificationTarget(notification),
      actionText: this.getNotificationActionText(notification)
    };
  },

  async initWebSocket() {
    try {
      const userInfo = wx.getStorageSync(constants.STORAGE_KEYS.USER_INFO);
      if (!userInfo || !userInfo._id) {
        console.warn('[NotificationsPage] 用户信息不存在，WebSocket 不可用');
        return;
      }

      await websocketService.connect(userInfo._id);

      const unsubscribe = websocketService.on('notification:new', notification => {
        const updatedNotifications = [
          this.decorateNotification({
            _id: notification.notificationId || Math.random().toString(36).slice(2, 11),
            type: notification.type,
            title: notification.title,
            content: notification.content,
            isRead: false,
            createdAt: notification.timestamp || new Date().toISOString(),
            data: notification.data || {}
          }),
          ...this.data.notifications
        ];

        this.setData({
          notifications: updatedNotifications,
          useWebSocket: true
        });
        this.updateDisplayedNotifications();
        this.loadUnreadCount();
      });

      this.setData({ wsUnsubscribe: unsubscribe, useWebSocket: true });
    } catch (error) {
      console.warn('[NotificationsPage] WebSocket 初始化失败，使用刷新模式:', error);
    }
  },

  async loadNotifications(append = false) {
    if (this.data.loading) {
      return;
    }

    this.setData({ loading: true, error: null });

    try {
      const page = append ? this.data.page + 1 : 1;
      const response = await notificationService.getNotifications(
        page,
        this.data.limit,
        this.data.activeTab
      );
      const notifications = (response?.notifications || []).map(item => this.decorateNotification(item));
      const pagination = response?.pagination || { page, totalPages: 1 };

      this.setData({
        notifications: append ? [...this.data.notifications, ...notifications] : notifications,
        page: pagination.page || page,
        hasMore: (pagination.page || page) < (pagination.totalPages || 1),
        loading: false
      });

      this.updateDisplayedNotifications();
    } catch (error) {
      console.error('加载通知失败:', error);
      this.setData({
        error: error.message || '加载失败',
        loading: false
      });
    }
  },

  async loadUnreadCount() {
    try {
      const response = await notificationService.getUnreadCount();
      this.setData({ unreadCount: response?.unreadCount || 0 });
    } catch (error) {
      console.error('加载未读数量失败:', error);
    }
  },

  updateDisplayedNotifications() {
    const { notifications, activeTab } = this.data;
    let displayed = notifications;

    if (activeTab === 'true') {
      displayed = notifications.filter(item => item.isRead);
    } else if (activeTab === 'false') {
      displayed = notifications.filter(item => !item.isRead);
    }

    this.setData({ displayedNotifications: displayed });
  },

  handleTabChange(event) {
    const tab = event.currentTarget.dataset.tab;
    if (tab !== this.data.activeTab) {
      this.setData({ activeTab: tab, page: 1 });
      this.loadNotifications();
    }
  },

  async handleNotificationTap(event) {
    const { id } = event.currentTarget.dataset;
    const notification = this.data.notifications.find(item => item._id === id);

    if (!notification) {
      return;
    }

    if (!notification.isRead) {
      try {
        await notificationService.markAsRead(id);
        const updatedNotifications = this.data.notifications.map(item =>
          item._id === id
            ? this.decorateNotification({
                ...item,
                isRead: true,
                readAt: new Date().toISOString()
              })
            : item
        );
        this.setData({ notifications: updatedNotifications });
        this.updateDisplayedNotifications();
        this.loadUnreadCount();
      } catch (error) {
        console.error('标记为已读失败:', error);
      }
    }

    const targetPage = notification.resolvedTargetPage || this.resolveNotificationTarget(notification);
    if (targetPage) {
      this.navigateByTargetPage(targetPage);
    }
  },

  handleDelete(event) {
    const notificationId = event.currentTarget.dataset.id;

    wx.showModal({
      title: '删除通知',
      content: '确定要删除这条通知吗？',
      confirmText: '删除',
      cancelText: '取消',
      success: async res => {
        if (!res.confirm) {
          return;
        }

        try {
          await notificationService.deleteNotification(notificationId);
          const updated = this.data.notifications.filter(item => item._id !== notificationId);
          this.setData({ notifications: updated });
          this.updateDisplayedNotifications();
          this.loadUnreadCount();

          wx.showToast({
            title: '已删除',
            icon: 'success',
            duration: 1500
          });
        } catch (error) {
          console.error('删除通知失败:', error);
          wx.showToast({
            title: '删除失败',
            icon: 'error',
            duration: 1500
          });
        }
      }
    });
  },

  handleMarkAllAsRead() {
    wx.showModal({
      title: '标记全部已读',
      content: '将所有通知标记为已读？',
      confirmText: '标记',
      cancelText: '取消',
      success: async res => {
        if (!res.confirm) {
          return;
        }

        try {
          await notificationService.markAllAsRead();
          const updated = this.data.notifications
            .map(item => ({
              ...item,
              isRead: true,
              readAt: new Date().toISOString()
            }))
            .map(item => this.decorateNotification(item));
          this.setData({ notifications: updated });
          this.updateDisplayedNotifications();
          this.loadUnreadCount();

          wx.showToast({
            title: '已标记为已读',
            icon: 'success',
            duration: 1500
          });
        } catch (error) {
          console.error('标记全部已读失败:', error);
          wx.showToast({
            title: '操作失败',
            icon: 'error',
            duration: 1500
          });
        }
      }
    });
  },

  handleLoadMore() {
    this.loadNotifications(true);
  }
});
