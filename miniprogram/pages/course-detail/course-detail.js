const courseService = require('../../services/course.service');
const constants = require('../../config/constants');

Page({
  data: {
    courseId: null,
    course: {},
    calendar: [],
    checkedDays: 0,
    loading: true
  },

  onLoad(options) {
    this.setData({ courseId: options.id });
    this.loadCourseDetail();
  },

  async loadCourseDetail() {
    try {
      const course = await courseService.getCourseDetail(this.data.courseId);
      const calendar = this.generateCalendar(course);
      const checkedDays = calendar.filter(d => d.status === 'checked').length;

      this.setData({
        course,
        calendar,
        checkedDays,
        loading: false
      });
    } catch (error) {
      console.error('加载课程详情失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  generateCalendar(course) {
    const calendar = [];
    for (let day = 1; day <= constants.COURSE_DURATION; day++) {
      calendar.push({
        day,
        status: day <= (course.currentDay || 0) ? 'checked' : 'pending',
        statusText: day <= (course.currentDay || 0) ? '✓' : ''
      });
    }
    return calendar;
  },

  handleDayClick(e) {
    const { day } = e.currentTarget.dataset;
    console.log('点击第', day.day, '天');
  },

  handleEnroll() {
    wx.showModal({
      title: '确认报名',
      content: '确定要报名该课程吗？',
      success: (res) => {
        if (res.confirm) {
          // TODO: 调用报名API
          wx.showToast({
            title: '报名成功',
            icon: 'success'
          });
        }
      }
    });
  }
});
