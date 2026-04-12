/**
 * 打卡服务
 * 处理打卡相关的API请求
 */

const request = require('../utils/request');
const envConfig = require('../config/env');
const logger = require('../utils/logger');

class CheckinService {
  /**
   * 提交打卡
   * @param {Object} data 打卡数据
   * @returns {Promise}
   */
  submitCheckin(data) {
    if (envConfig.useMock) {
      logger.debug('Mock提交打卡:', data);
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
   * 获取打卡列表（用户的打卡记录）
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getCheckins(params = {}) {
    return request.get('/checkins/user/', params);
  }

  /**
   * 获取用户打卡记录（带统计和日历）
   * @param {Object} options 查询参数
   * @returns {Promise}
   */
  getUserCheckinsWithStats(options = {}) {
    const { page = 1, limit = 20, year, month, periodId } = options;

    const data = {
      page,
      limit
    };

    if (year && month) {
      data.year = year;
      data.month = month;
    }

    if (periodId) {
      data.periodId = periodId;
    }

    return this.getCheckins(data);
  }

  /**
   * 获取“我的打卡日记”概览信息
   * @param {string} userId 用户ID（可选）
   * @returns {Promise}
   */
  getUserDiarySummary(userId = '') {
    const path = userId ? `/checkins/user/${userId}/summary` : '/checkins/user/summary';
    return request.get(path);
  }

  /**
   * 获取用户月度打卡日历
   * @param {number} year 年份
   * @param {number} month 月份
   * @returns {Promise}
   */
  getMonthlyCalendar(year, month) {
    return this.getUserCheckinsWithStats({
      page: 1,
      limit: 1,
      year,
      month
    }).then(res => res.calendar);
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

  // Stage 5 Test Methods
  getCheckinList(options = {}) {
    return request.get('/checkins', options);
  }

  getCheckinStats() {
    return request.get('/checkins/stats');
  }

  getCheckinCountForPeriod(periodId) {
    return request.get(`/checkins/period/${periodId}/count`);
  }

  getCheckinProgress(periodId) {
    return request.get(`/checkins/period/${periodId}/progress`);
  }

  getMultipleCheckins(courseIds) {
    return request.post('/checkins/batch', { courseIds });
  }
}

module.exports = new CheckinService();
