const insightService = require('../../services/insight.service');

Page({
  data: {
    insightId: null,
    insight: {}
  },

  onLoad(options) {
    this.setData({ insightId: options.id });
    this.loadInsightDetail();
  },

  async loadInsightDetail() {
    try {
      const insight = await insightService.getInsightDetail(this.data.insightId);

      // 添加 dayNumber 字段用于显示
      if (insight && !insight.dayNumber) {
        insight.dayNumber = insight.day || 1;
      }

      this.setData({ insight });
    } catch (error) {
      console.error('加载失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  handleBack() {
    wx.navigateBack();
  },

  /**
   * 分享到微信好友和朋友圈
   */
  onShareAppMessage() {
    const { insight } = this.data;
    return {
      title: `${insight.title || '晨读营'} - 小凡看见`,
      path: `/pages/insight-detail/insight-detail?id=${this.data.insightId}`,
      imageUrl: '/assets/images/share-default.png'
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    const { insight } = this.data;
    return {
      title: `${insight.title || '晨读营'} - 小凡看见`,
      query: `id=${this.data.insightId}`,
      imageUrl: '/assets/images/share-default.png'
    };
  }
});
