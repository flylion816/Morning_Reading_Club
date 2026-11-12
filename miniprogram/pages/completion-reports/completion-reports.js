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
          ? '这份报告不存在，或者你还不能查看'
          : '没加载出来，稍后再试试';
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
      wx.showToast({ title: '没找到这一期，返回再进一次', icon: 'none' });
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
