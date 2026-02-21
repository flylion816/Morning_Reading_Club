// 隐私政策页面
Page({
  data: {},

  onLoad() {
    console.log('隐私政策页面加载');
  },

  /**
   * 返回上一页
   */
  handleBack() {
    wx.navigateBack({
      delta: 1
    });
  }
});
