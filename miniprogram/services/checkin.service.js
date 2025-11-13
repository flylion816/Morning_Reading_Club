/**
 * 打卡服务
 * 处理打卡相关的API请求
 */

const request = require('../utils/request');
const envConfig = require('../config/env');

class CheckinService {
  /**
   * 提交打卡
   * @param {Object} data 打卡数据
   * @returns {Promise}
   */
  submitCheckin(data) {
    // Mock模式
    if (envConfig.useMock) {
      console.log('Mock提交打卡:', data);
      return Promise.resolve({
        id: Date.now(),
        ...data,
        createTime: new Date().toISOString(),
        success: true
      });
    }

    return request.post('/checkins', data);
  }

  /**
   * 获取今日打卡状态
   * @param {number} sectionId 课节ID
   * @returns {Promise}
   */
  getTodayCheckinStatus(sectionId) {
    return request.get('/checkins/today', { section_id: sectionId });
  }

  /**
   * 获取打卡详情
   * @param {number} checkinId 打卡ID
   * @returns {Promise}
   */
  getCheckinDetail(checkinId) {
    return request.get(`/checkins/${checkinId}`);
  }

  /**
   * 获取打卡列表
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getCheckins(params = {}) {
    return request.get('/checkins', params);
  }

  /**
   * 获取打卡统计
   * @param {number} periodId 期次ID
   * @returns {Promise}
   */
  getCheckinStats(periodId) {
    return request.get('/checkins/stats', { period_id: periodId });
  }

  /**
   * 补打卡
   * @param {Object} data 补卡数据
   * @returns {Promise}
   */
  makeupCheckin(data) {
    return request.post('/checkins/makeup', data);
  }

  /**
   * 删除打卡
   * @param {number} checkinId 打卡ID
   * @returns {Promise}
   */
  deleteCheckin(checkinId) {
    return request.delete(`/checkins/${checkinId}`);
  }

  /**
   * 获取连续打卡天数
   * @returns {Promise}
   */
  getStreakDays() {
    return request.get('/checkins/streak');
  }
}

module.exports = new CheckinService();
