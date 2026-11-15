const { getLastTextChars } = require('../../utils/avatar');

Component({
  properties: {
    avatarUrl: {
      type: String,
      value: ''
    },
    avatarText: {
      type: String,
      value: '用'
    },
    displayName: {
      type: String,
      value: ''
    },
    avatarColor: {
      type: String,
      value: ''
    },
    userId: {
      type: String,
      value: ''
    },
    size: {
      type: Number,
      value: 72
    },
    shape: {
      type: String,
      value: 'circle'
    },
    customClass: {
      type: String,
      value: ''
    },
    interactive: {
      type: Boolean,
      value: false
    },
    eventData: {
      type: Object,
      value: {}
    }
  },

  data: {
    imageFailed: false,
    resolvedAvatarText: '用'
  },

  observers: {
    avatarUrl() {
      if (this.data.imageFailed) this.setData({ imageFailed: false });
    },
    'avatarText,displayName,size'(avatarText, displayName, size) {
      this.updateAvatarText(avatarText, displayName, size);
    }
  },

  lifetimes: {
    attached() {
      this.updateAvatarText(
        this.data.avatarText,
        this.data.displayName,
        this.data.size
      );
    }
  },

  methods: {
    updateAvatarText(avatarText, displayName, size) {
      // 头像小于等于 64rpx 时，两个汉字会挤在一起，只保留昵称最后一个字。
      const compact = Number(size) <= 64;
      this.setData({
        resolvedAvatarText: getLastTextChars(
          displayName || avatarText || '',
          compact ? 1 : 2,
          '用'
        )
      });
    },

    handleImageError() {
      if (!this.data.imageFailed) this.setData({ imageFailed: true });
    },

    handleTap() {
      if (!this.data.interactive) return;
      this.triggerEvent('avatarTap', {
        ...(this.data.eventData || {}),
        userId: this.data.userId
      });
    }
  }
});
