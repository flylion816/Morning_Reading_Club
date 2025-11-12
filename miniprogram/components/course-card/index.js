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
      // 使用properties.course确保获取到正确的数据
      const course = this.properties.course;
      const { isPending } = this.data;

      console.log('课程卡片被点击:', course);

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
      // 使用properties.course确保获取到正确的数据
      const course = this.properties.course;
      const { isPending } = this.data;

      this.triggerEvent('action', {
        course,
        isPending,
        action: isPending ? 'checkin' : 'makeup'
      });
    }
  }
});
