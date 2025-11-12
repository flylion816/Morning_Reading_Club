/**
 * 用户服务
 * 处理用户信息相关的API请求
 */

const request = require('../utils/request');

class UserService {
  /**
   * 获取当前用户信息
   * @returns {Promise}
   */
  getUserProfile() {
    return request.get('/user/profile');
  }

  /**
   * 更新用户信息
   * @param {Object} data 用户信息
   * @returns {Promise}
   */
  updateUserProfile(data) {
    return request.put('/user/profile', data);
  }

  /**
   * 获取用户统计信息
   * @returns {Promise}
   */
  getUserStats() {
    return request.get('/user/stats');
  }

  /**
   * 获取其他用户信息
   * @param {number} userId 用户ID
   * @returns {Promise}
   */
  getUserById(userId) {
    return request.get(`/users/${userId}`);
  }

  /**
   * 获取用户打卡记录
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getUserCheckins(params = {}) {
    return request.get('/user/checkins', params);
  }

  /**
   * 获取用户课程列表
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getUserCourses(params = {}) {
    return request.get('/user/courses', params);
  }

  /**
   * 获取用户的小凡看见列表
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getUserInsights(params = {}) {
    return request.get('/user/insights', params);
  }

  /**
   * 完善用户注册信息
   * @param {Object} data 用户信息
   * @returns {Promise}
   */
  completeUserInfo(data) {
    return request.post('/user/complete-info', data);
  }
}

module.exports = new UserService();
