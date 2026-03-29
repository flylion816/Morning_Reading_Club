// 课节列表页 - 显示某一期的每天课程
const courseService = require('../../services/course.service');
const { getAvatarColorByUserId } = require('../../utils/formatters');
const { getPeriodAccess } = require('../../utils/period-access');
const subscribeAutoTopUp = require('../../utils/subscribe-auto-topup');

const COMMUNITY_AUTO_TOP_UP_SCENES = [
  'comment_received',
  'like_received',
  'next_day_study_reminder'
];

Page({
  data: {
    periodId: null,
    periodName: '',
    periodDate: '',
    sections: [],
    loading: true,
    makeupCount: 99, // 剩余补打卡次数
    allCheckins: [], // 所有打卡记录
    currentTab: 'tasks', // 当前选中的tab
    scrollTop: 0, // 滚动位置
    paymentPending: false, // 是否有待支付
    paymentStatus: null, // 当前报名支付状态
    paymentEnrollmentId: '', // 待支付的报名ID
    canAccessCommunity: false, // 是否可访问打卡/社区功能
    communityAccessState: 'locked', // enabled | locked
    headerCollapsed: false // 滚动时收起头部
  },

  onLoad(options) {
    console.log('课节列表页加载', options);

    // 检查登录状态
    const app = getApp();
    if (!app.globalData.isLogin) {
      wx.showToast({
        title: '请先完成首页登录',
        icon: 'none'
      });

      // 延迟返回首页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);

      return;
    }

    if (options.periodId) {
      // 注意：periodId 是 MongoDB ObjectId（字符串），不应该转换为整数
      this.setData({
        periodId: options.periodId,
        paymentPending: false,
        paymentStatus: null,
        paymentEnrollmentId: '',
        canAccessCommunity: false,
        communityAccessState: 'locked',
        currentTab: 'tasks',
        allCheckins: []
      });
      this.loadSections();
      this.checkPaymentStatus();
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
    }
  },

  onShow() {
    // 每次显示页面时重新加载打卡记录
    if (this.data.sections.length > 0 && this.data.communityAccessState === 'enabled') {
      this.loadAllCheckins();
    }
    // 刷新支付状态（从支付页返回后可能已支付）
    if (this.data.periodId) {
      this.checkPaymentStatus();
    }
  },

  onShareAppMessage() {
    return {
      title: this.data.periodName || '凡人共读课程',
      path: `/pages/courses/courses?periodId=${this.data.periodId}`
    };
  },

  onShareTimeline() {
    return {
      title: this.data.periodName || '凡人共读课程',
      query: `periodId=${this.data.periodId}`
    };
  },

  /**
   * 加载课节列表
   */
  async loadSections() {
    this.setData({ loading: true });

    try {
      const res = await courseService.getPeriodSections(this.data.periodId);
      const sections = res.list || res.items || res || [];

      // 获取期次信息用于显示头部
      const periods = await courseService.getPeriods();
      const periodsList = periods.list || periods.items || periods || [];
      const currentPeriod = periodsList.find(
        p => p.id === this.data.periodId || p._id === this.data.periodId
      );

      // 格式化日期（只显示到日期部分，去掉时间）
      const formatDate = dateStr => {
        if (!dateStr) return '';
        return dateStr.split('T')[0]; // 取 T 之前的部分
      };

      this.setData({
        sections,
        loading: false,
        periodName: currentPeriod ? currentPeriod.title : '晨读营',
        periodDate: currentPeriod
          ? `${formatDate(currentPeriod.startDate)} 至 ${formatDate(currentPeriod.endDate)}`
          : ''
      });

      if (this.data.communityAccessState === 'enabled') {
        this.loadAllCheckins();
      }
    } catch (error) {
      console.error('获取课节列表失败:', error);
      this.setData({
        loading: false,
        sections: []
      });

      wx.showToast({
        title: '加载失败,请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 加载所有课节的打卡记录
   */
  async loadAllCheckins() {
    try {
      // 从API获取期次的打卡记录
      const res = await courseService.getPeriodCheckins(this.data.periodId);
      const checkins = res.list || res.items || res || [];

      console.log('从API获取打卡记录:', checkins);
      console.log('打卡记录数量:', checkins.length);

      // 转换数据格式以匹配前端期望
      const allCheckins = checkins.map(checkin => {
        const userId = checkin.userId?._id;
        return {
          id: checkin._id,
          userId: userId,
          userName: checkin.userId?.nickname || '用户',
          avatar: checkin.userId?.avatar,
          avatarUrl: checkin.userId?.avatarUrl,
          avatarText: (checkin.userId?.nickname || '用户').slice(-1),
          // 使用userId生成稳定的头像颜色
          avatarColor: getAvatarColorByUserId(userId),
          sectionId: checkin.sectionId?._id,
          sectionTitle: checkin.sectionId?.title || '未知课程',
          sectionDay: checkin.sectionId?.day || 0,
          content: checkin.note || '',
          readingTime: checkin.readingTime,
          completionRate: checkin.completionRate,
          mood: checkin.mood,
          // 格式化创建时间
          createTime: checkin.createdAt ? new Date(checkin.createdAt).toLocaleString('zh-CN') : '',
          timestamp: new Date(checkin.createdAt).getTime()
        };
      });

      console.log('处理后的打卡记录:', allCheckins);

      this.setData({
        allCheckins
      });
    } catch (error) {
      console.error('获取打卡记录失败:', error);
      this.setData({
        allCheckins: []
      });
    }
  },

  /**
   * Tab 切换
   */
  handleTabChange(e) {
    const { tab } = e.currentTarget.dataset;
    if (tab === 'dynamics' && this.data.communityAccessState !== 'enabled') {
      return;
    }

    this.setData({
      currentTab: tab
    });

    // 使用 SelectorQuery 查询目标元素位置并滚动
    if (tab === 'tasks') {
      // 切换到任务，滚动到顶部
      const oldScrollTop = this.data.scrollTop;

      // 只有在已经为0时才用+1强制触发，否则直接跳0即可
      if (oldScrollTop === 0) {
        this.setData({ scrollTop: 1 });
        setTimeout(() => { this.setData({ scrollTop: 0 }); }, 50);
      } else {
        this.setData({ scrollTop: 0 });
      }
    } else if (tab === 'dynamics') {
      // 延迟执行,确保DOM渲染完成
      setTimeout(() => {
        const query = wx.createSelectorQuery().in(this);
        query.select('#dynamics-section').boundingClientRect();
        query.select('.content-scroll').scrollOffset();
        query.select('.content-scroll').boundingClientRect(); // 新增：获取scroll-view自身的位置
        query.exec(res => {
          if (res[0] && res[1] && res[2]) {
            // 正确计算：当前偏移 + (动态区相对视口位置 - scroll-view相对视口位置)
            const targetTop = res[1].scrollTop + (res[0].top - res[2].top);
            this.setData({ scrollTop: targetTop });
          }
        });
      }, 100);
    }
  },

  /**
   * 跳转到排行榜
   */
  handleRanking() {
    if (this.data.communityAccessState !== 'enabled') {
      wx.showToast({ title: '未支付暂不可互动', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/ranking/ranking?periodId=${this.data.periodId}`
    });
  },

  /**
   * 跳转到打卡记录
   */
  handleCheckinRecords() {
    if (this.data.communityAccessState !== 'enabled') {
      wx.showToast({ title: '未支付暂不可互动', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/checkin-records/checkin-records?periodId=${this.data.periodId}`
    });
  },

  /**
   * 跳转到成员列表
   */
  handleMembers() {
    if (this.data.communityAccessState !== 'enabled') {
      wx.showToast({ title: '未支付暂不可互动', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/members/members?periodId=${this.data.periodId}`
    });
  },

  /**
   * 点击课节卡片 - 跳转到课程详情页
   */
  handleSectionClick(e) {
    const { section } = e.currentTarget.dataset;
    const sectionId = section && (section.id || section._id);

    if (!sectionId) {
      console.error('课节信息不存在');
      wx.showToast({
        title: '课节信息不存在',
        icon: 'none'
      });
      return;
    }

    subscribeAutoTopUp.maybeAutoTopUpSubscriptions({
      sourceAction: 'courses_section_click',
      periodId: this.data.periodId,
      sectionId,
      courseId: sectionId,
      sourcePage: 'courses',
      sceneKeys: COMMUNITY_AUTO_TOP_UP_SCENES
    });

    // 跳转到课程详情页（学习内容）
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${sectionId}`
    });
  },

  /**
   * 点击"去打卡"按钮 - 直接跳转到打卡页面
   */
  handleCheckinClick(e) {
    const { section } = e.currentTarget.dataset;
    const sectionId = section && (section.id || section._id);

    if (!sectionId) {
      console.error('课节信息不存在');
      wx.showToast({
        title: '课节信息不存在',
        icon: 'none'
      });
      return;
    }

    subscribeAutoTopUp.maybeAutoTopUpSubscriptions({
      sourceAction: 'courses_checkin_click',
      periodId: this.data.periodId,
      sectionId,
      courseId: sectionId,
      sourcePage: 'courses',
      sceneKeys: COMMUNITY_AUTO_TOP_UP_SCENES
    });

    if (this.data.communityAccessState !== 'enabled') {
      wx.navigateTo({
        url: `/pages/course-detail/course-detail?id=${sectionId}`
      });
      return;
    }

    // 直接跳转到打卡页面
    wx.navigateTo({
      url: `/pages/checkin/checkin?courseId=${sectionId}&periodId=${this.data.periodId}`
    });
  },

  /**
   * 检查支付状态
   */
  async checkPaymentStatus() {
    try {
      const access = await getPeriodAccess(this.data.periodId);
      const communityEnabled = access.communityAccessState === 'enabled';

      console.log('课程列表权限检查:', {
        periodId: this.data.periodId,
        paymentStatus: access.paymentStatus,
        paymentPending: access.paymentPending,
        communityAccessState: access.communityAccessState,
        canAccessCommunity: access.canAccessCommunity
      });

      this.setData({
        paymentPending: access.paymentPending,
        paymentStatus: access.paymentStatus || null,
        paymentEnrollmentId: access.enrollmentId || '',
        canAccessCommunity: communityEnabled,
        communityAccessState: access.communityAccessState || 'locked',
        currentTab: communityEnabled ? this.data.currentTab : 'tasks'
      });

      if (communityEnabled) {
        if (this.data.sections.length > 0) {
          this.loadAllCheckins();
        }
      } else if (this.data.allCheckins.length > 0) {
        this.setData({
          allCheckins: []
        });
      }
    } catch (error) {
      console.error('检查支付状态失败:', error);
    }
  },

  /**
   * 跳转到支付页面
   */
  navigateToPayment() {
    const { paymentEnrollmentId, periodId, periodName, periodDate } = this.data;
    if (!paymentEnrollmentId) return;
    wx.navigateTo({
      url: `/pages/payment/payment?enrollmentId=${paymentEnrollmentId}&periodId=${periodId}&periodTitle=${periodName || ''}&amount=99`
    });
  },

  /**
   * 滚动事件：向下滚动时收起头部，向上滚动时展开
   * 使用防抖避免 collapse/expand 布局变化触发的二次滚动导致抖动
   */
  onContentScroll(e) {
    if (this._scrollDebouncing) return;

    const scrollTop = e.detail.scrollTop;
    const lastScrollTop = this._lastScrollTop || 0;

    if (scrollTop > lastScrollTop && scrollTop > 80 && !this.data.headerCollapsed) {
      this._scrollDebouncing = true;
      this.setData({ headerCollapsed: true });
      setTimeout(() => { this._scrollDebouncing = false; }, 400);
    } else if (scrollTop < lastScrollTop && scrollTop < 30 && this.data.headerCollapsed) {
      this._scrollDebouncing = true;
      this.setData({ headerCollapsed: false });
      setTimeout(() => { this._scrollDebouncing = false; }, 400);
    }

    this._lastScrollTop = scrollTop;
  },

  /**
   * 返回首页
   */
  handleBack() {
    wx.navigateBack();
  },

  /**
   * 点击打卡人头像 - 跳转到他人主页
   */
  handleAvatarClick(e) {
    const { userId } = e.currentTarget.dataset;
    const { periodId } = this.data;

    console.log('🎯 courses.handleAvatarClick - 构造导航URL');
    console.log('   userId:', userId);
    console.log('   periodId:', periodId);

    if (!userId) {
      console.error('❌ 用户ID不存在');
      return;
    }

    // 跳转到他人主页，同时传递当前期次的ID
    let url = `/pages/profile-others/profile-others?userId=${userId}`;
    if (periodId) {
      url += `&periodId=${periodId}`;
      console.log('✅ 成功添加periodId:', periodId);
    } else {
      console.warn('⚠️ periodId未找到');
    }

    console.log('🔗 最终导航URL:', url);
    wx.navigateTo({ url });
  }
});
