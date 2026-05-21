Component({
  properties: {
    bottomOffset: {
      type: Number,
      value: 0
    }
  },

  data: {
    active: false,
    playing: false,
    title: '',
    progress: 0,
    barStyle: ''
  },

  lifetimes: {
    attached() {
      this._syncTimer = setInterval(() => this._syncFromGlobal(), 1000);
      this._syncFromGlobal();
    },
    detached() {
      if (this._syncTimer) {
        clearInterval(this._syncTimer);
        this._syncTimer = null;
      }
    }
  },

  methods: {
    _syncFromGlobal() {
      const app = getApp();
      const g = app.globalData;
      const offset = this.properties.bottomOffset || 0;
      const barStyle = offset > 0
        ? `bottom: calc(${offset}rpx + env(safe-area-inset-bottom));`
        : '';
      if (!g.podcastActive) {
        if (this.data.active) this.setData({ active: false, playing: false, progress: 0, barStyle: '' });
        return;
      }
      const duration = g.podcastDuration || 0;
      const current = g.podcastCurrentTime || 0;
      const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
      this.setData({
        active: true,
        playing: !!g.podcastPlaying,
        title: g.podcastTitle || '',
        progress,
        barStyle
      });
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

    handleClose() {
      const app = getApp();
      if (app.globalData.audioContext) {
        app.globalData.audioContext.stop();
        app.globalData.audioContext.destroy();
        app.globalData.audioContext = null;
      }
      app.globalData.podcastActive = false;
      app.globalData.podcastPlaying = false;
      app.globalData.podcastSectionId = '';
      app.globalData.podcastTitle = '';
      app.globalData.podcastUrl = '';
      app.globalData.podcastCurrentTime = 0;
      this.setData({ active: false, playing: false, progress: 0, barStyle: '' });
    },

    handleBarTap() {
      const app = getApp();
      const sectionId = app.globalData.podcastSectionId;
      if (!sectionId) return;
      wx.navigateTo({
        url: `/pages/podcast-player/podcast-player?id=${sectionId}`
      });
    }
  }
});
