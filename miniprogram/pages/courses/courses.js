// 课节列表页 - 显示某一期的每天课程
const courseService = require('../../services/course.service');
const { getAvatarColorByUserId } = require('../../utils/formatters');
const { getPeriodAccess } = require('../../utils/period-access');
const subscribeAutoTopUp = require('../../utils/subscribe-auto-topup');

// 相对时间格式化（与课程详情页统一）
function formatTime(dateStr) {
  if (!dateStr) return '刚刚';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
    if (diff < 604800) return Math.floor(diff / 86400) + '天前';
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  } catch (e) {
    return '刚刚';
  }
}

const COMMUNITY_AUTO_TOP_UP_SCENES = [
  'comment_received',
  'like_received',
  'next_day_study_reminder'
];
const CHECKIN_CONTENT_FOLD_LINE_LIMIT = 6;
const CHECKIN_CONTENT_FOLD_UNITS_PER_LINE = 18;

function formatAmountInYuan(amountInCents = 0) {
  const normalizedAmount = Number(amountInCents);
  const safeAmount =
    Number.isFinite(normalizedAmount) && normalizedAmount >= 0
      ? normalizedAmount
      : 0;
  return (safeAmount / 100).toFixed(2);
}

Page({
  data: {
    periodId: null,
    periodName: '',
    periodDate: '',
    periodPrice: 0,
    periodPriceDisplay: '0.00',
    sections: [],
    loading: true,
    makeupCount: 99, // 剩余补打卡次数
    allCheckins: [], // 所有打卡记录
    checkinPage: 1, // 当前打卡记录页码
    checkinHasMore: false, // 是否还有更多打卡记录
    checkinLoadingMore: false, // 加载更多中
    checkinTotal: 0, // 打卡记录总数
    currentTab: 'tasks', // 当前选中的tab
    scrollTop: 0, // 滚动位置
    paymentPending: false, // 是否有待支付
    paymentStatus: null, // 当前报名支付状态
    paymentEnrollmentId: '', // 待支付的报名ID
    canAccessCommunity: false, // 是否可访问打卡/社区功能
    communityAccessState: 'locked', // enabled | locked
    headerCollapsed: false, // 滚动时收起头部
    checkinContentExpanded: {}
  },

  onLoad(options) {
    console.log('课节列表页加载', options);
    this._skipNextOnShowRefresh = true;

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
        allCheckins: [],
        checkinPage: 1,
        checkinHasMore: false,
        checkinLoadingMore: false,
        checkinTotal: 0,
        checkinContentExpanded: {}
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
    if (this._skipNextOnShowRefresh) {
      this._skipNextOnShowRefresh = false;
      return;
    }

    // 每次显示页面时重新加载打卡记录
    if (
      this.data.sections.length > 0 &&
      this.data.communityAccessState === 'enabled'
    ) {
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

  getCheckinContentUnits(text = '') {
    return Array.from(String(text || '')).reduce((sum, char) => {
      return sum + (/[^\x00-\xff]/.test(char) ? 1 : 0.5);
    }, 0);
  },

  estimateCheckinContentLines(text = '') {
    const paragraphs = String(text || '')
      .replace(/\r/g, '')
      .split('\n');

    return paragraphs.reduce((total, paragraph) => {
      const units = this.getCheckinContentUnits(paragraph || ' ');
      return (
        total +
        Math.max(1, Math.ceil(units / CHECKIN_CONTENT_FOLD_UNITS_PER_LINE))
      );
    }, 0);
  },

  shouldFoldCheckinContent(text = '') {
    return (
      this.estimateCheckinContentLines(text) > CHECKIN_CONTENT_FOLD_LINE_LIMIT
    );
  },

  buildCheckinListItem(checkin = {}) {
    const userId = checkin.userId?._id;
    const content = checkin.note || '';
    const id = checkin._id || checkin.id;

    return {
      id,
      userId: userId,
      userName: checkin.userId?.nickname || '用户',
      avatar: checkin.userId?.avatar,
      avatarUrl: checkin.userId?.avatarUrl,
      avatarText: (checkin.userId?.nickname || '用户').slice(-1),
      avatarColor: getAvatarColorByUserId(userId),
      sectionId: checkin.sectionId?._id || checkin.sectionId,
      sectionTitle: checkin.sectionId?.title || '未知课程',
      sectionDay: checkin.sectionId?.day || 0,
      content,
      canExpandContent: this.shouldFoldCheckinContent(content),
      contentExpanded: !!this.data.checkinContentExpanded[id],
      readingTime: checkin.readingTime,
      completionRate: checkin.completionRate,
      mood: checkin.mood,
      createTime: formatTime(checkin.createdAt),
      timestamp: new Date(checkin.createdAt).getTime()
    };
  },

  syncCheckinContentExpandedState(checkinId, expanded) {
    if (!checkinId) {
      return;
    }

    const nextExpandedMap = {
      ...this.data.checkinContentExpanded,
      [checkinId]: expanded
    };

    this.setData({
      checkinContentExpanded: nextExpandedMap,
      allCheckins: (this.data.allCheckins || []).map((item) => {
        if (String(item.id) !== String(checkinId)) {
          return item;
        }

        return {
          ...item,
          contentExpanded: expanded
        };
      })
    });
  },

  toggleCheckinContent(e) {
    const { checkinId } = e.currentTarget.dataset;
    const expanded = !this.data.checkinContentExpanded[checkinId];
    this.syncCheckinContentExpandedState(checkinId, expanded);
  },

  /**
   * 加载课节列表
   */
  async loadSections() {
    this.setData({ loading: true });

    try {
      const [res, currentPeriod] = await Promise.all([
        courseService.getPeriodSections(this.data.periodId),
        courseService.getPeriodDetail(this.data.periodId)
      ]);
      const sections = res.list || res.items || res || [];

      // 格式化日期（只显示到日期部分，去掉时间）
      const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return dateStr.split('T')[0]; // 取 T 之前的部分
      };

      this.setData({
        sections,
        loading: false,
        periodName: currentPeriod
          ? currentPeriod.title || currentPeriod.name || '晨读营'
          : '晨读营',
        periodPrice: currentPeriod ? Number(currentPeriod.price || 0) : 0,
        periodPriceDisplay: formatAmountInYuan(
          currentPeriod ? Number(currentPeriod.price || 0) : 0
        ),
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
   * 加载所有课节的打卡记录（支持分页）
   * @param {boolean} loadMore 是否加载更多（追加），false为重新加载
   */
  async loadAllCheckins(loadMore = false) {
    if (this.data.checkinLoadingMore) return;

    const page = loadMore ? this.data.checkinPage + 1 : 1;
    this.setData({ checkinLoadingMore: true });

    try {
      const res = await courseService.getPeriodCheckins(this.data.periodId, {
        page,
        limit: 10
      });
      const checkins = res.list || res.items || res.data || res || [];
      const pagination = res.pagination || {};
      const hasMore = pagination.hasNext || false;
      const total =
        pagination.total ||
        (loadMore ? this.data.checkinTotal : checkins.length);

      const newItems = checkins.map((checkin) =>
        this.buildCheckinListItem(checkin)
      );
      const allCheckins = loadMore
        ? [...this.data.allCheckins, ...newItems]
        : newItems;

      this.setData({
        allCheckins,
        checkinPage: page,
        checkinHasMore: hasMore,
        checkinTotal: total,
        checkinLoadingMore: false
      });
    } catch (error) {
      console.error('获取打卡记录失败:', error);
      this.setData({
        checkinLoadingMore: false,
        ...(loadMore ? {} : { allCheckins: [], checkinTotal: 0 })
      });
    }
  },

  /**
   * 加载更多打卡记录
   */
  handleLoadMoreCheckins() {
    if (this.data.checkinHasMore && !this.data.checkinLoadingMore) {
      this.loadAllCheckins(true);
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
        setTimeout(() => {
          this.setData({ scrollTop: 0 });
        }, 50);
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
        query.exec((res) => {
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
  async handleSectionClick(e) {
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

    await subscribeAutoTopUp.maybeAutoTopUpSubscriptions({
      sourceAction: 'courses_section_click',
      periodId: this.data.periodId,
      sectionId,
      courseId: sectionId,
      sourcePage: 'courses',
      sceneKeys: COMMUNITY_AUTO_TOP_UP_SCENES,
      requestMode: 'any'
    });

    // 跳转到课程详情页（学习内容）
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${sectionId}&periodId=${this.data.periodId}`
    });
  },

  /**
   * 点击"去打卡"按钮 - 直接跳转到打卡页面
   */
  async handleCheckinClick(e) {
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

    await subscribeAutoTopUp.maybeAutoTopUpSubscriptions({
      sourceAction: 'courses_checkin_click',
      periodId: this.data.periodId,
      sectionId,
      courseId: sectionId,
      sourcePage: 'courses',
      sceneKeys: COMMUNITY_AUTO_TOP_UP_SCENES,
      requestMode: 'any'
    });

    if (this.data.communityAccessState !== 'enabled') {
      wx.navigateTo({
        url: `/pages/course-detail/course-detail?id=${sectionId}&periodId=${this.data.periodId}`
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
    const { paymentEnrollmentId, periodId, periodName, periodPrice } =
      this.data;
    if (!paymentEnrollmentId) return;
    wx.navigateTo({
      url: `/pages/payment/payment?enrollmentId=${paymentEnrollmentId}&periodId=${periodId}&periodTitle=${periodName || ''}&amount=${Number(periodPrice || 0)}`
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

    if (
      scrollTop > lastScrollTop &&
      scrollTop > 80 &&
      !this.data.headerCollapsed
    ) {
      this._scrollDebouncing = true;
      this.setData({ headerCollapsed: true });
      setTimeout(() => {
        this._scrollDebouncing = false;
      }, 400);
    } else if (
      scrollTop < lastScrollTop &&
      scrollTop < 30 &&
      this.data.headerCollapsed
    ) {
      this._scrollDebouncing = true;
      this.setData({ headerCollapsed: false });
      setTimeout(() => {
        this._scrollDebouncing = false;
      }, 400);
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
  },

  handleCheckinItemTap(e) {
    const { checkinId, sectionId } = e.currentTarget.dataset;

    if (!checkinId || !sectionId) {
      wx.showToast({
        title: '缺少详情参数',
        icon: 'none'
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${sectionId}&checkinId=${checkinId}&periodId=${this.data.periodId}`
    });
  }
});
