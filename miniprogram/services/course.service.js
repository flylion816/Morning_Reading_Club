/**
 * 课程服务
 * 处理课程相关的API请求
 */

const request = require('../utils/request');
const envConfig = require('../config/env');
const mockCourses = require('../mock/courses');

class CourseService {
  /**
   * 获取课程列表
   * @param {Object} params 查询参数
   * @returns {Promise}
   */
  getCourses(params = {}) {
    // Mock模式
    if (envConfig.useMock) {
      return Promise.resolve({
        items: mockCourses.list,
        total: mockCourses.list.length
      });
    }

    return request.get('/courses', params);
  }

  /**
   * 获取课程详情
   * @param {number} courseId 课程ID
   * @returns {Promise}
   */
  getCourseDetail(courseId) {
    // Mock模式
    if (envConfig.useMock) {
      return Promise.resolve(mockCourses.detail);
    }

    return request.get(`/courses/${courseId}`);
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
   * 获取课节内容
   * @param {number} sectionId 课节ID
   * @returns {Promise}
   */
  getSectionDetail(sectionId) {
    return request.get(`/sections/${sectionId}`);
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
}

module.exports = new CourseService();
