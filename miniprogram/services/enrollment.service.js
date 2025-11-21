/**
 * 报名服务
 */

const request = require('../utils/request');
const apiConfig = require('../config/api.config');

module.exports = {
  /**
   * 报名参加期次
   * @param {string} periodId - 期次ID
   * @returns {Promise}
   */
  enrollPeriod(periodId) {
    return request.request({
      url: `/enrollments/`,
      method: 'POST',
      data: {
        periodId
      }
    });
  },

  /**
   * 获取期次成员列表
   * @param {string} periodId - 期次ID
   * @param {Object} options - 选项
   * @param {number} options.page - 页码
   * @param {number} options.limit - 每页数量
   * @param {string} options.sortBy - 排序字段
   * @returns {Promise}
   */
  getPeriodMembers(periodId, options = {}) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'enrolledAt'
    } = options;

    return request.request({
      url: `/enrollments/period/${periodId}`,
      method: 'GET',
      data: {
        page,
        limit,
        sortBy
      }
    });
  },

  /**
   * 获取用户的报名列表
   * @param {Object} options - 选项
   * @param {number} options.page - 页码
   * @param {number} options.limit - 每页数量
   * @param {string} options.status - 报名状态
   * @returns {Promise}
   */
  getUserEnrollments(options = {}) {
    const {
      page = 1,
      limit = 20,
      status
    } = options;

    return request.request({
      url: `/enrollments/user/`,
      method: 'GET',
      data: {
        page,
        limit,
        status
      }
    });
  },

  /**
   * 检查用户是否已报名
   * @param {string} periodId - 期次ID
   * @returns {Promise}
   */
  checkEnrollment(periodId) {
    return request.request({
      url: `/enrollments/check/${periodId}`,
      method: 'GET'
    });
  },

  /**
   * 退出期次
   * @param {string} enrollmentId - 报名ID
   * @returns {Promise}
   */
  withdrawEnrollment(enrollmentId) {
    return request.request({
      url: `/enrollments/${enrollmentId}`,
      method: 'DELETE'
    });
  }
};
