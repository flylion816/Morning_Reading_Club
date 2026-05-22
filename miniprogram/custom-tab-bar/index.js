const LIST_GUEST = [
  { pagePath: '/pages/index/index', text: '首页', icon: '', iconPath: '/assets/icons/home.png', selectedIconPath: '/assets/icons/home-active.png' },
  { pagePath: '/pages/periods/periods', text: '晨读营', icon: '', iconPath: '/assets/icons/book.png', selectedIconPath: '/assets/icons/book-active.png' },
  { pagePath: '/pages/profile/profile', text: '我的', icon: '', iconPath: '/assets/icons/my.png', selectedIconPath: '/assets/icons/my-active.png' }
];

const LIST_LOGIN = [
  { pagePath: '/pages/index/index', text: '首页', icon: '', iconPath: '/assets/icons/home.png', selectedIconPath: '/assets/icons/home-active.png' },
  { pagePath: '/pages/periods/periods', text: '晨读营', icon: '', iconPath: '/assets/icons/book.png', selectedIconPath: '/assets/icons/book-active.png' },
  { pagePath: '/pages/zaichang/list/list', text: '在场', icon: '', iconPath: '/assets/icons/zaichang.png', selectedIconPath: '/assets/icons/zaichang-active.png' },
  { pagePath: '/pages/profile/profile', text: '我的', icon: '', iconPath: '/assets/icons/my.png', selectedIconPath: '/assets/icons/my-active.png' }
];

Component({
  data: {
    selected: 0,
    list: LIST_GUEST
  },

  methods: {
    // 各页面 onShow 调用，传入当前页面路径
    setActivePage(pagePath) {
      const canUsePaidFeatures = !!(getApp() && getApp().globalData && getApp().globalData.canUsePaidFeatures);
      const list = canUsePaidFeatures ? LIST_LOGIN : LIST_GUEST;
      const selected = list.findIndex(item => item.pagePath === pagePath);
      this.setData({ list, selected: selected >= 0 ? selected : 0 });
    },

    switchTab(e) {
      const idx = e.currentTarget.dataset.index;
      const url = this.data.list[idx].pagePath;
      wx.switchTab({ url });
      this.setData({ selected: idx });
    }
  }
});

