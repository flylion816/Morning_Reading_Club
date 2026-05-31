const completionReportService = require('../../services/completion-report.service');

Page({
  data: {
    reports: [],
    loading: true,
    error: '',
    empty: false
  },

  onLoad() {
    this.loadReports();
  },

  onPullDownRefresh() {
    this.loadReports().finally(() => {
      wx.stopPullDownRefresh && wx.stopPullDownRefresh();
    });
  },

  async loadReports() {
    this.setData({ loading: true, error: '' });

    try {
      const res = await completionReportService.getMyReports();
      const reports = Array.isArray(res?.list) ? res.list : [];
      this.setData({
        reports,
        empty: reports.length === 0,
        loading: false
      });
    } catch (error) {
      const statusCode = error?.statusCode || error?.status || error?.data?.code;
      const errorText =
        statusCode === 403 || statusCode === 404
          ? '报告不存在或暂无权限'
          : '加载失败，请重试';
      this.setData({
        reports: [],
        empty: false,
        loading: false,
        error: errorText
      });
    }
  },

  handleReportTap(e) {
    const { periodId } = e.currentTarget.dataset || {};
    if (!periodId) {
      wx.showToast({ title: '期次信息不存在', icon: 'none' });
      return;
    }

    wx.navigateTo({
      url: `/pages/completion-report-detail/completion-report-detail?periodId=${periodId}`
    });
  },

  handleRetry() {
    this.loadReports();
  }
});
