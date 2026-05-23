const imprintService = require('../../../services/imprint.service');
const enrollmentService = require('../../../services/enrollment.service');
const { hasPaidEnrollment, redirectAfterCommunityDenied } = require('../../../utils/period-access');
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

  async onLoad() {
    if (!tenantStorage.get(constants.STORAGE_KEYS.TOKEN)) return;
    const userEnrollments = await enrollmentService
      .getUserEnrollments({ limit: 100 })
      .catch(() => ({ list: [] }));
    const enrollmentList = userEnrollments.list || userEnrollments || [];
    if (!hasPaidEnrollment(enrollmentList)) {
      redirectAfterCommunityDenied('/pages/index/index', '完成支付后可查看在场');
      return;
    }
    this.loadActivityTypes();
    this.loadList(true);
  },

  onShow() {
    wx.hideTabBar({ animation: false });
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setActivePage('/pages/zaichang/list/list');
    }
    const needRefresh = wx.getStorageSync('zaichang_need_refresh');
    if (needRefresh) {
      wx.removeStorageSync('zaichang_need_refresh');
      this.loadList(true);
    }
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
      if (reset && list.length > 0) {
        const firstImg = (list[0].mediaList || []).find(m => m.type !== 'video');
        if (firstImg) {
          wx.downloadFile({
            url: firstImg.url,
            success: (r) => { if (r.statusCode === 200) this._shareImagePath = r.tempFilePath; }
          });
        }
      }
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

  async onTapPublish() {
    if (!tenantStorage.get(constants.STORAGE_KEYS.TOKEN)) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    const userEnrollments = await enrollmentService
      .getUserEnrollments({ limit: 100 })
      .catch(() => ({ list: [] }));
    const enrollmentList = userEnrollments.list || userEnrollments || [];
    if (!hasPaidEnrollment(enrollmentList)) {
      wx.showToast({ title: '完成支付后可发布印记', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/zaichang/publish/publish' });
  },

  onShareAppMessage() {
    return {
      title: '在场 · 书友们的聚会印记',
      path: '/pages/zaichang/list/list',
      imageUrl: this._shareImagePath || ''
    };
  },

  onShareTimeline() {
    return {
      title: '在场 · 书友们的聚会印记',
      query: '',
      imageUrl: this._shareImagePath || ''
    };
  }
});
