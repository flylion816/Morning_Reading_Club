// Mock课程数据
module.exports = {
  // 课程列表
  list: [
    {
      id: 1,
      title: '开营词',
      period: 1,
      startTime: '2025-11-10 05:59:00',
      endTime: '2025-11-12 05:59:59',
      checkinCount: 2,
      isCheckedIn: false,
      currentDay: 0
    },
    {
      id: 2,
      title: '第一天 品德成功论',
      period: 1,
      startTime: '2025-11-11 06:59:00',
      endTime: '2025-11-13 06:59:59',
      checkinCount: 5,
      isCheckedIn: false,
      currentDay: 1
    },
    {
      id: 3,
      title: '第二天 思维方式的力量',
      period: 1,
      startTime: '2025-11-12 07:00:00',
      endTime: '2025-11-14 07:00:59',
      checkinCount: 5,
      isCheckedIn: false,
      currentDay: 2
    },
    {
      id: 4,
      title: '第三天 以原则为中心的思维方式',
      period: 1,
      startTime: '2025-11-13 07:00:00',
      endTime: '2025-11-15 07:00:59',
      checkinCount: 4,
      isCheckedIn: false,
      currentDay: 3
    },
    {
      id: 5,
      title: '第四天 成长和改变的原则',
      period: 1,
      startTime: '2025-11-14 07:00:00',
      endTime: '2025-11-16 07:00:59',
      checkinCount: 5,
      isCheckedIn: false,
      currentDay: 4
    }
  ],

  // 课程详情
  detail: {
    id: 1,
    title: '七个习惯晨读营',
    period: 1,
    startDate: '2025-11-10',
    endDate: '2025-12-03',
    currentDay: 4,
    isEnrolled: true,
    description: '21天养成阅读习惯'
  }
};
