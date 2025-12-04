/**
 * 用户服务
 * 处理用户信息相关的API请求
 */

const request = require('../utils/request');
const envConfig = require('../config/env');

class UserService {
  /**
   * 获取当前用户信息
   * @returns {Promise}
   */
  getUserProfile() {
    // Mock模式
    if (envConfig.useMock) {
      return Promise.resolve(wx.getStorageSync('userInfo') || {
        id: 1,
        nickname: '微信用户',
        avatar: '🦁',
        signature: '天天开心，觉知当下！'
      });
    }
    return request.get('/users/me');
  }

  /**
   * 更新用户信息
   * @param {Object} data 用户信息
   * @returns {Promise}
   */
  updateUserProfile(data) {
    return request.put('/users/profile', data);
  }

  /**
   * 获取用户统计信息
   * @returns {Promise}
   */
  getUserStats(userId) {
    // Mock模式
    if (envConfig.useMock) {
      return Promise.resolve({
        totalDays: 23,
        checkedDays: 4,
        progress: 17,
        continuousDays: 4,
        totalInsights: 2
      });
    }
    // 如果没有传userId，使用当前登录用户的信息
    if (!userId) {
      const userInfo = wx.getStorageSync('userInfo');
      userId = userInfo && userInfo.id ? userInfo.id : 'me';
    }
    return request.get(`/users/${userId}/stats`);
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
    // Mock模式
    if (envConfig.useMock) {
      return Promise.resolve([]);
    }
    return request.get('/user/checkins', params);
  }

  /**
   * 获取用户课程列表
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getUserCourses(params = {}) {
    // Mock模式
    if (envConfig.useMock) {
      const mockCourses = require('../mock/courses');
      return Promise.resolve(mockCourses.list);
    }
    return request.get('/user/courses', params);
  }

  /**
   * 获取用户的小凡看见列表
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getUserInsights(params = {}) {
    // Mock模式
    if (envConfig.useMock) {
      const mockInsights = require('../mock/insights');
      return Promise.resolve(mockInsights.list);
    }
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

  /**
   * 创建小凡看见查看申请
   * @param {string} toUserId 目标用户ID
   * @returns {Promise}
   */
  createInsightRequest(toUserId) {
    return request.post('/insights/requests', { toUserId });
  }
}

module.exports = new UserService();
