/**
 * 评论服务
 * 处理评论相关的API请求
 */

const request = require('../utils/request');

class CommentService {
  /**
   * 获取评论列表
   * @param {Object} params 查询参数 {target_type, target_id}
   * @returns {Promise}
   */
  getComments(params) {
    return request.get('/comments', params);
  }

  /**
   * 发表评论
   * @param {Object} data 评论数据
   * @returns {Promise}
   */
  createComment(data) {
    return request.post('/comments', data);
  }

  /**
   * 删除评论
   * @param {number} commentId 评论ID
   * @returns {Promise}
   */
  deleteComment(commentId) {
    return request.delete(`/comments/${commentId}`);
  }

  /**
   * 点赞评论
   * @param {number} commentId 评论ID
   * @returns {Promise}
   */
  likeComment(commentId) {
    return request.post(`/comments/${commentId}/like`);
  }

  /**
   * 取消点赞评论
   * @param {number} commentId 评论ID
   * @returns {Promise}
   */
  unlikeComment(commentId) {
    return request.delete(`/comments/${commentId}/like`);
  }

  /**
   * 回复评论
   * @param {number} commentId 被回复的评论ID
   * @param {Object} data 回复数据
   * @returns {Promise}
   */
  replyComment(commentId, data) {
    return request.post(`/comments/${commentId}/replies`, data);
  }

  /**
   * 获取评论的回复列表
   * @param {number} commentId 评论ID
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getCommentReplies(commentId, params = {}) {
    return request.get(`/comments/${commentId}/replies`, params);
  }

  /**
   * 获取打卡的评论列表
   * @param {string} checkinId 打卡记录ID
   * @param {Object} params 查询参数 {page, limit}
   * @returns {Promise}
   */
  getCommentsByCheckin(checkinId, params = {}) {
    return request.get(`/comments/checkin/${checkinId}`, params);
  }

  // Stage 6 Test Methods
  /**
   * 发布评论
   * @param {string} insightId - Insight ID
   * @param {Object} data - 评论数据
   * @returns {Promise}
   */
  publishComment(insightId, data) {
    return request.post(`/insights/${insightId}/comments`, data);
  }

  /**
   * 获取评论列表
   * @param {string} insightId - Insight ID
   * @param {Object} options - 选项
   * @returns {Promise}
   */
  getCommentsList(insightId, options = {}) {
    return request.get(`/insights/${insightId}/comments`, options);
  }

  /**
   * 更新评论
   * @param {string} commentId - 评论ID
   * @param {Object} data - 更新数据
   * @returns {Promise}
   */
  updateComment(commentId, data) {
    return request.put(`/comments/${commentId}`, data);
  }

  /**
   * 点赞insight
   * @param {string} insightId - Insight ID
   * @returns {Promise}
   */
  likeInsight(insightId) {
    return request.post(`/insights/${insightId}/like`);
  }

  /**
   * 取消点赞insight
   * @param {string} insightId - Insight ID
   * @returns {Promise}
   */
  unlikeInsight(insightId) {
    return request.delete(`/insights/${insightId}/like`);
  }

  /**
   * 获取insight点赞列表
   * @param {string} insightId - Insight ID
   * @param {Object} options - 选项
   * @returns {Promise}
   */
  getInsightLikes(insightId, options = {}) {
    return request.get(`/insights/${insightId}/likes`, options);
  }

  /**
   * 获取互动统计
   * @param {string} insightId - Insight ID
   * @returns {Promise}
   */
  getInteractionStats(insightId) {
    return request.get(`/insights/${insightId}/stats`);
  }

  /**
   * 获取用户互动历史
   * @param {string} userId - 用户ID
   * @returns {Promise}
   */
  getUserInteractionHistory(userId) {
    return request.get(`/users/${userId}/interactions`);
  }

  /**
   * 检查用户点赞状态
   * @param {string} userId - 用户ID
   * @param {string} insightId - Insight ID
   * @returns {Promise}
   */
  checkUserLikeStatus(userId, insightId) {
    return request.get(`/insights/${insightId}/like-status`);
  }

  /**
   * 获取高赞评论
   * @param {string} insightId - Insight ID
   * @returns {Promise}
   */
  getMostLikedComments(insightId) {
    return request.get(`/insights/${insightId}/comments/top-liked`);
  }
}

module.exports = new CommentService();
