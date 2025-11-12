const checkinService = require('../../services/checkin.service');

Page({
  data: {
    courseId: null,
    dayNumber: 1,
    dayTitle: '',
    content: ''
  },

  onLoad(options) {
    this.setData({
      courseId: options.courseId,
      dayNumber: options.dayNumber || 1,
      dayTitle: options.dayTitle || '品德成功论'
    });
  },

  handleInput(e) {
    this.setData({ content: e.detail.value });
  },

  async handleSubmit() {
    if (this.data.content.length < 50) {
      wx.showToast({ title: '请输入至少50字', icon: 'none' });
      return;
    }

    try {
      await checkinService.submitCheckin({
        courseId: this.data.courseId,
        dayNumber: this.data.dayNumber,
        content: this.data.content
      });

      wx.showToast({ title: '打卡成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (error) {
      wx.showToast({ title: '打卡失败', icon: 'none' });
    }
  }
});
