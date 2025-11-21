// 打卡记录页面
const checkinService = require('../../services/checkin.service');
const { getAvatarColorByUserId } = require('../../utils/formatters');

Page({
  data: {
    periodId: null,

    // 用户信息
    userInfo: null,

    // 统计数据
    stats: {
      diaryCount: 0,
      featuredCount: 0,
      likeCount: 0,
      totalDays: 0,
      consecutiveDays: 0
    },

    // 日历数据
    currentYear: 0,
    currentMonth: 0,
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    calendar: {
      year: 0,
      month: 0,
      checkinDays: []
    },

    // 打卡记录
    checkinRecords: [],

    // 加载状态
    loading: true
  },

  onLoad() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    });
    this.loadCheckinsWithStats();
  },

  /**
   * 加载打卡记录和统计数据（使用真实API）
   */
  async loadCheckinsWithStats() {
    this.setData({ loading: true });

    try {
      const res = await checkinService.getUserCheckinsWithStats({
        page: 1,
        limit: 50,
        year: this.data.currentYear,
        month: this.data.currentMonth
      });

      // 格式化时间
      const records = res.data.list.map(item => ({
        ...item,
        createTime: new Date(item.createdAt).toLocaleString('zh-CN')
      }));

      this.setData({
        stats: res.data.stats,
        calendar: res.data.calendar,
        checkinRecords: records,
        loading: false
      });
    } catch (error) {
      console.error('加载打卡记录失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  /**
   * 上一个月
   */
  handlePrevMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth--;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    }
    this.setData({ currentYear, currentMonth });
    this.loadCheckinsWithStats();
  },

  /**
   * 下一个月
   */
  handleNextMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    this.setData({ currentYear, currentMonth });
    this.loadCheckinsWithStats();
  }
});
