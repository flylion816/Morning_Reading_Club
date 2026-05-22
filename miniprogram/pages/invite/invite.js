const request = require('../../utils/request');
const enrollmentService = require('../../services/enrollment.service');
const { calculatePeriodStatus } = require('../../utils/formatters');

Page({
  data: {
    loading: true,
    period: null,
    inviter: null,
    enrollmentStatus: null, // null | 'enrolled' | 'full' | 'ended'
    periodId: '',
    inviterId: ''
  },

  onLoad(options) {
    const { periodId, inviterId } = options;
    if (!periodId) {
      wx.showToast({ title: '邀请链接无效', icon: 'error' });
      return;
    }
    this.setData({ periodId, inviterId: inviterId || '' });
    this.loadInviteInfo(periodId, inviterId);
  },

  async loadInviteInfo(periodId, inviterId) {
    try {
      const query = inviterId ? `?inviterId=${inviterId}` : '';
      const res = await request.get(`/periods/${periodId}/invite-info${query}`);
      const { period, inviter } = res;

      const status = calculatePeriodStatus(period);
      let enrollmentStatus = 'open';
      if (status === 'completed') {
        enrollmentStatus = 'ended';
      } else if (period.maxEnrollment && period.currentEnrollment >= period.maxEnrollment) {
        enrollmentStatus = 'full';
      }

      this.setData({
        period,
        inviter,
        enrollmentStatus,
        loading: false,
        priceFen: period.price || 0,
        priceYuan: period.price ? (period.price / 100).toFixed(2).replace(/\.?0+$/, '') : 0,
        originalPriceFen: period.originalPrice || 0,
        originalPriceYuan: period.originalPrice ? (period.originalPrice / 100).toFixed(2).replace(/\.?0+$/, '') : 0
      });

      // 检查当前用户是否已报名
      const app = getApp();
      if (app.globalData.userInfo) {
        this.checkCurrentUserEnrollment(periodId);
      }
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: '活动已结束或不存在', icon: 'none' });
    }
  },

  async checkCurrentUserEnrollment(periodId) {
    try {
      const res = await enrollmentService.checkEnrollment(periodId);
      if (res && res.isEnrolled) {
        this.setData({ enrollmentStatus: 'enrolled' });
      }
    } catch (e) {
      // 未登录或未报名，忽略
    }
  },

  onEnroll() {
    const { periodId, inviterId, enrollmentStatus } = this.data;
    if (enrollmentStatus === 'enrolled') {
      wx.switchTab({ url: '/pages/periods/periods' });
      return;
    }
    const referrerId = inviterId ? `&referrerId=${inviterId}` : '';
    wx.navigateTo({
      url: `/pages/enrollment/enrollment?periodId=${periodId}${referrerId}`
    });
  },

  onViewNextPeriod() {
    wx.switchTab({ url: '/pages/periods/periods' });
  },

  onShareAppMessage() {
    const { period, periodId, inviterId } = this.data;
    if (!period) return {};
    const title = period.inviteTitle ||
      `${period.name}·${period.subtitle || period.title || '21天七个习惯晨读营'}`;
    const inviterParam = inviterId ? `&inviterId=${inviterId}` : '';
    return {
      title,
      path: `/pages/invite/invite?periodId=${periodId}${inviterParam}`,
      imageUrl: period.coverImage || '/assets/images/share-default.jpg'
    };
  }
});
