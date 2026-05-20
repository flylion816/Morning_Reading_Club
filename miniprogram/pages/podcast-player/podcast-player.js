Page({
  data: {
    sectionId: '',
    title: '',
    description: '',
    playing: false,
    progress: 0,
    currentTimeText: '0:00',
    durationText: '0:00'
  },

  _syncTimer: null,

  onLoad(options) {
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
    }
  },

  handleSeek(e) {
    const app = getApp();
    const ctx = app.globalData.audioContext;
    const duration = app.globalData.podcastDuration || 0;
    if (!ctx || !duration) return;

    const { x } = e.touches ? e.touches[0] : e;
    const query = wx.createSelectorQuery().in(this);
    query.select('.player-progress-track').boundingClientRect((rect) => {
      if (!rect) return;
      const ratio = Math.min(1, Math.max(0, (x - rect.left) / rect.width));
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
