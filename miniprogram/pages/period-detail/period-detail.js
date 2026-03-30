// 期次介绍页（公开页面，不需要登录）
const courseService = require('../../services/course.service');
const { formatDateRange, calculatePeriodStatus } = require('../../utils/formatters');

function normalizeAmountInCents(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.round(parsed);
}

function formatAmountInYuan(amountInCents = 0) {
  return (normalizeAmountInCents(amountInCents) / 100).toFixed(2);
}

Page({
  data: {
    periodId: '',
    period: null,
    sections: [],
    loading: true,
    statusText: ''
  },

  onLoad(options) {
    console.log('期次介绍页加载，参数:', options);
    if (options.periodId) {
      this.setData({ periodId: options.periodId });
      this.loadPeriodDetail(options.periodId);
    }
  },

  /**
   * 加载期次详情和课程大纲
   */
  async loadPeriodDetail(periodId) {
    this.setData({ loading: true });

    try {
      // 并行加载期次详情和课节列表（都是公开API）
      const [periodRes, sectionsRes] = await Promise.all([
        courseService.getPeriodSections(periodId),
        this.loadPeriodInfo(periodId)
      ]);

      // 处理课节列表（只显示标题，不显示具体内容）
      let sections = periodRes.list || periodRes.items || periodRes || [];
      // 过滤掉 day <= 0 的非正式课节
      sections = sections.filter(s => s.day > 0);
      // 按 day 排序
      sections.sort((a, b) => (a.day || 0) - (b.day || 0));

      this.setData({
        sections,
        loading: false
      });
    } catch (error) {
      console.error('加载期次详情失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 加载期次基本信息
   */
  async loadPeriodInfo(periodId) {
    try {
      const request = require('../../utils/request');
      const res = await request.get(`/periods/${periodId}`);
      const period = res || {};

      // 计算状态
      const startDate = period.startDate || period.startTime;
      const endDate = period.endDate || period.endTime;
      const calculatedStatus = calculatePeriodStatus(startDate, endDate);
      const statusMap = {
        not_started: '未开始',
        ongoing: '进行中',
        completed: '已结束'
      };

      this.setData({
        period: {
          ...period,
          dateRange: formatDateRange(startDate, endDate),
          calculatedStatus,
          priceDisplay: formatAmountInYuan(period.price || 0)
        },
        statusText: statusMap[calculatedStatus] || ''
      });

      // 设置导航栏标题
      wx.setNavigationBarTitle({
        title: period.name || period.title || '期次详情'
      });

      return period;
    } catch (error) {
      console.error('加载期次信息失败:', error);
      return null;
    }
  },

  /**
   * 点击"我要报名"按钮
   */
  handleEnroll() {
    const app = getApp();
    const isLogin = app.globalData.isLogin;
    const periodId = this.data.periodId;

    if (!isLogin) {
      // 未登录：弹窗提示，引导登录
      wx.showModal({
        title: '需要登录',
        content: '报名前需要先登录，是否前往登录？',
        confirmText: '去登录',
        cancelText: '再看看',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: `/pages/login/login?redirect=enrollment&periodId=${periodId}`
            });
          }
        }
      });
      return;
    }

    // 已登录：进入报名页面
    wx.navigateTo({
      url: `/pages/enrollment/enrollment?periodId=${periodId}`
    });
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    const period = this.data.period;
    return {
      title: period ? `${period.name || period.title} - 凡人共读` : '凡人共读',
      path: `/pages/period-detail/period-detail?periodId=${this.data.periodId}`,
      imageUrl: '/assets/images/share-default.png'
    };
  }
});
