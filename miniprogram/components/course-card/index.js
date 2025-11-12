Component({
  properties: {
    course: {
      type: Object,
      value: {},
      observer: function(newVal) {
        if (newVal) {
          this.setData({
            isPending: this._checkIsPending(newVal)
          });
        }
      }
    }
  },

  data: {
    isPending: false
  },

  methods: {
    /**
     * 判断课程是否为待打卡状态
     */
    _checkIsPending(course) {
      const now = Date.now();
      const startTime = new Date(course.startTime).getTime();
      const endTime = new Date(course.endTime).getTime();
      // 在时间范围内且未打卡
      return now >= startTime && now <= endTime && !course.isCheckedIn;
    },

    /**
     * 点击卡片
     */
    onCardTap() {
      const { course, isPending } = this.data;
      this.triggerEvent('tap', {
        course,
        isPending
      });
    },

    /**
     * 点击操作按钮
     */
    onActionTap(e) {
      e.stopPropagation();
      const { course, isPending } = this.data;
      this.triggerEvent('action', {
        course,
        isPending,
        action: isPending ? 'checkin' : 'makeup'
      });
    }
  }
});
