Component({
  properties: {
    course: {
      type: Object,
      value: {},
      observer: function (newVal) {
        if (newVal) {
          this.setData({
            isPending: this._checkIsPending(newVal)
          });
        }
      }
    },
    // 模式：period (期次) 或 section (课节)
    mode: {
      type: String,
      value: 'section' // 默认为课节模式
    },
    // 报名信息（期次模式用）
    enrolled: {
      type: Object,
      value: null
    },
    // 是否显示打卡天数（未登录时隐藏）
    showCheckin: {
      type: Boolean,
      value: false
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
      console.log('this.properties.mode:', this.properties.mode);
      console.log('this.properties.enrolled:', this.properties.enrolled);

      // 使用properties.course确保获取到正确的数据
      const course = this.properties.course;
      const { mode, enrolled } = this.properties;
      const { isPending } = this.data;

      // 期次模式
      if (mode === 'period') {
        console.log('📌 期次模式点击');

        const app = getApp();
        const isLogin = app.globalData.isLogin;

        console.log('🔐 course-card 登录状态:', { isLogin });

        // 未登录：进入期次介绍页（公开页面，让用户先浏览）
        if (!isLogin) {
          console.log('📖 未登录，进入期次介绍页');
          wx.navigateTo({
            url: `/pages/period-detail/period-detail?periodId=${course._id}`
          });
          return;
        }

        // 已登录：根据报名状态导航
        const isEnrolled = enrolled && enrolled.isEnrolled;
        const paymentStatus = enrolled && enrolled.paymentStatus;
        const calculatedStatus = course.calculatedStatus;

        console.log('报名信息检查:', { isEnrolled, paymentStatus, enrolled, calculatedStatus });

        if (!isEnrolled) {
          if (calculatedStatus === 'completed') {
            // 已结束未报名 → 进入介绍页查看
            wx.navigateTo({
              url: `/pages/period-detail/period-detail?periodId=${course._id}`
            });
          } else {
            // 未报名 → 导航到报名页面
            console.log('✅ 已登录，导航到报名页面');
            wx.navigateTo({
              url: `/pages/enrollment/enrollment?periodId=${course._id}`
            });
          }
          return;
        }

        // 已报名 → 导航到课程列表
        console.log('✅ 已报名，导航到课程列表，支付状态:', paymentStatus);
        wx.navigateTo({
          url: `/pages/courses/courses?periodId=${course._id}&periodName=${course.name}`
        });
        return;
      }

      // 课节模式：触发自定义事件
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
