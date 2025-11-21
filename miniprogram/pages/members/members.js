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

      // 转换数据
      const members = res.list.map(item => ({
        userId: item.userId,
        nickname: item.nickname,
        avatar: item.avatar,
        avatarUrl: item.avatarUrl,
        avatarColor: getAvatarColorByUserId(item.userId),
        avatarText: item.nickname.charAt(item.nickname.length - 1),
        enrolledAt: new Date(item.enrolledAt).toLocaleDateString('zh-CN')
      }));

      this.setData({
        members: reset ? members : [...this.data.members, ...members],
        totalMembers: res.total,
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
  }
});
