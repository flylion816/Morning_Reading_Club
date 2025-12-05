/**
 * 通知徽章组件
 * 在其他页面中使用此组件显示未读通知数量
 *
 * 支持两种模式：
 * 1. WebSocket 实时推送（优先使用）
 * 2. 定时轮询（WebSocket 不可用时的降级方案）
 */

import notificationService from '../../services/notification.service';
import websocketService from '../../services/websocket.service';

Component({
  properties: {
    // 父组件可以通过此属性控制未读数量
    unreadCount: {
      type: Number,
      value: 0
    },
    // 是否启用 WebSocket（默认启用）
    enableWebSocket: {
      type: Boolean,
      value: true
    }
  },

  data: {
    unreadCount: 0,
    refreshInterval: null,
    wsUnsubscribe: null,
    useWebSocket: false
  },

  attached() {
    // 组件加载时获取未读数量
    this.loadUnreadCount();

    // 如果启用 WebSocket，尝试建立连接
    if (this.properties.enableWebSocket) {
      this.initWebSocket();
    } else {
      // 降级到定时轮询
      this.startPolling();
    }
  },

  detached() {
    // 清除定时器
    if (this.data.refreshInterval) {
      clearInterval(this.data.refreshInterval);
    }

    // 取消 WebSocket 订阅
    if (this.data.wsUnsubscribe) {
      this.data.wsUnsubscribe();
    }
  },

  methods: {
    /**
     * 初始化 WebSocket
     */
    async initWebSocket() {
      try {
        const userInfo = wx.getStorageSync('user_info');
        if (!userInfo || !userInfo._id) {
          console.warn('[NotificationBadge] 用户信息不存在，使用轮询模式');
          this.startPolling();
          return;
        }

        // 连接 WebSocket
        await websocketService.connect(userInfo._id);

        this.setData({ useWebSocket: true });

        // 订阅新通知事件
        const unsubscribe = websocketService.on('notification:new', (notification) => {
          console.log('[NotificationBadge] 收到新通知', notification);
          // 刷新未读数量
          this.loadUnreadCount();
        });

        this.setData({ wsUnsubscribe: unsubscribe });

        // 作为备选方案，每2分钟检查一次（以防 WebSocket 断开）
        const refreshInterval = setInterval(() => {
          if (!websocketService.isConnected) {
            console.warn('[NotificationBadge] WebSocket 断开，切换到轮询模式');
            this.startPolling();
            clearInterval(refreshInterval);
          }
        }, 120000);

        this.setData({ refreshInterval });

        console.log('[NotificationBadge] WebSocket 连接成功，使用实时推送模式');
      } catch (error) {
        console.warn('[NotificationBadge] WebSocket 初始化失败，切换到轮询模式:', error);
        this.startPolling();
      }
    },

    /**
     * 启动定时轮询
     */
    startPolling() {
      // 先加载一次
      this.loadUnreadCount();

      // 每30秒轮询一次
      const refreshInterval = setInterval(() => {
        this.loadUnreadCount();
      }, 30000);

      this.setData({ refreshInterval, useWebSocket: false });
      console.log('[NotificationBadge] 使用轮询模式，间隔30秒');
    },

    /**
     * 加载未读通知数量
     */
    async loadUnreadCount() {
      try {
        const response = await notificationService.getUnreadCount();
        if (response.code === 200) {
          this.setData({ unreadCount: response.data.unreadCount });
          // 触发自定义事件，通知父组件
          this.triggerEvent('unreadCountChange', {
            unreadCount: response.data.unreadCount
          });
        }
      } catch (error) {
        console.error('[NotificationBadge] 加载未读通知数量失败:', error);
      }
    },

    /**
     * 处理通知按钮点击
     */
    handleNotificationTap() {
      // 导航到通知页面
      wx.navigateTo({
        url: '/pages/notifications/notifications',
        success: () => {
          // 导航成功后，延迟刷新未读数量
          setTimeout(() => {
            this.loadUnreadCount();
          }, 500);
        }
      });

      // 触发自定义事件
      this.triggerEvent('notificationTap');
    },

    /**
     * 刷新未读数量（外部可调用）
     */
    refresh() {
      this.loadUnreadCount();
    }
  }
});
