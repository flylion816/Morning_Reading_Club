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

      // 期次模式：先检查登录状态
      if (mode === 'period') {
        console.log('📌 期次模式点击');

        // ⭐ 最开始就检查登录状态 - 确保未登录用户无法操作
        const app = getApp();
        const isLogin = app.globalData.isLogin;

        console.log('🔐 [最前置检查] course-card 登录状态:', { isLogin });

        if (!isLogin) {
          console.warn('⚠️ 未登录用户，直接导航到登录页面');
          wx.navigateTo({
            url: '/pages/login/login'
          });
          return;
        }

        // 检查报名状态
        const isEnrolled = enrolled && enrolled.isEnrolled;
        const paymentStatus = enrolled && enrolled.paymentStatus;
        const calculatedStatus = course.calculatedStatus; // 'not_started'|'ongoing'|'completed'

        console.log('报名信息检查:', { isEnrolled, paymentStatus, enrolled, calculatedStatus });

        // 如果未报名，显示不同的提示取决于期次状态
        if (!isEnrolled) {
          if (calculatedStatus === 'completed') {
            // 已结束未报名 → 提示已结束
            wx.showToast({
              title: '此期晨读营已结束，请报名最新一期，谢谢！',
              icon: 'none',
              duration: 2500
            });
          } else {
            // 进行中或未开始未报名 → 导航到报名页面
            // （已在最前面检查过登录状态，这里必定是已登录）
            console.log('✅ 已登录，导航到报名页面');
            wx.navigateTo({
              url: `/pages/enrollment/enrollment?periodId=${course._id}`
            });
          }
          return;
        }

        // 【情况3】已报名且已支付 → 导航到课程列表（无论期次是否已完成）
        if (paymentStatus === 'paid') {
          console.log('✅ 已报名且已支付，导航到课程列表');
          wx.navigateTo({
            url: `/pages/courses/courses?periodId=${course._id}&periodName=${course.name}`
          });
          return;
        }

        // 【情况4】已报名但未支付 或 已退款 → 进入支付页面继续/重新支付
        if (paymentStatus === 'pending' || paymentStatus === 'refunded') {
          console.log('✅ 已报名但未支付或已退款，导航到支付页面');
          // 获取enrollmentId（从enrolled对象中）
          const enrollmentId = enrolled && enrolled.enrollmentId;
          if (!enrollmentId) {
            wx.showToast({
              title: '获取报名信息失败，请重试',
              icon: 'none',
              duration: 2000
            });
            return;
          }
          wx.navigateTo({
            url: `/pages/payment/payment?enrollmentId=${enrollmentId}&periodId=${course._id}&periodTitle=${course.name || ''}&startDate=${course.startTime || course.startDate}&endDate=${course.endTime || course.endDate}&amount=99&isResumePayment=true`
          });
          return;
        }

        // 【情况5】已报名且免费 → 导航到课程列表
        if (paymentStatus === 'free') {
          console.log('✅ 已报名且免费，导航到课程列表');
          wx.navigateTo({
            url: `/pages/courses/courses?periodId=${course._id}&periodName=${course.name}`
          });
          return;
        }

        // 【情况6】其他支付状态 → 异常提示
        console.warn('⚠️ 支付状态异常:', paymentStatus);
        wx.showToast({
          title: '报名状态异常，请联系客服',
          icon: 'none',
          duration: 2000
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
