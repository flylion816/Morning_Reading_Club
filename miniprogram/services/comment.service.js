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
}

module.exports = new CommentService();
