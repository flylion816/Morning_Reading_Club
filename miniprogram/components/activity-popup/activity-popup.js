Component({
  properties: {
    show: { type: Boolean, value: false },
    activity: { type: Object, value: null }
  },

  computed: {
    typeLabel() {
      const map = { witness: '见证会', chat: '聊天局', cooking: '料理人生', other: '活动' };
      return map[this.properties.activity && this.properties.activity.type] || '活动';
    }
  },

  methods: {
    _typeLabel() {
      const activity = this.data.activity;
      if (!activity) return '活动';
      const map = { witness: '见证会', chat: '聊天局', cooking: '料理人生', other: '活动' };
      return map[activity.type] || '活动';
    },

    _timeText() {
      const activity = this.data.activity;
      if (!activity || !activity.startTime) return '';
      const d = new Date(activity.startTime);
      const mo = d.getMonth() + 1;
      const day = d.getDate();
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${mo}月${day}日 ${h}:${m}`;
    },

    observers: {},

    handleViewDetail() {
      this.triggerEvent('viewdetail', { activity: this.data.activity });
    },

    handleClose() {
      this.triggerEvent('close');
    },

    stopPropagation() {}
  },

  observers: {
    activity(val) {
      if (!val) return;
      const map = { witness: '见证会', chat: '聊天局', cooking: '料理人生', other: '活动' };
      const typeLabel = map[val.type] || '活动';
      let timeText = '';
      if (val.startTime) {
        const d = new Date(val.startTime);
        const mo = d.getMonth() + 1;
        const day = d.getDate();
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        timeText = `${mo}月${day}日 ${h}:${m}`;
      }
      this.setData({ typeLabel, timeText });
    }
  },

  data: {
    typeLabel: '',
    timeText: ''
  }
});
