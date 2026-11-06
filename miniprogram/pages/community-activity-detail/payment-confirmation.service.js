const request = require('../../utils/request');

module.exports = {
  confirmPayment(paymentId, data = {}) {
    // 微信支付已成功后的后台核验：失败时由回调兜底，不弹错误提示打扰用户
    return request.post(`/payments/${paymentId}/confirm`, data, { suppressError: true });
  }
};
