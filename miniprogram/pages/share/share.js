const { getBrandName, getDefaultShareTitle, getDefaultShareImage } = require('../../utils/brand');

const { guardSocialPage } = require('../../utils/social-access');

Page({
  data: {
    socialAccessGranted: false,
    brandName: getBrandName(),
    shareContent:
      '感谢你的分享，听你娓娓道来，我仿佛也参与了你们那场深刻的对话。你的总结和感受，本身就是一次非常高质量的内观。'
  },

  onLoad(options) {
    if (!guardSocialPage(this)) return;
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
