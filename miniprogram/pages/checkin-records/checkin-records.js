// 打卡记录页面
const checkinService = require('../../services/checkin.service');
const { getAvatarColorByUserId } = require('../../utils/formatters');

Page({
  data: {
    // 用户信息
    userInfo: null,

    // 期次ID（从URL参数传入）
    periodId: null,

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
    monthText: '', // 用于显示"2025年11月"
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: [], // 日历的日期数组

    // 打卡记录
    checkinRecords: [],

    // 加载状态
    loading: true
  },

  onLoad(options) {
    // 获取URL参数中的periodId
    const periodId = options?.periodId;
    if (periodId) {
      this.setData({ periodId });
    }

    // 获取当前登录用户信息
    const app = getApp();
    if (app.globalData.userInfo) {
      const user = app.globalData.userInfo;
      this.setData({
        userInfo: {
          userName: user.nickname || user.name || '用户',
          avatarColor: getAvatarColorByUserId(user._id),
          avatarText: (user.nickname || user.name || 'U').charAt(0)
        }
      });
    }

    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    });
    this.updateMonthText();
    this.loadCheckinsWithStats();
  },

  /**
   * 更新月份显示文本
   */
  updateMonthText() {
    const { currentYear, currentMonth } = this.data;
    const monthText = `${currentYear}年${currentMonth}月`;
    this.setData({ monthText });
  },

  /**
   * 根据日历数据生成日期数组
   */
  generateCalendarDays(calendar) {
    if (!calendar) {
      return [];
    }

    const year = calendar.year;
    const month = calendar.month;
    const checkinDays = calendar.checkinDays || [];

    // 获取该月的第一天和最后一天
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    // 获取第一天是星期几
    const firstDayOfWeek = firstDay.getDay();

    // 生成日期数组
    const days = [];

    // 添加上月的日期（填充空白）
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        hasCheckin: false,
        date: new Date(year, month - 2, prevMonthLastDay - i)
      });
    }

    // 添加当月的日期
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const hasCheckin = checkinDays.includes(day);
      days.push({
        day,
        isCurrentMonth: true,
        hasCheckin,
        date: new Date(year, month - 1, day)
      });
    }

    // 添加下月的日期（填充空白）
    const totalCells = Math.ceil(days.length / 7) * 7;
    for (let day = 1; days.length < totalCells; day++) {
      days.push({
        day,
        isCurrentMonth: false,
        hasCheckin: false,
        date: new Date(year, month, day)
      });
    }

    return days;
  },

  /**
   * 加载打卡记录和统计数据（使用真实API）
   */
  async loadCheckinsWithStats() {
    this.setData({ loading: true });

    try {
      const params = {
        page: 1,
        limit: 50,
        year: this.data.currentYear,
        month: this.data.currentMonth
      };

      // 如果有periodId，只获取该期次的打卡记录
      if (this.data.periodId) {
        params.periodId = this.data.periodId;
      }

      const res = await checkinService.getUserCheckinsWithStats(params);

      // 生成日历数据
      const calendarDays = this.generateCalendarDays(res.calendar);

      // 转换打卡记录格式
      const checkinRecords = res.list.map(item => {
        // 使用 checkinDate（打卡日期）而不是 createdAt（创建时间）
        const checkinDate = new Date(item.checkinDate);
        const dateStr = `${checkinDate.getFullYear()}-${String(checkinDate.getMonth() + 1).padStart(2, '0')}-${String(checkinDate.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(checkinDate.getHours()).padStart(2, '0')}:${String(checkinDate.getMinutes()).padStart(2, '0')}`;

        return {
          id: item._id,
          date: dateStr,
          time: timeStr,
          courseTitle: item.sectionId?.title || '课程',
          content: item.note || '',
          likeCount: item.likeCount || 0
        };
      });

      this.setData({
        stats: res.stats || {},
        calendarDays,
        checkinRecords,
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
    this.updateMonthText();
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
    this.updateMonthText();
    this.loadCheckinsWithStats();
  }
});
