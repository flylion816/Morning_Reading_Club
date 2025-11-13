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

  handleBack() {
    wx.navigateBack();
  },

  handleShare() {
    // 简单实现：显示提示，后续可以跳转到分享页面
    wx.showToast({
      title: '分享功能开发中',
      icon: 'none'
    });
    // TODO: 后续实现分享页面
    // wx.navigateTo({
    //   url: `/pages/share/share?insightId=${this.data.insightId}`
    // });
  }
});
