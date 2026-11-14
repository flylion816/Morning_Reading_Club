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
    'avatarText,displayName'(avatarText, displayName) {
      this.setData({
        resolvedAvatarText: getLastTextChars(displayName || avatarText || '', 2, '用')
      });
    }
  },

  methods: {
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
