const userService = require('../../services/user.service');

Page({
  data: {
    userId: null,
    userInfo: {},
    stats: {}
  },

  onLoad(options) {
    console.log('他人主页加载', options);
    const userId = options.userId || options.id;
    this.setData({ userId });
    this.loadUserProfile();
  },

  /**
   * 加载用户资料
   */
  async loadUserProfile() {
    if (!this.data.userId) {
      console.error('用户ID不存在');
      return;
    }

    try {
      // 从本地存储获取用户信息（Mock数据）
      const userId = parseInt(this.data.userId);

      // Mock用户数据
      const mockUsers = {
        1: {
          id: 1,
          nickname: '阿泰',
          avatar: '阿',
          signature: '知名心灵大师',
          checkinDays: 23,
          completedCourses: 5
        },
        2: {
          id: 2,
          nickname: '小明',
          avatar: '明',
          signature: '努力学习中',
          checkinDays: 15,
          completedCourses: 3
        }
      };

      const userInfo = mockUsers[userId] || {
        id: userId,
        nickname: '用户' + userId,
        avatar: '👤',
        signature: '这个人很懒，什么都没写',
        checkinDays: 0,
        completedCourses: 0
      };

      this.setData({
        userInfo,
        stats: {
          checkinDays: userInfo.checkinDays,
          completedCourses: userInfo.completedCourses
        }
      });
    } catch (error) {
      console.error('加载用户资料失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 点击小凡看见 - 发起查看申请
   */
  handleRequestInsights() {
    const { userId, userInfo } = this.data;
    const app = getApp();
    const currentUser = app.globalData.userInfo;

    if (!currentUser || !currentUser.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '查看小凡看见',
      content: `需要向 ${userInfo.nickname} 发起查看申请，对方同意后才能查看`,
      confirmText: '发起申请',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.sendInsightRequest();
        }
      }
    });
  },

  /**
   * 发送查看小凡看见的申请
   */
  sendInsightRequest() {
    const { userId, userInfo } = this.data;
    const app = getApp();
    const currentUser = app.globalData.userInfo;

    // 创建申请记录
    const request = {
      id: Date.now(),
      fromUserId: currentUser.id,
      fromUserName: currentUser.nickname,
      fromUserAvatar: currentUser.avatar || '😊',
      toUserId: userId,
      toUserName: userInfo.nickname,
      time: this.formatTime(new Date()),
      status: 'pending' // pending, approved, rejected
    };

    // 保存到本地存储
    let requests = wx.getStorageSync('insight_requests') || [];
    requests.push(request);
    wx.setStorageSync('insight_requests', requests);

    wx.showToast({
      title: '申请已发送',
      icon: 'success'
    });

    console.log('发送小凡看见查看申请:', request);
  },

  /**
   * 格式化时间
   */
  formatTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}天前`;

    return date.toLocaleDateString();
  },

  /**
   * 返回
   */
  handleBack() {
    wx.navigateBack();
  }
});
