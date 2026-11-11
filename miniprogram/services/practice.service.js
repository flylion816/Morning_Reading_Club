/**
 * 实修清单服务
 */
const request = require('../utils/request');

function getCurrent(periodId) {
  return request.get(`/practices/period/${periodId}/current`, {}, { suppressError: true });
}

function setCurrent(periodId, text) {
  return request.put(`/practices/period/${periodId}/current`, { text });
}

function logToday(periodId, done, note = '') {
  return request.put(`/practices/period/${periodId}/today`, { done, note });
}

function getHistory(periodId) {
  return request.get(`/practices/period/${periodId}/history`);
}

module.exports = { getCurrent, setCurrent, logToday, getHistory };
