/**
 * 支付服务
 */

const request = require('../utils/request');

module.exports = {
  /**
   * 初始化支付（创建订单）
   * @param {Object} data - 支付数据
   * @param {string} data.enrollmentId - 报名ID
   * @param {string} data.paymentMethod - 支付方式
   * @param {number} data.amount - 支付金额
   * @returns {Promise}
   */
  initiatePayment(data) {
    return request.post('/payments', data);
  },

  /**
   * 确认支付
   * @param {string} paymentId - 支付ID
   * @param {Object} data - 确认数据
   * @param {string} data.transactionId - 微信交易ID（可选）
   * @returns {Promise}
   */
  confirmPayment(paymentId, data = {}) {
    return request.post(`/payments/${paymentId}/confirm`, data);
  },

  /**
   * 查询支付状态
   * @param {string} paymentId - 支付ID
   * @returns {Promise}
   */
  getPaymentStatus(paymentId) {
    return request.get(`/payments/${paymentId}`);
  },

  /**
   * 取消支付
   * @param {string} paymentId - 支付ID
   * @returns {Promise}
   */
  cancelPayment(paymentId) {
    return request.post(`/payments/${paymentId}/cancel`);
  },

  /**
   * 获取用户的支付记录列表
   * @param {Object} options - 选项
   * @param {number} options.page - 页码
   * @param {number} options.limit - 每页数量
   * @param {string} options.status - 支付状态
   * @returns {Promise}
   */
  getUserPayments(options = {}) {
    const {
      page = 1,
      limit = 20,
      status
    } = options;

    return request.get('/payments/user/', {
      page,
      limit,
      status
    });
  },

  /**
   * 模拟支付确认（用于开发测试）
   * @param {string} paymentId - 支付ID
   * @returns {Promise}
   */
  mockConfirmPayment(paymentId) {
    return request.post(`/payments/${paymentId}/mock-confirm`);
  }
};
