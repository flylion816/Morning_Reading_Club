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
      url: '/enrollments/',
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
    const { page = 1, limit = 20, sortBy = 'enrolledAt' } = options;

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
    const { page = 1, limit = 20, status } = options;

    const data = { page, limit };
    if (status) {
      data.status = status;
    }

    return request.request({
      url: '/enrollments/user',
      method: 'GET',
      data
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
  },

  /**
   * 获取可报名的期次列表
   * @returns {Promise}
   */
  getPeriods() {
    return request.get('/periods');
  },

  /**
   * 提交报名表单
   * @param {Object} data - 报名数据
   * @returns {Promise}
   */
  submitEnrollment(data) {
    return request.post('/enrollments', data);
  },

  // Stage 3 Test Methods
  /**
   * 获取期次列表
   * @param {Object} options - 选项
   * @returns {Promise}
   */
  getPeriodsList(options = {}) {
    return request.get('/periods', options);
  },

  /**
   * 获取期次详情
   * @param {string} periodId - 期次ID
   * @returns {Promise}
   */
  getPeriodDetails(periodId) {
    return request.get(`/periods/${periodId}`);
  },

  /**
   * 获取我的报名列表
   * @param {Object} options - 选项
   * @returns {Promise}
   */
  getMyEnrollments(options = {}) {
    return request.get('/enrollments/me', options);
  },

  /**
   * 取消报名
   * @param {string} enrollmentId - 报名ID
   * @returns {Promise}
   */
  cancelEnrollment(enrollmentId) {
    return request.delete(`/enrollments/${enrollmentId}`);
  },

  /**
   * 获取报名统计
   * @param {string} periodId - 期次ID
   * @returns {Promise}
   */
  getEnrollmentStats(periodId) {
    return request.get(`/enrollments/stats/${periodId}`);
  },

  /**
   * 批量获取期次信息
   * @param {Array} periodIds - 期次ID数组
   * @returns {Promise}
   */
  getMultiplePeriods(periodIds) {
    return request.post('/periods/batch', { periodIds });
  },

  /**
   * 更新报名状态
   * @param {string} enrollmentId - 报名ID
   * @param {string} status - 新状态
   * @returns {Promise}
   */
  updateEnrollmentStatus(enrollmentId, status) {
    return request.put(`/enrollments/${enrollmentId}`, { status });
  }
};
