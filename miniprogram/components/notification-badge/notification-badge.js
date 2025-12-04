/**
 * 通知徽章组件
 * 在其他页面中使用此组件显示未读通知数量
 */

import notificationService from '../../services/notification.service';

Component({
  properties: {
    // 父组件可以通过此属性控制未读数量
    unreadCount: {
      type: Number,
      value: 0
    }
  },

  data: {
    unreadCount: 0,
    refreshInterval: null
  },

  attached() {
    // 组件加载时获取未读数量
    this.loadUnreadCount();

    // 每30秒刷新一次未读数量
    const refreshInterval = setInterval(() => {
      this.loadUnreadCount();
    }, 30000);

    this.setData({ refreshInterval });
  },

  detached() {
    // 组件卸载时清除定时器
    if (this.data.refreshInterval) {
      clearInterval(this.data.refreshInterval);
    }
  },

  methods: {
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
        console.error('加载未读通知数量失败:', error);
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
