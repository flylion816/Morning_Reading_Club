// 期次介绍页：公开期次可以直接阅读，报名后期次才进入报名/支付流程。
const courseService = require('../../services/course.service');
const request = require('../../utils/request');
const { getPeriodAccess } = require('../../utils/period-access');
const { formatDateRange, calculatePeriodStatus } = require('../../utils/formatters');
const { THEME_PRIMARY } = require('../../utils/theme');
const { getLessonNumber, getLessonNumberingBase } = require('../../utils/lesson');
const { getBrandName, getBrandedTitle, getDefaultShareImage } = require('../../utils/brand');
const {
  getPeriodId,
  normalizeReadingAccess,
  getEnrollmentPrice,
  formatAmountInYuan
} = require('../../utils/enrollment-template');

function normalizePeriodTheme(period = {}) {
  // 详情页是统一品牌界面，不继承列表期次图标的自定义颜色。
  return { ...period, displayColor: THEME_PRIMARY };
}

function hasValidEnrollment(access = {}) {
  return !!access.isEnrolled && ['paid', 'free'].includes(access.paymentStatus);
}

function getPeriodName(period = {}) {
  return period.name || period.title || '期次详情';
}

Page({
  data: {
    brandName: getBrandName(),
    periodId: '',
    period: null,
    sections: [],
    loading: true,
    accessLoading: false,
    access: { isEnrolled: false, paymentStatus: null, enrollmentId: '' },
    statusText: '',
    accessError: ''
  },

  onLoad(options = {}) {
    if (options.periodId) {
      this.setData({ periodId: options.periodId });
      this.loadPeriodDetail(options.periodId);
    }
    // 页面内只保留一次期次主标题，系统导航栏使用通用标题。
    wx.setNavigationBarTitle({ title: '期次详情' });
  },

  onShow() {
    if (this.data.periodId && this.data.period && this.isLoggedIn()) {
      this.loadEnrollmentAccess(this.data.periodId);
    }
  },

  isLoggedIn() {
    try {
      return !!getApp().globalData.isLogin;
    } catch (error) {
      return false;
    }
  },

  async loadPeriodDetail(periodId) {
    this.setData({ loading: true, accessError: '' });
    try {
      const [periodRes, period] = await Promise.all([
        courseService.getPeriodSections(periodId),
        this.loadPeriodInfo(periodId)
      ]);
      const rawSections = periodRes?.list || periodRes?.items || periodRes || [];
      const lessonNumberingBase = getLessonNumberingBase(
        (Array.isArray(rawSections) ? rawSections : []).map(section => section.day)
      );
      let sections = Array.isArray(rawSections)
        ? rawSections
          .filter(section => section.day >= 0)
          .map(section => ({
            ...section,
            lessonNumber: getLessonNumber(section.day, lessonNumberingBase)
          }))
          .sort((a, b) => (a.day || 0) - (b.day || 0))
        : [];
      this.setData({ sections, loading: false });
      if (period && this.isLoggedIn()) {
        await this.loadEnrollmentAccess(periodId);
      }
    } catch (error) {
      console.error('加载期次详情失败:', error);
      this.setData({ loading: false });
      wx.showToast({ title: '没加载出来，稍后再试试', icon: 'none' });
    }
  },

  async loadPeriodInfo(periodId) {
    try {
      const period = await request.get(`/periods/${periodId}`) || {};
      const startDate = period.startDate || period.startTime;
      const endDate = period.endDate || period.endTime;
      const calculatedStatus = calculatePeriodStatus(startDate, endDate);
      const reading = normalizeReadingAccess(period);
      const price = getEnrollmentPrice(period);
      const statusMap = {
        not_started: '即将开始',
        ongoing: '正在进行',
        completed: '已结束'
      };
      const normalized = {
        ...normalizePeriodTheme(period),
        dateRange: formatDateRange(startDate, endDate),
        calculatedStatus,
        readingMode: reading.mode,
        readingModeText: reading.label,
        publicReading: reading.isPublic,
        allowEnrollment: reading.allowEnrollment && period.enrollmentOpen !== false,
        enrollmentClosed: period.enrollmentOpen === false,
        priceDisplay: formatAmountInYuan(price.amountInCents),
        feeText: price.display,
        isFree: price.isFree,
        statusText: statusMap[calculatedStatus] || ''
      };
      this.setData({ period: normalized, statusText: normalized.statusText });
      return normalized;
    } catch (error) {
      console.error('加载期次信息失败:', error);
      return null;
    }
  },

  async loadEnrollmentAccess(periodId) {
    this.setData({ accessLoading: true });
    try {
      const access = await getPeriodAccess(periodId);
      this.setData({ access, accessLoading: false, accessError: '' });
      return access;
    } catch (error) {
      console.warn('加载报名状态失败:', error);
      this.setData({
        accessLoading: false,
        accessError: '报名状态暂时不可用',
        access: { isEnrolled: false, paymentStatus: null, enrollmentId: '' }
      });
      return null;
    }
  },

  navigateToCourses() {
    const period = this.data.period || {};
    wx.navigateTo({
      url: `/pages/courses/courses?periodId=${this.data.periodId}&name=${encodeURIComponent(getPeriodName(period))}`
    });
  },

  handlePrimaryAction() {
    const period = this.data.period || {};
    const access = this.data.access || {};
    if (period.publicReading || hasValidEnrollment(access)) {
      this.navigateToCourses();
      return;
    }
    if (access.isEnrolled && access.paymentStatus === 'pending') {
      if (access.enrollmentId) {
        wx.navigateTo({
          url: `/pages/payment/payment?enrollmentId=${access.enrollmentId}&periodId=${this.data.periodId}&periodTitle=${encodeURIComponent(getPeriodName(period))}&startDate=${encodeURIComponent(period.startDate || '')}&endDate=${encodeURIComponent(period.endDate || '')}&amount=${Number(period.price || 0)}`
        });
      } else {
        this.handleEnroll();
      }
      return;
    }
    this.handleEnroll();
  },

  handleEnroll() {
    const period = this.data.period || {};
    if (period.calculatedStatus === 'completed') {
      wx.showToast({ title: '该期课程已结束', icon: 'none' });
      return;
    }
    if (!period.allowEnrollment) {
      wx.showToast({ title: '报名暂未开放', icon: 'none' });
      return;
    }
    if (!this.isLoggedIn()) {
      wx.showModal({
        title: '登录后报名',
        content: '报名需要先登录，公开阅读可以直接开始学习。',
        confirmText: '去登录',
        cancelText: '先阅读',
        success: result => {
          if (result.confirm) {
            wx.navigateTo({ url: `/pages/login/login?redirect=enrollment&periodId=${this.data.periodId}` });
          }
        }
      });
      return;
    }
    wx.navigateTo({ url: `/pages/enrollment/enrollment?periodId=${this.data.periodId}` });
  },

  handleOptionalEnroll() {
    this.handleEnroll();
  },

  onShareAppMessage() {
    const period = this.data.period;
    return {
      title: period ? getBrandedTitle(getPeriodName(period)) : getBrandName(),
      path: `/pages/period-detail/period-detail?periodId=${this.data.periodId}`,
      imageUrl: getDefaultShareImage()
    };
  }
});
