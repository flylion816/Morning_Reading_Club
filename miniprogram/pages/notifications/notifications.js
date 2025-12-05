/**
 * 通知页面
 *
 * 支持两种通知更新模式：
 * 1. WebSocket 实时推送（有新通知立即显示）
 * 2. 定时轮询（WebSocket 不可用时的降级方案）
 */

import notificationService from '../../services/notification.service';
import websocketService from '../../services/websocket.service';

Page({
  data: {
    notifications: [],          // 所有通知
    displayedNotifications: [], // 根据筛选显示的通知
    unreadCount: 0,             // 未读数量
    activeTab: 'all',           // 当前选中的选项卡
    page: 1,                    // 当前页码
    limit: 20,                  // 每页数量
    hasMore: true,              // 是否有更多
    loading: false,             // 是否加载中
    error: null,                // 错误信息
    useWebSocket: false,        // 是否使用 WebSocket
    wsUnsubscribe: null         // WebSocket 取消订阅函数
  },

  onLoad() {
    this.loadNotifications();
    this.loadUnreadCount();
    this.initWebSocket();
  },

  onShow() {
    // 每次页面显示时刷新通知
    this.loadNotifications();
  },

  onUnload() {
    // 页面卸载时取消 WebSocket 订阅
    if (this.data.wsUnsubscribe) {
      this.data.wsUnsubscribe();
    }
  },

  /**
   * 初始化 WebSocket
   */
  async initWebSocket() {
    try {
      const userInfo = wx.getStorageSync('user_info');
      if (!userInfo || !userInfo._id) {
        console.warn('[NotificationsPage] 用户信息不存在，WebSocket 不可用');
        return;
      }

      // 连接 WebSocket
      await websocketService.connect(userInfo._id);

      // 订阅新通知事件
      const unsubscribe = websocketService.on('notification:new', (notification) => {
        console.log('[NotificationsPage] 收到新通知', notification);
        // 在页面顶部添加新通知
        const updatedNotifications = [
          {
            _id: notification.notificationId || Math.random().toString(36).substr(2, 9),
            type: notification.type,
            title: notification.title,
            content: notification.content,
            isRead: false,
            createdAt: notification.timestamp || new Date().toISOString(),
            data: notification.data || {}
          },
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
      console.log('[NotificationsPage] WebSocket 连接成功，启用实时推送');

    } catch (error) {
      console.warn('[NotificationsPage] WebSocket 初始化失败，使用轮询模式:', error);
      // 降级到轮询
    }
  },

  /**
   * 加载通知列表
   */
  async loadNotifications(append = false) {
    if (this.data.loading) return;

    this.setData({ loading: true, error: null });

    try {
      const page = append ? this.data.page + 1 : 1;
      const response = await notificationService.getNotifications(
        page,
        this.data.limit,
        this.data.activeTab
      );

      if (response.code === 200) {
        const { notifications, pagination } = response.data;

        this.setData({
          notifications: append
            ? [...this.data.notifications, ...notifications]
            : notifications,
          page: pagination.page,
          hasMore: pagination.page < pagination.totalPages,
          loading: false
        });

        // 更新显示的通知
        this.updateDisplayedNotifications();
      } else {
        this.setData({
          error: response.message || '加载失败',
          loading: false
        });
      }
    } catch (error) {
      console.error('加载通知失败:', error);
      this.setData({
        error: error.message || '加载失败',
        loading: false
      });
    }
  },

  /**
   * 加载未读数量
   */
  async loadUnreadCount() {
    try {
      const response = await notificationService.getUnreadCount();
      if (response.code === 200) {
        this.setData({ unreadCount: response.data.unreadCount });
      }
    } catch (error) {
      console.error('加载未读数量失败:', error);
    }
  },

  /**
   * 更新显示的通知（根据当前选项卡）
   */
  updateDisplayedNotifications() {
    const { notifications, activeTab } = this.data;
    let displayed = notifications;

    if (activeTab === 'true') {
      // 仅显示已读
      displayed = notifications.filter(n => n.isRead);
    } else if (activeTab === 'false') {
      // 仅显示未读
      displayed = notifications.filter(n => !n.isRead);
    }

    this.setData({ displayedNotifications: displayed });
  },

  /**
   * 处理选项卡切换
   */
  handleTabChange(event) {
    const tab = event.currentTarget.dataset.tab;
    if (tab !== this.data.activeTab) {
      this.setData({ activeTab: tab, page: 1 });
      this.loadNotifications();
    }
  },

  /**
   * 处理通知点击
   */
  async handleNotificationTap(event) {
    const { id, requestId } = event.currentTarget.dataset;
    const notification = this.data.notifications.find(n => n._id === id);

    // 标记为已读
    if (!notification.isRead) {
      try {
        await notificationService.markAsRead(id);
        // 更新本地数据
        const updatedNotifications = this.data.notifications.map(n =>
          n._id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        );
        this.setData({ notifications: updatedNotifications });
        this.updateDisplayedNotifications();
        this.loadUnreadCount();
      } catch (error) {
        console.error('标记为已读失败:', error);
      }
    }

    // 如果有关联的申请，跳转到详情页
    if (requestId) {
      wx.navigateTo({
        url: `/pages/insight-request-detail/insight-request-detail?requestId=${requestId}`
      });
    }
  },

  /**
   * 处理删除通知
   */
  handleDelete(event) {
    const notificationId = event.currentTarget.dataset.id;

    wx.showModal({
      title: '删除通知',
      content: '确定要删除这条通知吗？',
      confirmText: '删除',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            const response = await notificationService.deleteNotification(notificationId);
            if (response.code === 200) {
              // 从列表中移除
              const updated = this.data.notifications.filter(n => n._id !== notificationId);
              this.setData({ notifications: updated });
              this.updateDisplayedNotifications();
              this.loadUnreadCount();

              wx.showToast({
                title: '已删除',
                icon: 'success',
                duration: 1500
              });
            }
          } catch (error) {
            console.error('删除通知失败:', error);
            wx.showToast({
              title: '删除失败',
              icon: 'error',
              duration: 1500
            });
          }
        }
      }
    });
  },

  /**
   * 处理全部已读
   */
  handleMarkAllAsRead() {
    wx.showModal({
      title: '标记全部已读',
      content: '将所有通知标记为已读？',
      confirmText: '标记',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            const response = await notificationService.markAllAsRead();
            if (response.code === 200) {
              // 更新所有通知为已读
              const updated = this.data.notifications.map(n => ({
                ...n,
                isRead: true,
                readAt: new Date().toISOString()
              }));
              this.setData({ notifications: updated });
              this.updateDisplayedNotifications();
              this.loadUnreadCount();

              wx.showToast({
                title: '已标记为已读',
                icon: 'success',
                duration: 1500
              });
            }
          } catch (error) {
            console.error('标记全部已读失败:', error);
            wx.showToast({
              title: '操作失败',
              icon: 'error',
              duration: 1500
            });
          }
        }
      }
    });
  },

  /**
   * 处理加载更多
   */
  handleLoadMore() {
    this.loadNotifications(true);
  },

  /**
   * 格式化时间
   */
  formatTime(timestamp) {
    return notificationService.formatTime(timestamp);
  },

  /**
   * 获取通知类型图标
   */
  getTypeIcon(type) {
    return notificationService.getTypeIcon(type);
  },

  /**
   * 获取通知类型标签
   */
  getTypeLabel(type) {
    return notificationService.getTypeLabel(type);
  }
});
