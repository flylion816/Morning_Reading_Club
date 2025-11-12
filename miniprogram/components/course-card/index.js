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
    onCardTap(e) {
      console.log('===== course-card onCardTap 被调用 =====');
      console.log('this.properties.course:', this.properties.course);
      console.log('this.data:', this.data);

      // 使用properties.course确保获取到正确的数据
      const course = this.properties.course;
      const { isPending } = this.data;

      console.log('准备触发事件，course:', course);
      console.log('准备触发事件，isPending:', isPending);

      this.triggerEvent('tap', {
        course,
        isPending
      });

      console.log('事件已触发');
    },

    /**
     * 点击操作按钮
     */
    onActionTap(e) {
      // catchtap已经阻止冒泡，不需要再调用stopPropagation
      // 使用properties.course确保获取到正确的数据
      const course = this.properties.course;
      const { isPending } = this.data;

      console.log('操作按钮被点击，course:', course);

      this.triggerEvent('action', {
        course,
        isPending,
        action: isPending ? 'checkin' : 'makeup'
      });
    }
  }
});
