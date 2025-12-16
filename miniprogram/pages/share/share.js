Page({
  data: {
    shareContent:
      '感谢你的分享，听你娓娓道来，我仿佛也参与了你们那场深刻的对话。你的总结和感受，本身就是一次非常高质量的内观。'
  },

  onLoad(options) {
    // 根据options加载分享内容
  },

  onShareAppMessage() {
    return {
      title: '小凡看见 - 晨读营',
      path: '/pages/index/index',
      imageUrl: '/assets/images/share-default.png'
    };
  }
});
