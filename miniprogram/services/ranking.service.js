/**
 * 排行榜服务
 */

const request = require('../utils/request');
const apiConfig = require('../config/api.config');

module.exports = {
  /**
   * 获取期次排行榜
   * @param {string} periodId - 期次ID
   * @param {Object} options - 选项
   * @param {string} options.timeRange - 时间范围 (all, thisWeek, lastWeek, today, yesterday)
   * @param {number} options.page - 页码
   * @param {number} options.limit - 每页数量
   * @returns {Promise}
   */
  getPeriodRanking(periodId, options = {}) {
    const { timeRange = 'all', page = 1, limit = 20 } = options;

    return request.request({
      url: `/ranking/period/${periodId}`,
      method: 'GET',
      data: {
        timeRange,
        page,
        limit
      }
    });
  }
};
