/**
 * 课程服务
 * 处理课程相关的API请求
 */

const request = require('../utils/request');
const envConfig = require('../config/env');
const mockCourses = require('../mock/courses');
const logger = require('../utils/logger');

class CourseService {
  /**
   * 获取期次列表（首页显示）
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getPeriods(params = {}) {
    // Mock模式
    if (envConfig.useMock) {
      return Promise.resolve({
        items: mockCourses.periods,
        total: mockCourses.periods.length
      });
    }

    return request.get('/periods', params);
  }

  /**
   * 获取某期的课节列表（课程列表页显示）
   * @param {number} periodId 期次ID
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getPeriodSections(periodId, params = {}) {
    // Mock模式
    if (envConfig.useMock) {
      const sections = mockCourses.sections[periodId] || [];
      return Promise.resolve({
        items: sections,
        total: sections.length
      });
    }

    return request.get(`/sections/period/${periodId}`, params);
  }

  /**
   * 获取课节详情（课程详情页显示）
   * @param {number} sectionId 课节ID
   * @returns {Promise}
   */
  getSectionDetail(sectionId) {
    logger.debug('===== getSectionDetail 被调用 =====');
    logger.debug('sectionId:', sectionId);
    logger.debug('envConfig.useMock:', envConfig.useMock);
    logger.debug('envConfig:', envConfig);

    // Mock模式
    if (envConfig.useMock) {
      logger.debug('使用 Mock 数据，返回:', mockCourses.detail);
      logger.debug('mockCourses.detail.comments:', mockCourses.detail.comments);
      logger.debug('comments 字段是否存在:', 'comments' in mockCourses.detail);
      logger.debug('comments 数组长度:', mockCourses.detail.comments ? mockCourses.detail.comments.length : '不存在');
      return Promise.resolve(mockCourses.detail);
    }

    logger.debug('发起真实请求:', `/sections/${sectionId}`);
    return request.get(`/sections/${sectionId}`);
  }

  /**
   * 获取课程列表（兼容旧接口）
   * @deprecated 使用 getPeriods() 代替
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getCourses(params = {}) {
    return this.getPeriods(params);
  }

  /**
   * 获取课程详情（兼容旧接口）
   * @deprecated 使用 getSectionDetail() 代替
   * @param {number} courseId 课程ID
   * @returns {Promise}
   */
  getCourseDetail(courseId) {
    return this.getSectionDetail(courseId);
  }

  /**
   * 获取当前期次信息
   * @param {number} courseId 课程ID
   * @returns {Promise}
   */
  getCurrentPeriod(courseId) {
    return request.get(`/courses/${courseId}/current-period`);
  }

  /**
   * 报名课程
   * @param {number} periodId 期次ID
   * @param {Object} data 报名信息
   * @returns {Promise}
   */
  enrollCourse(periodId, data = {}) {
    return request.post(`/periods/${periodId}/enroll`, data);
  }

  /**
   * 获取今日课程内容
   * @param {number} periodId 期次ID
   * @returns {Promise}
   */
  getTodaySection(periodId) {
    return request.get(`/periods/${periodId}/today`);
  }

  /**
   * 获取课程进度
   * @param {number} userCourseId 用户课程ID
   * @returns {Promise}
   */
  getCourseProgress(userCourseId) {
    return request.get(`/user-courses/${userCourseId}/progress`);
  }

  /**
   * 获取课程期次列表
   * @param {number} courseId 课程ID
   * @returns {Promise}
   */
  getCoursePeriods(courseId) {
    return request.get(`/courses/${courseId}/periods`);
  }

  /**
   * 获取期次的打卡记录（动态/广场）
   * @param {string} periodId 期次ID
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getPeriodCheckins(periodId, params = {}) {
    return request.get(`/checkins/period/${periodId}`, params);
  }

  /**
   * 获取今日任务（根据当前日期动态计算）
   * 调用后端接口，返回用户当前应该学习的课节
   * @returns {Promise} 返回今日任务数据 {periodId, sectionId, day, title, icon, meditation, question, reflection, action, learn, checkinCount}
   */
  getTodayTask() {
    // 直接调用后端接口，由后端根据用户的报名信息和当前日期计算
    return request.get('/sections/today/task');
  }
}

module.exports = new CourseService();
