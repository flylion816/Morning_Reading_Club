Page({
  data: {
    userId: null,
    userInfo: {},
    stats: {}
  },

  onLoad(options) {
    this.setData({ userId: options.id });
    this.loadUserProfile();
  },

  async loadUserProfile() {
    // TODO: 加载他人资料
  }
});
