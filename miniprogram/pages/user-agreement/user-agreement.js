// 用户协议页面
const { getBrandName } = require('../../utils/brand');

Page({
  data: {
    brandName: getBrandName()
  },

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
