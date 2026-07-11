const { getBrandName, getDefaultShareTitle, getDefaultShareImage } = require('../../utils/brand');

Page({
  data: {
    brandName: getBrandName(),
    shareContent:
      '感谢你的分享，听你娓娓道来，我仿佛也参与了你们那场深刻的对话。你的总结和感受，本身就是一次非常高质量的内观。'
  },

  onLoad(options) {
    // 根据options加载分享内容
  },

  onShareAppMessage() {
    return {
      title: getDefaultShareTitle(),
      path: '/pages/index/index?from=share',
      imageUrl: getDefaultShareImage()
    };
  }
});
