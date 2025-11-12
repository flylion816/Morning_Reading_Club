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
      this.setData({ insight });
    } catch (error) {
      console.error('加载失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  handleShare() {
    wx.navigateTo({
      url: `/pages/share/share?insightId=${this.data.insightId}`
    });
  }
});
