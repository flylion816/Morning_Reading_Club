const { tenantStorage } = require('../../utils/storage');
const constants = require('../../config/constants');
const enrollmentService = require('../../services/enrollment.service');
const { hasPaidEnrollment, redirectAfterCommunityDenied } = require('../../utils/period-access');
const subscribeAutoTopUp = require('../../utils/subscribe-auto-topup');

Page({
  data: {
    checking: true,
    sectionId: '',
    title: '',
    subtitle: '',
    description: '',
    playing: false,
    progress: 0,
    currentTimeText: '0:00',
    durationText: '0:00'
  },

  _syncTimer: null,

  async onLoad(options) {
    const app = getApp();
    // 只允许从 app 内部跳转（有全局音频上下文）进入，否则直接回首页
    if (!app.globalData.audioContext && !app.globalData.podcastUrl) {
      wx.redirectTo({ url: '/pages/index/index' });
      return;
    }
    if (!tenantStorage.get(constants.STORAGE_KEYS.TOKEN)) {
      wx.redirectTo({ url: '/pages/index/index' });
      return;
    }
    const userEnrollments = await enrollmentService
      .getUserEnrollments({ limit: 100 })
      .catch(() => ({ list: [] }));
    const enrollmentList = userEnrollments.list || userEnrollments || [];
    if (!hasPaidEnrollment(enrollmentList)) {
      redirectAfterCommunityDenied('/pages/index/index', '完成支付后可收听播客');
      return;
    }
    this.setData({ checking: false });
    const { id } = options;
    if (id) {
      this.setData({ sectionId: id });
    }
    this._syncFromGlobal();
  },

  onShow() {
    this._syncFromGlobal();
    this._syncTimer = setInterval(() => this._syncFromGlobal(), 500);
  },

  onHide() {
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
  },

  onUnload() {
    if (this._syncTimer) {
      clearInterval(this._syncTimer);
      this._syncTimer = null;
    }
  },

  _syncFromGlobal() {
    const app = getApp();
    const g = app.globalData;
    const duration = g.podcastDuration || 0;
    const current = g.podcastCurrentTime || 0;
    const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
    this.setData({
      title: g.podcastTitle || this.data.title,
      description: g.podcastDescription || this.data.description,
      playing: !!g.podcastPlaying,
      progress,
      currentTimeText: this._formatTime(current),
      durationText: this._formatTime(duration)
    });
  },

  _formatTime(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  },

  handlePlayPause() {
    const app = getApp();
    const ctx = app.globalData.audioContext;
    if (!ctx) return;
    if (app.globalData.podcastPlaying) {
      ctx.pause();
      app.globalData.podcastPlaying = false;
      this.setData({ playing: false });
    } else {
      ctx.play();
      app.globalData.podcastPlaying = true;
      this.setData({ playing: true });
      subscribeAutoTopUp.maybeAutoTopUpSubscriptions({
        sourceAction: 'podcast_player_play',
        sourcePage: 'podcast-player',
        sceneKeys: ['podcast_published'],
        requestMode: 'any'
      });
    }
  },

  handleSeek(e) {
    const x = this._getSeekClientX(e);
    if (x === null) return;
    this._seekByClientX(x);
  },

  handleSeekDragStart(e) {
    const x = this._getSeekClientX(e);
    if (x !== null) this._seekByClientX(x);
  },

  handleSeekDrag(e) {
    const x = this._getSeekClientX(e);
    if (x !== null) this._seekByClientX(x);
  },

  handleSeekDragEnd(e) {
    const x = this._getSeekClientX(e);
    if (x !== null) this._seekByClientX(x);
  },

  _getSeekClientX(e) {
    if (e.touches && e.touches[0]) return e.touches[0].clientX;
    if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0].clientX;
    if (e.detail && e.detail.x !== undefined) return e.detail.x;
    if (e.x !== undefined) return e.x;
    return null;
  },

  _seekByClientX(clientX) {
    const app = getApp();
    const ctx = app.globalData.audioContext;
    const duration = app.globalData.podcastDuration || 0;
    if (!ctx || !duration) return;

    const query = wx.createSelectorQuery().in(this);
    query.select('.player-progress-track').boundingClientRect((rect) => {
      if (!rect) return;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const seekTime = ratio * duration;
      ctx.seek(seekTime);
      app.globalData.podcastCurrentTime = seekTime;
      this.setData({
        progress: ratio * 100,
        currentTimeText: this._formatTime(seekTime)
      });
    }).exec();
  }
});
