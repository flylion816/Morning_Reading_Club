const activityService = require('../../services/activity.service');

Component({
  properties: {
    bottomOffset: {
      type: Number,
      value: 0
    },
    hasTabbar: {
      type: Boolean,
      value: false
    }
  },

  data: {
    active: false,
    playing: false,
    title: '',
    coverUrl: '',
    progress: 0,
    currentTimeText: '0:00',
    posClass: 'podcast-bar-default'
  },

  observers: {
    'hasTabbar, bottomOffset': function(hasTabbar, bottomOffset) {
      const posClass = hasTabbar ? 'podcast-bar-tabbar' : (bottomOffset > 0 ? 'podcast-bar-elevated' : 'podcast-bar-default');
      console.log('[podcast-bar] observer hasTabbar:', hasTabbar, 'bottomOffset:', bottomOffset, '→ posClass:', posClass);
      this.setData({ posClass });
    }
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

  pageLifetimes: {
    show() {
      this._syncFromGlobal();
    }
  },

  methods: {
    _syncFromGlobal() {
      const app = getApp();
      const g = app.globalData;
      // 严格校验：必须有 audioContext 且 podcastActive 且有 url
      if (!g.podcastActive || !g.podcastUrl || !g.audioContext) {
        if (this.data.active) {
          this.setData({ active: false, playing: false, progress: 0, currentTimeText: '0:00' });
        }
        return;
      }
      const duration = g.podcastDuration || 0;
      const current = g.podcastCurrentTime || 0;
      const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
      this.setData({
        active: true,
        playing: !!g.podcastPlaying,
        title: g.podcastTitle || '',
        coverUrl: g.podcastCoverUrl || '/assets/images/fanren-boke.jpg',
        progress,
        currentTimeText: this._formatTime(current)
      });
    },

    _formatTime(seconds) {
      if (!seconds || seconds <= 0) return '0:00';
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${String(s).padStart(2, '0')}`;
    },

    _seekByClientX(clientX) {
      const app = getApp();
      const ctx = app.globalData.audioContext;
      const duration = app.globalData.podcastDuration || 0;
      if (!ctx || !duration) return;
      const query = wx.createSelectorQuery().in(this);
      query.select('.podcast-bar-progress-track').boundingClientRect((rect) => {
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
    },

    handleProgressTap(e) {
      const x = e.detail && e.detail.x !== undefined ? e.detail.x : (e.touches && e.touches[0] ? e.touches[0].clientX : null);
      if (x === null) return;
      this._seekByClientX(x);
    },

    handleProgressDragStart(e) {
      if (e.touches && e.touches[0]) this._seekByClientX(e.touches[0].clientX);
    },

    handleProgressDrag(e) {
      if (e.touches && e.touches[0]) this._seekByClientX(e.touches[0].clientX);
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
        activityService.track('podcast_bar_play');
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
      app.globalData.podcastCoverUrl = '';
      app.globalData.podcastCurrentTime = 0;
      this.setData({ active: false, playing: false, progress: 0, currentTimeText: '0:00' });
    },

    handleBarTap() {
      const app = getApp();
      const sectionId = app.globalData.podcastSectionId;
      if (!sectionId) return;
      wx.navigateTo({ url: `/pages/podcast-player/podcast-player?id=${sectionId}` });
    }
  }
});
