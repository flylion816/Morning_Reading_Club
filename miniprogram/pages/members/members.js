// 成员列表页面
const enrollmentService = require('../../services/enrollment.service');
const { getAvatarColorByUserId } = require('../../utils/formatters');

Page({
  data: {
    periodId: null,

    // 成员总数
    totalMembers: 0,

    // 成员列表
    members: [],

    // 分页信息
    page: 1,
    limit: 20,

    // 加载状态
    loading: true
  },

  onLoad(options) {
    console.log('成员列表页面加载', options);
    if (options.periodId) {
      this.periodId = options.periodId;
      this.loadMembers();
    }
  },

  /**
   * 加载成员列表（使用真实API）
   */
  async loadMembers(reset = true) {
    if (reset) {
      this.setData({ page: 1, loading: true });
    }

    try {
      const res = await enrollmentService.getPeriodMembers(this.periodId, {
        page: this.data.page,
        limit: this.data.limit
      });

      // 转换数据（兼容两种格式：简化格式和完整对象）
      // 过滤掉 userId 为 null 的记录（用户可能已被删除）
      const members = res.list.filter(item => item.userId != null).map(item => {
        // 兼容处理：如果 userId 是对象，则从对象中获取数据；否则从顶层获取
        const userObj = (typeof item.userId === 'object' && item.userId !== null) ? item.userId : {};
        const userId = (typeof item.userId === 'object' && item.userId !== null) ? item.userId._id : item.userId;
        const nickname = userObj.nickname || item.nickname || '用户';
        const avatar = userObj.avatar || item.avatar || '👤';

        return {
          userId: userId,
          nickname: nickname,
          avatar: avatar,
          avatarUrl: userObj.avatarUrl || item.avatarUrl,
          avatarColor: getAvatarColorByUserId(userId),
          avatarText: nickname.charAt(nickname.length - 1),
          enrolledAt: new Date(item.enrolledAt).toLocaleDateString('zh-CN')
        };
      });

      this.setData({
        members: reset ? members : [...this.data.members, ...members],
        totalMembers: reset ? members.length : this.data.members.length + members.length,
        loading: false
      });
    } catch (error) {
      console.error('加载成员列表失败:', error);
      wx.showToast({
        title: '加载成员列表失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  /**
   * 上拉加载更多
   */
  onReachBottom() {
    if (this.data.page * this.data.limit < this.data.totalMembers) {
      this.setData({ page: this.data.page + 1 });
      this.loadMembers(false);
    }
  },

  /**
   * 点击成员行 - 跳转到他人主页
   */
  handleAvatarClick(e) {
    const { userId } = e.currentTarget.dataset;
    if (!userId) return;
    let url = `/pages/profile-others/profile-others?userId=${userId}`;
    if (this.periodId) {
      url += `&periodId=${this.periodId}`;
    }
    wx.navigateTo({ url });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadMembers(true).finally(() => {
      wx.stopPullDownRefresh();
    });
  }
});
