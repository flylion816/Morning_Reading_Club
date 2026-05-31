/**
 * 实录报告服务
 */

const request = require('../utils/request');
const envConfig = require('../config/env');

function getApiOrigin() {
  return String(envConfig.apiBaseUrl || '').replace(/\/api\/v\d+\/?$/, '');
}

function buildFileUrl(fileUrl = '') {
  if (!fileUrl) {
    return '';
  }

  if (/^https?:\/\//i.test(fileUrl)) {
    return fileUrl;
  }

  const origin = getApiOrigin();
  if (!origin) {
    return fileUrl;
  }

  return `${origin}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
}

function formatFileSize(size) {
  const bytes = Number(size || 0);
  if (!bytes) {
    return '';
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
}

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function normalizeReport(item = {}) {
  const period = item.period || item.periodId || {};
  const completionReport = item.completionReport || {};
  const periodId =
    item.periodId?._id ||
    item.periodId?.id ||
    item.periodId ||
    period._id ||
    period.id ||
    '';
  const fileUrl = item.fileUrl || completionReport.fileUrl || '';
  const fileSize = item.fileSize || completionReport.fileSize || 0;
  const uploadedAt = item.uploadedAt || completionReport.uploadedAt || '';
  const displayFileName =
    item.originalName ||
    completionReport.originalName ||
    item.fileName ||
    completionReport.fileName ||
    '';

  return {
    ...item,
    periodId,
    periodName:
      item.periodName ||
      period.name ||
      period.title ||
      item.periodTitle ||
      '未知期次',
    reportTitle:
      item.reportTitle ||
      completionReport.title ||
      item.title ||
      '成员分享实录',
    hasReport: item.hasReport === true,
    fileUrl,
    fullFileUrl: buildFileUrl(fileUrl),
    fileName: displayFileName,
    fileSize,
    fileSizeText: formatFileSize(fileSize),
    uploadedAt,
    uploadedAtText: formatDateTime(uploadedAt)
  };
}

module.exports = {
  getMyReports() {
    return request.get('/enrollments/my-completion-reports').then((res) => {
      const list = Array.isArray(res?.list) ? res.list : Array.isArray(res) ? res : [];
      return {
        ...res,
        list: list.map(normalizeReport)
      };
    });
  },

  getReportDetail(periodId) {
    return request
      .get(`/enrollments/my-completion-reports/${periodId}`)
      .then(normalizeReport);
  },

  buildFileUrl,
  formatFileSize,
  formatDateTime,
  normalizeReport
};
