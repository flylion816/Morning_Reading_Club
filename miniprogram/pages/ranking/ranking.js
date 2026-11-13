// 排行榜页面
const rankingService = require('./ranking.service');
const { getUserAvatarDisplay } = require('../../utils/avatar');
const {
  getPeriodAccess,
  redirectAfterCommunityDenied
} = require('../../utils/period-access');

const { guardSocialPage } = require('../../utils/social-access');

Page({
  data: {
    socialAccessGranted: false,
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

    // 期次名称
    periodName: '',

    // 参与人数
    participantCount: 0,

    // 排行榜列表
    rankingList: [],

    // 加载状态
    loading: true
  },

  async onLoad(options) {
    if (!guardSocialPage(this)) return;
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
        ...getUserAvatarDisplay(item, {
          userId: item.userId,
          displayName: item.nickname
        })
      }));

      const currentUser = res.currentUser
        ? {
            ...res.currentUser,
            ...getUserAvatarDisplay(res.currentUser, {
              userId: res.currentUser.userId,
              displayName: res.currentUser.nickname
            }),
            rankText: res.currentUser.rank
              ? `我的排名：第${res.currentUser.rank}名`
              : '我的排名：暂未上榜'
          }
        : null;

      this.setData({
        rankingList: list,
        currentUser,
        participantCount: res.total,
        periodName: res.periodName || '',
        loading: false
      });
    } catch (error) {
      console.error('加载同行榜失败:', error);
      wx.showToast({
        title: '加载同行榜失败',
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
   * 点击用户行 - 跳转到他人主页
   */
  handleAvatarClick(e) {
    const userId = e.detail?.userId || e.currentTarget?.dataset?.userId;
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
    const { currentUser, periodName } = this.data;
    const campName = periodName || '七个习惯晨读营';
    let title = `${campName}同行榜，快来一起打卡！`;
    if (currentUser && currentUser.rank) {
      title = `我在${campName}排第${currentUser.rank}名，已写下${currentUser.checkinCount}天，来看看我的晨读记录！`;
    }
    return {
      title,
      path: `/pages/ranking/ranking?periodId=${this.periodId}`
    };
  }
});
