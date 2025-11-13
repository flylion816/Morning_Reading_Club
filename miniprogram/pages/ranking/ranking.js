// 排行榜页面
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
    currentUser: {
      userId: 1000,
      userName: '我',
      avatarText: '我',
      avatarColor: '#4a90e2',
      rank: 5,
      checkinCount: 12
    },

    // 参与人数
    participantCount: 156,

    // 排行榜列表
    rankingList: []
  },

  onLoad(options) {
    console.log('排行榜页面加载', options);
    if (options.periodId) {
      this.setData({ periodId: parseInt(options.periodId) });
    }

    this.loadRankingData();
  },

  /**
   * 加载排行榜数据
   */
  loadRankingData() {
    const { currentTab } = this.data;

    // Mock 数据 - 后续替换为真实接口
    const mockRankingList = this.generateMockRanking();

    this.setData({
      rankingList: mockRankingList
    });
  },

  /**
   * 生成 Mock 排行榜数据
   */
  generateMockRanking() {
    const colors = ['#4a90e2', '#e74c3c', '#f39c12', '#2ecc71', '#9b59b6', '#1abc9c'];
    const names = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一', '陈十二'];

    const ranking = [];
    for (let i = 0; i < 20; i++) {
      const name = names[i % names.length] + (i >= names.length ? i : '');
      const checkinCount = Math.max(1, 30 - i * 2 - Math.floor(Math.random() * 3));

      ranking.push({
        rank: i + 1,
        userId: 2000 + i,
        userName: name,
        avatarText: name.charAt(name.length - 1),
        avatarColor: colors[i % colors.length],
        checkinCount
      });
    }

    return ranking;
  },

  /**
   * Tab切换
   */
  handleTabChange(e) {
    const { tab } = e.currentTarget.dataset;

    this.setData({
      currentTab: tab
    }, () => {
      this.loadRankingData();
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
   * 页面分享配置
   */
  onShareAppMessage() {
    return {
      title: '七个习惯晨读营 - 排行榜',
      path: `/pages/ranking/ranking?periodId=${this.data.periodId}`
    };
  }
});
