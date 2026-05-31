const completionReportService = require('../../services/completion-report.service');
const constants = require('../../config/constants');
const envConfig = require('../../config/env');
const { tenantStorage } = require('../../utils/storage');

function callWxApi(apiName, options) {
  return new Promise((resolve, reject) => {
    const api = wx[apiName];
    if (typeof api !== 'function') {
      reject(new Error(`${apiName} unavailable`));
      return;
    }

    api({
      ...options,
      success: resolve,
      fail: reject
    });
  });
}

function buildDownloadHeader() {
  const header = {
    'X-Wx-AppId': envConfig.wxAppId
  };
  const token = tenantStorage.get(constants.STORAGE_KEYS.TOKEN);
  if (token) {
    header.Authorization = `Bearer ${token}`;
  }
  return header;
}

Page({
  data: {
    periodId: '',
    report: null,
    loading: true,
    error: '',
    downloading: false
  },

  onLoad(options = {}) {
    const periodId = options.periodId || '';
    this.setData({ periodId });

    if (!periodId) {
      this.setData({
        loading: false,
        error: '报告不存在或暂无权限'
      });
      return;
    }

    return this.loadReport();
  },

  async loadReport() {
    const { periodId } = this.data;
    if (!periodId) {
      return;
    }

    this.setData({ loading: true, error: '' });
    this._tempFilePath = '';

    try {
      const report = await completionReportService.getReportDetail(periodId);
      this.setData({
        report,
        loading: false
      });
    } catch (error) {
      const statusCode = error?.statusCode || error?.status || error?.data?.code;
      this.setData({
        report: null,
        loading: false,
        error:
          statusCode === 403 || statusCode === 404
            ? '报告不存在或暂无权限'
            : '加载失败，请重试'
      });
    }
  },

  ensureReportReady() {
    const { report } = this.data;
    if (!report?.hasReport || !report.fullFileUrl) {
      wx.showToast({ title: '报告整理中', icon: 'none' });
      return false;
    }
    return true;
  },

  async getTempFilePath() {
    if (this._tempFilePath) {
      return this._tempFilePath;
    }

    if (!this.ensureReportReady()) {
      throw new Error('report unavailable');
    }

    const { report } = this.data;
    this.setData({ downloading: true });

    try {
      const res = await callWxApi('downloadFile', {
        url: report.fullFileUrl,
        header: buildDownloadHeader()
      });

      if (res.statusCode && res.statusCode >= 400) {
        throw new Error(`download failed: ${res.statusCode}`);
      }

      this._tempFilePath = res.tempFilePath || res.filePath || '';
      if (!this._tempFilePath) {
        throw new Error('missing temp file path');
      }

      return this._tempFilePath;
    } catch (error) {
      wx.showToast({ title: 'PDF 获取失败，请重试', icon: 'none' });
      throw error;
    } finally {
      this.setData({ downloading: false });
    }
  },

  async handleOpenPdf() {
    try {
      const filePath = await this.getTempFilePath();
      await callWxApi('openDocument', {
        filePath,
        fileType: 'pdf',
        showMenu: true
      });
    } catch (error) {
      if (!String(error?.message || '').includes('report unavailable')) {
        console.error('打开实录报告失败:', error);
      }
    }
  },

  async handleShareFile() {
    if (typeof wx.shareFileMessage !== 'function') {
      wx.showToast({
        title: '可在 PDF 预览页右上角菜单分享',
        icon: 'none'
      });
      return;
    }

    try {
      const filePath = await this.getTempFilePath();
      const { report } = this.data;
      await callWxApi('shareFileMessage', {
        filePath,
        fileName: report.fileName || `${report.reportTitle || '实录报告'}.pdf`
      });
    } catch (error) {
      wx.showToast({
        title: '可在 PDF 预览页右上角菜单分享',
        icon: 'none'
      });
    }
  },

  handleRetry() {
    this.loadReport();
  }
});
