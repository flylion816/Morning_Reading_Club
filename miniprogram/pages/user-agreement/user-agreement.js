// 用户协议页面
Page({
  data: {},

  onLoad() {
    console.log('用户协议页面加载');
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
