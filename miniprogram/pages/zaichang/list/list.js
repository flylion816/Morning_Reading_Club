const imprintService = require('../../../services/imprint.service');
const { tenantStorage } = require('../../../utils/storage');
const constants = require('../../../config/constants');

const DEFAULT_ACTIVITY_TYPES = [
  { key: 'all', label: '全部' },
  { key: 'reading', label: '📚 读书会' },
  { key: 'cooking', label: '🍳 做饭' },
  { key: 'tea', label: '☕ 喝茶' },
  { key: 'walk', label: '🚶 散步' },
  { key: 'create', label: '🎨 创作' },
  { key: 'other', label: '✨ 其他' }
];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

Page({
  data: {
    list: [],
    loading: false,
    page: 1,
    pageSize: 10,
    hasMore: true,
    activeType: 'all',
    typeList: DEFAULT_ACTIVITY_TYPES
  },

  onLoad() {
    if (tenantStorage.get(constants.STORAGE_KEYS.TOKEN)) {
      this.loadActivityTypes();
      this.loadList(true);
    }
  },

  onShow() {
    wx.hideTabBar({ animation: false });
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActivePage('/pages/zaichang/list/list');
    }
    // 暂停所有正在播放的视频
    this._pauseAllVideos();
    const needRefresh = wx.getStorageSync('zaichang_need_refresh');
    if (needRefresh) {
      wx.removeStorageSync('zaichang_need_refresh');
      this.loadList(true);
    }
  },

  _pauseAllVideos() {
    const list = this.data.list;
    list.forEach((item, i) => {
      if (item._videoPlaying) {
        wx.createVideoContext(`video-${item._id}`, this).pause();
        this.setData({ [`list[${i}]._videoPlaying`]: false });
      }
    });
  },

  onTapVideoToggle(e) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.list;
    const idx = list.findIndex(item => item._id === id);
    if (idx < 0) return;
    const isPlaying = list[idx]._videoPlaying;
    const ctx = wx.createVideoContext(`video-${id}`, this);
    if (isPlaying) {
      ctx.pause();
      this.setData({ [`list[${idx}]._videoPlaying`]: false });
    } else {
      // 先暂停其他视频
      list.forEach((item, i) => {
        if (i !== idx && item._videoPlaying) {
          wx.createVideoContext(`video-${item._id}`, this).pause();
          this.setData({ [`list[${i}]._videoPlaying`]: false });
        }
      });
      ctx.play();
      this.setData({ [`list[${idx}]._videoPlaying`]: true });
    }
  },

  onVideoPlay(e) {
    // video 组件自身触发 play 事件时同步状态
    const id = e.currentTarget.dataset.id;
    const list = this.data.list;
    const idx = list.findIndex(item => item._id === id);
    if (idx >= 0) this.setData({ [`list[${idx}]._videoPlaying`]: true });
  },

  onPullDownRefresh() {
    this.loadList(true, () => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loading) return;
    this.loadList(false);
  },

  async loadActivityTypes() {
    try {
      const res = await imprintService.getActivityTypes();
      const types = Array.isArray(res) ? res : (res.list || res.data || []);
      if (types.length > 0) {
        const typeList = [{ key: 'all', label: '全部' }, ...types.map(t => ({ key: t.key, label: `${t.emoji} ${t.label}` }))];
        this.setData({ typeList });
      }
    } catch (e) {
      // 降级使用默认列表，不影响页面
    }
  },

  async loadList(reset, callback) {
    if (this.data.loading) return;
    const page = reset ? 1 : this.data.page;
    this.setData({ loading: true });
    try {
      const params = { page, pageSize: this.data.pageSize };
      if (this.data.activeType !== 'all') params.activityType = this.data.activeType;
      const res = await imprintService.list(params);
      const newItems = (res.list || []).map(item => {
        const mediaCount = item.mediaList ? item.mediaList.length : 0;
        const gridCount = Math.min(mediaCount, 9);
        return {
          ...item,
          _happenedAtFormatted: formatDate(item.happenedAt),
          _coverCount: gridCount,
          _gridCols: [2, 4].includes(gridCount) ? 2 : 3,
          _coverPortrait: false,
          _totalReactions: (item.reactionCounts ? (item.reactionCounts.gonming + item.reactionCounts.ran + item.reactionCounts.xiangqu) : 0),
          _imageUrls: (item.mediaList || []).map(m => m.url)
        };
      });
      const list = reset ? newItems : [...this.data.list, ...newItems];
      this.setData({
        list,
        page: page + 1,
        hasMore: newItems.length >= this.data.pageSize,
        loading: false
      });
      // 异步检测单张图方向
      const baseIndex = reset ? 0 : (this.data.list.length - newItems.length);
      newItems.forEach((item, i) => {
        if (item.mediaList && item.mediaList.length === 1) {
          const url = item.mediaList[0].url;
          const listIndex = baseIndex + i;
          wx.getImageInfo({
            src: url,
            success: (info) => {
              const isPortrait = info.height > info.width;
              this.setData({ [`list[${listIndex}]._coverPortrait`]: isPortrait });
            }
          });
        }
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
    if (callback) callback();
  },

  onTypeChange(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.activeType) return;
    this.setData({ activeType: type });
    this.loadList(true);
  },

  onTapCard(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/zaichang/detail/detail?id=${id}` });
  },

  onTapMedia(e) {
    const { item, index } = e.currentTarget.dataset;
    const media = item.mediaList[index];
    if (media && media.type === 'video') {
      wx.previewMedia({ sources: [{ url: media.url, type: 'video' }] });
    } else {
      const imageUrls = (item.mediaList || []).filter(m => m.type !== 'video').map(m => m.url);
      wx.previewImage({ current: media.url, urls: imageUrls });
    }
  },

  onTapPublish() {
    if (!tenantStorage.get(constants.STORAGE_KEYS.TOKEN)) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    wx.navigateTo({ url: '/pages/zaichang/publish/publish' });
  }
});
