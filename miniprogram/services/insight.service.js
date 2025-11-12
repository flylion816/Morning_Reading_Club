/**
 * 小凡看见服务
 * 处理AI个性化反馈相关的API请求
 */

const request = require('../utils/request');
const envConfig = require('../config/env');
const mockInsights = require('../mock/insights');

class InsightService {
  /**
   * 获取我的小凡看见列表
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getMyInsights(params = {}) {
    return request.get('/insights/my', params);
  }

  /**
   * 获取小凡看见列表（用于insights页面）
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getInsightsList(params = {}) {
    // Mock模式
    if (envConfig.useMock) {
      return Promise.resolve(mockInsights.list);
    }

    return request.get('/insights', params);
  }

  /**
   * 获取小凡看见详情
   * @param {number} insightId 反馈ID
   * @returns {Promise}
   */
  getInsightDetail(insightId) {
    // Mock模式
    if (envConfig.useMock) {
      const insight = mockInsights.list.find(item => item.id == insightId);
      return Promise.resolve(insight || mockInsights.list[0]);
    }

    return request.get(`/insights/${insightId}`);
  }

  /**
   * 点赞小凡看见
   * @param {number} insightId 反馈ID
   * @returns {Promise}
   */
  likeInsight(insightId) {
    return request.post(`/insights/${insightId}/like`);
  }

  /**
   * 取消点赞
   * @param {number} insightId 反馈ID
   * @returns {Promise}
   */
  unlikeInsight(insightId) {
    return request.delete(`/insights/${insightId}/like`);
  }

  /**
   * 分享小凡看见
   * @param {number} insightId 反馈ID
   * @returns {Promise}
   */
  shareInsight(insightId) {
    return request.post(`/insights/${insightId}/share`);
  }

  /**
   * 请求查看他人的小凡看见
   * @param {number} insightId 反馈ID
   * @param {string} message 申请留言
   * @returns {Promise}
   */
  requestInsightPermission(insightId, message = '') {
    return request.post(`/insights/${insightId}/request`, { message });
  }

  /**
   * 获取我收到的权限请求列表
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getReceivedRequests(params = {}) {
    return request.get('/insights/requests/received', params);
  }

  /**
   * 获取我发出的权限请求列表
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getSentRequests(params = {}) {
    return request.get('/insights/requests/sent', params);
  }

  /**
   * 批准权限请求
   * @param {number} requestId 请求ID
   * @returns {Promise}
   */
  approveRequest(requestId) {
    return request.post(`/insights/requests/${requestId}/approve`);
  }

  /**
   * 拒绝权限请求
   * @param {number} requestId 请求ID
   * @param {string} reason 拒绝原因
   * @returns {Promise}
   */
  rejectRequest(requestId, reason = '') {
    return request.post(`/insights/requests/${requestId}/reject`, { reason });
  }

  /**
   * 获取广场小凡看见列表(公开的)
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getPublicInsights(params = {}) {
    return request.get('/insights/public', params);
  }

  /**
   * 生成分享卡片数据
   * @param {number} insightId 反馈ID
   * @returns {Promise}
   */
  generateShareCard(insightId) {
    return request.get(`/insights/${insightId}/share-card`);
  }
}

module.exports = new InsightService();
