// Mock课程数据（重构为两层结构：期次 + 课节）
const mockData = {
  // 期次列表（首页显示）
  periods: [
    {
      id: 8,
      name: '勇敢的心',
      subtitle: '七个习惯晨读营',
      title: '勇敢的心 - 七个习惯晨读营',
      icon: '⛰️',
      color: 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)',
      startDate: '2025/10/11',
      endDate: '2025/11/13',
      dateRange: '10-11 至 11-13',
      status: 'ongoing',
      statusText: '进行中 0/23',
      checkedDays: 0,
      totalDays: 23,
      progress: 0,
      isEnrolled: true
    },
    {
      id: 9,
      name: '能量之泉',
      subtitle: '七个习惯晨读营',
      title: '能量之泉 - 七个习惯晨读营',
      icon: '🌊',
      color: 'linear-gradient(135deg, #7ed321 0%, #63b520 100%)',
      startDate: '2025/08/09',
      endDate: '2025/09/12',
      dateRange: '08-09 至 09-12',
      status: 'not_enrolled',
      statusText: '未报名',
      checkedDays: 0,
      totalDays: 23,
      progress: 0,
      isEnrolled: false
    },
    {
      id: 10,
      name: '心流之境',
      subtitle: '七个习惯晨读营',
      title: '心流之境 - 七个习惯晨读营',
      icon: '✨',
      color: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)',
      startDate: '2025/06/14',
      endDate: '2025/07/06',
      dateRange: '06-14 至 07-06',
      status: 'completed',
      statusText: '已结束 22/23',
      checkedDays: 22,
      totalDays: 23,
      progress: 96,
      isEnrolled: true
    }
  ],

  // 课节列表（按期次ID分组）
  sections: {
    // 第8期（勇敢的心）的课节
    8: [
      {
        id: 801,
        periodId: 8,
        title: '开营词',
        day: 0,
        startTime: '2025/10/10 05:59:00',
        endTime: '2025/10/12 05:59:59',
        dateRange: '10-10 至 10-12',
        checkinCount: 2,
        isCheckedIn: false
      },
      {
        id: 802,
        periodId: 8,
        title: '第一天 品德成功论',
        day: 1,
        startTime: '2025/10/11 06:59:00',
        endTime: '2025/10/13 06:59:59',
        dateRange: '10-11 至 10-13',
        checkinCount: 5,
        isCheckedIn: true
      },
      {
        id: 803,
        periodId: 8,
        title: '第二天 思维方式的力量',
        day: 2,
        startTime: '2025/10/12 07:00:00',
        endTime: '2025/10/14 07:00:59',
        dateRange: '10-12 至 10-14',
        checkinCount: 5,
        isCheckedIn: false
      },
      {
        id: 804,
        periodId: 8,
        title: '第三天 以原则为中心的思维方式',
        day: 3,
        startTime: '2025/10/13 07:00:00',
        endTime: '2025/10/15 07:00:59',
        dateRange: '10-13 至 10-15',
        checkinCount: 4,
        isCheckedIn: false
      },
      {
        id: 805,
        periodId: 8,
        title: '第四天 成长和改变的原则',
        day: 4,
        startTime: '2025/10/14 07:00:00',
        endTime: '2025/10/16 07:00:59',
        dateRange: '10-14 至 10-16',
        checkinCount: 5,
        isCheckedIn: false
      }
    ]
  },

  // 课程详情
  detail: {
    id: 802,
    title: '第一天 品德成功论',
    periodId: {
      _id: 8,
      name: '勇敢的心',
      title: '勇敢的心 - 七个习惯晨读营'
    },
    day: 1,
    startDate: '2025/10/11',
    endDate: '2025/10/13',
    currentDay: 4,
    isEnrolled: true,
    description: '21天养成阅读习惯',

    // 五大学习模块
    meditation: '开始学习之前，给自己1分钟的时间，深呼吸，静静心，然后开始学习。',

    question: '带着问题学习：品德成功论和个性成功论有什么区别？哪一个更本质？',

    content: `<p>纵观历史，成功学著作有两种截然不同的思想体系。</p>

<p>美国建国以来的 150 年里，<strong style="color: #4a90e2;">成功学著作重视品德，强调诚信、谦虚、忠诚、节制、勇气、正义、耐心、勤勉、朴素以及黄金法则。</strong></p>

<p>但在此后不久，成功学的基调突然发生了变化，从"品德成功论"转向"个性成功论"。</p>

<p>现在的成功学著作着重于社交形象、态度与行为、技巧与手段，以便应用于人际关系、销售等。然而在相互依赖的环境中，单凭技巧与手段很难获得成功。要想获得持久的成功，关键在于培养优秀的品德。</p>

<p><strong style="color: #4a90e2;">品德是真正的根本，它在每个人内心深处起作用，会影响我们如何看待世界。</strong>品德犹如灯塔，是永恒不变的原则，能帮助我们建立一张无懈可击的人生地图。</p>

<p>个性成功论的技巧也能发挥作用，但只有在品德成功论的基础之上才是有用的。</p>`,

    reflection:
      '上文中，哪一句话特别触动我？引起了我哪些感触？我的生活中有哪些例子可以印证品德成功论的重要性？',

    action: '把感触记录在日记中，与营友们分享你的收获。如果有触动你的金句，也可以摘抄下来。',

    // 社群互动评论
    comments: [
      {
        id: 1,
        userId: 101,
        userName: '阿泰',
        avatarText: '泰',
        avatarColor: '#4a90e2',
        content: '非常优秀！对双赢品德的理解非常深入！😊',
        likeCount: 0,
        createTime: '1小时前',
        isLiked: false,
        replies: []
      },
      {
        id: 2,
        userId: 102,
        userName: '王五',
        avatarText: '五',
        avatarColor: '#4a90e2',
        content: '诚信确实是基础，感谢分享这个观点！💪',
        likeCount: 0,
        createTime: '30分钟前',
        isLiked: false,
        replies: []
      },
      {
        id: 3,
        userId: 103,
        userName: '赵六',
        avatarText: '六',
        avatarColor: '#4a90e2',
        content: '点赞！坚持就是胜利！',
        likeCount: 2,
        createTime: '刚刚',
        isLiked: false,
        replies: []
      }
    ]
  }
};

module.exports = mockData;
