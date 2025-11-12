const insightService = require('../../services/insight.service');

Page({
  data: {
    insights: []
  },

  onLoad() {
    this.loadInsights();
  },

  async loadInsights() {
    try {
      const insights = await insightService.getInsightsList();
      this.setData({ insights });
    } catch (error) {
      console.error('加载失败:', error);
    }
  },

  handleInsightClick(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/insight-detail/insight-detail?id=${id}`
    });
  }
});
