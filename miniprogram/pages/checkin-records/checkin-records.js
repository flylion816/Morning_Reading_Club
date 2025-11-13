// 打卡记录页面
Page({
  data: {
    periodId: null,

    // 用户信息
    userInfo: {
      userId: 1000,
      userName: '我',
      avatarText: '我',
      avatarColor: '#4a90e2'
    },

    // 统计数据
    stats: {
      diaryCount: 12,
      featuredCount: 3,
      likeCount: 28,
      totalDays: 12,
      consecutiveDays: 5
    },

    // 日历数据
    currentYear: 2025,
    currentMonth: '2025年1月',
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: [],

    // 打卡记录
    checkinRecords: []
  },

  onLoad(options) {
    console.log('打卡记录页面加载', options);
    if (options.periodId) {
      this.setData({ periodId: parseInt(options.periodId) });
    }

    this.initCalendar();
    this.loadCheckinRecords();
  },

  /**
   * 初始化日历
   */
  initCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    this.generateCalendar(year, month);
  },

  /**
   * 生成日历数据
   */
  generateCalendar(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay(); // 0 = Sunday

    const calendarDays = [];

    // 填充上个月的日期
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      calendarDays.push({
        date: `${year}-${month}-${prevMonthLastDay - i}`,
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        hasCheckin: false
      });
    }

    // 填充当月日期
    // Mock：假设第 1, 3, 5, 8, 10, 12, 15, 18, 20, 22, 25, 28 天有打卡
    const checkinDays = [1, 3, 5, 8, 10, 12, 15, 18, 20, 22, 25, 28];
    for (let i = 1; i <= daysInMonth; i++) {
      calendarDays.push({
        date: `${year}-${month + 1}-${i}`,
        day: i,
        isCurrentMonth: true,
        hasCheckin: checkinDays.includes(i)
      });
    }

    // 填充下个月的日期
    const remainingDays = 42 - calendarDays.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      calendarDays.push({
        date: `${year}-${month + 2}-${i}`,
        day: i,
        isCurrentMonth: false,
        hasCheckin: false
      });
    }

    this.setData({
      currentYear: year,
      currentMonth: `${year}年${month + 1}月`,
      calendarDays
    });
  },

  /**
   * 上一个月
   */
  handlePrevMonth() {
    let { currentYear } = this.data;
    const monthMatch = this.data.currentMonth.match(/(\d+)月/);
    let month = parseInt(monthMatch[1]) - 1;

    if (month === 0) {
      month = 12;
      currentYear -= 1;
    }

    this.generateCalendar(currentYear, month - 1);
  },

  /**
   * 下一个月
   */
  handleNextMonth() {
    let { currentYear } = this.data;
    const monthMatch = this.data.currentMonth.match(/(\d+)月/);
    let month = parseInt(monthMatch[1]) - 1;

    if (month === 11) {
      month = -1;
      currentYear += 1;
    }

    this.generateCalendar(currentYear, month + 1);
  },

  /**
   * 加载打卡记录
   */
  loadCheckinRecords() {
    // 从本地存储读取打卡记录
    const allCheckins = wx.getStorageSync('all_checkins') || [];

    // 格式化为按日期分组的记录
    const records = allCheckins.map(checkin => {
      const createTime = checkin.createTime || '刚刚';
      let date = '今天';
      let time = createTime;

      // 简单的日期解析（根据实际数据格式调整）
      if (createTime.includes('-')) {
        const parts = createTime.split(' ');
        date = parts[0] || '今天';
        time = parts[1] || '';
      }

      return {
        id: checkin.id,
        date: date,
        time: time,
        courseTitle: checkin.courseTitle || checkin.sectionTitle || '未知课程',
        content: checkin.content,
        likeCount: checkin.likeCount || 0
      };
    });

    this.setData({
      checkinRecords: records
    });
  }
});
