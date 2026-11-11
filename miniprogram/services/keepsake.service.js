/**
 * 结营纪念册服务
 */
const request = require('../utils/request');

function getPeriodKeepsake(periodId) {
  return request.get(`/keepsakes/period/${periodId}`, {}, { suppressError: true });
}

module.exports = { getPeriodKeepsake };
