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
   * 获取打卡列表（用户的打卡记录）
   * 支持获取统计数据和日历数据
   * @param {Object} params 查询参数
   * @param {string} params.page - 页码
   * @param {string} params.limit - 每页数量
   * @param {string} params.year - 年份（用于日历）
   * @param {string} params.month - 月份（用于日历）
   * @returns {Promise}
   */
  getCheckins(params = {}) {
    return request.get('/checkins/user/', params);
  }

  /**
   * 获取用户打卡记录（带统计和日历）
   * @param {Object} options - 选项
   * @param {string} options.page - 页码
   * @param {string} options.limit - 每页数量
   * @param {string} options.year - 年份
   * @param {string} options.month - 月份
   * @param {string} options.periodId - 期次ID（可选，用于只获取特定期次的打卡记录）
   * @returns {Promise} 返回 { list, stats, calendar, pagination }
   */
  getUserCheckinsWithStats(options = {}) {
    const {
      page = 1,
      limit = 20,
      year,
      month,
      periodId
    } = options;

    const data = {
      page,
      limit
    };

    // 如果提供了年月，添加日历查询
    if (year && month) {
      data.year = year;
      data.month = month;
    }

    // 如果提供了期次ID，只获取该期次的打卡记录
    if (periodId) {
      data.periodId = periodId;
    }

    return this.getCheckins(data);
  }

  /**
   * 获取用户月度打卡日历
   * @param {number} year - 年份
   * @param {number} month - 月份
   * @returns {Promise} 返回日历数据
   */
  getMonthlyCalendar(year, month) {
    return this.getUserCheckinsWithStats({
      page: 1,
      limit: 1,
      year,
      month
    }).then(res => {
      // 返回日历部分（request.js已解包，直接访问res.calendar）
      return res.calendar;
    });
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
