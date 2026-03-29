// 排行榜页面
const rankingService = require('../../services/ranking.service');
const { getAvatarColorByUserId } = require('../../utils/formatters');
const {
  getPeriodAccess,
  redirectAfterCommunityDenied
} = require('../../utils/period-access');

Page({
  data: {
    periodId: null,

    // Tab选项
    tabs: [
      { label: '总榜', value: 'all' },
      { label: '本周', value: 'thisWeek' },
      { label: '上周', value: 'lastWeek' },
      { label: '今日', value: 'today' },
      { label: '昨日', value: 'yesterday' }
    ],
    currentTab: 'all',

    // 当前用户信息
    currentUser: null,

    // 参与人数
    participantCount: 0,

    // 排行榜列表
    rankingList: [],

    // 加载状态
    loading: true
  },

  async onLoad(options) {
    console.log('排行榜页面加载', options);
    if (options.periodId) {
      const access = await getPeriodAccess(options.periodId);
      if (access.communityAccessState !== 'enabled') {
        redirectAfterCommunityDenied(`/pages/courses/courses?periodId=${options.periodId}`);
        return;
      }

      this.periodId = options.periodId;
      this.loadRanking('all');
    }
  },

  /**
   * 加载排行榜数据（使用真实API）
   */
  async loadRanking(timeRange) {
    this.setData({
      loading: true,
      currentTab: timeRange
    });

    try {
      const res = await rankingService.getPeriodRanking(this.periodId, {
        timeRange,
        page: 1,
        limit: 20
      });

      // 转换数据：添加 avatarColor 和头像文字
      const list = res.list.map(item => ({
        ...item,
        avatarColor: getAvatarColorByUserId(item.userId),
        avatarText: item.nickname.charAt(item.nickname.length - 1)
      }));

      const currentUser = res.currentUser
        ? {
            ...res.currentUser,
            avatarColor: getAvatarColorByUserId(res.currentUser.userId),
            avatarText: res.currentUser.nickname.charAt(res.currentUser.nickname.length - 1)
          }
        : null;

      this.setData({
        rankingList: list,
        currentUser,
        participantCount: res.total,
        loading: false
      });
    } catch (error) {
      console.error('加载排行榜失败:', error);
      wx.showToast({
        title: '加载排行榜失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  /**
   * Tab切换
   */
  handleTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.loadRanking(tab);
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadRanking(this.data.currentTab).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 分享
   */
  handleShare() {
    wx.showToast({
      title: '分享功能待开发',
      icon: 'none'
    });
  },

  /**
   * 点击用户行 - 跳转到他人主页
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
   * 页面分享配置
   */
  onShareAppMessage() {
    return {
      title: '七个习惯晨读营 - 排行榜',
      path: `/pages/ranking/ranking?periodId=${this.data.periodId}`
    };
  }
});
