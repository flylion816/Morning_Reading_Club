/**
 * Checkin 模块测试 Fixtures
 * 包含打卡、用户、期次、课节等测试数据
 *
 * 三层结构：
 * 第1层：测试数据集合（用户、期次、课节、打卡）
 * 第2层：API 请求体
 * 第3层：预期响应
 */

const mongoose = require('mongoose');

/**
 * 第1层：测试数据集合
 */

/**
 * 测试期次（Period）
 * 包含：进行中、已完成、未开始等不同状态
 */
const testPeriods = {
  activeOngoing: {
    _id: new mongoose.Types.ObjectId(),
    name: '心流之境',
    title: '7天深度阅读营',
    description: '探索内心世界，培养深度思考习惯',
    duration: 7,
    status: 'active',
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-03-07'),
    createdAt: new Date('2026-02-20'),
    updatedAt: new Date('2026-02-20')
  },

  activeEnded: {
    _id: new mongoose.Types.ObjectId(),
    name: '能量充电站',
    title: '14天阅读计划',
    description: '恢复生活能量',
    duration: 14,
    status: 'ended',
    startDate: new Date('2026-02-01'),
    endDate: new Date('2026-02-14'),
    createdAt: new Date('2026-01-20'),
    updatedAt: new Date('2026-02-14')
  },

  notStarted: {
    _id: new mongoose.Types.ObjectId(),
    name: '春日新生',
    title: '21天习惯养成营',
    description: '从阅读开始改变人生',
    duration: 21,
    status: 'draft',
    startDate: new Date('2026-04-01'),
    endDate: new Date('2026-04-21'),
    createdAt: new Date('2026-02-20'),
    updatedAt: new Date('2026-02-20')
  }
};

/**
 * 测试课节（Section）
 * 来自不同期次，包含不同的打卡数
 */
const testSections = {
  // 进行中期次的课节
  day1Ongoing: {
    _id: new mongoose.Types.ObjectId(),
    periodId: testPeriods.activeOngoing._id,
    day: 1,
    title: '开启内心对话',
    content: '什么是内心对话？如何开启有意义的思考',
    sequence: 1,
    icon: '📖',
    checkinCount: 5,
    createdAt: new Date('2026-02-20'),
    updatedAt: new Date('2026-02-20')
  },

  day2Ongoing: {
    _id: new mongoose.Types.ObjectId(),
    periodId: testPeriods.activeOngoing._id,
    day: 2,
    title: '深度阅读技巧',
    content: '如何进行深度阅读',
    sequence: 2,
    icon: '📚',
    checkinCount: 3,
    createdAt: new Date('2026-02-20'),
    updatedAt: new Date('2026-02-20')
  },

  day3Ongoing: {
    _id: new mongoose.Types.ObjectId(),
    periodId: testPeriods.activeOngoing._id,
    day: 3,
    title: '思想碰撞',
    content: '与他人分享思想',
    sequence: 3,
    icon: '💡',
    checkinCount: 2,
    createdAt: new Date('2026-02-20'),
    updatedAt: new Date('2026-02-20')
  },

  // 已完成期次的课节
  day1Ended: {
    _id: new mongoose.Types.ObjectId(),
    periodId: testPeriods.activeEnded._id,
    day: 1,
    title: '能量恢复第一步',
    content: '理解能量的来源',
    sequence: 1,
    icon: '🔋',
    checkinCount: 8,
    createdAt: new Date('2026-01-20'),
    updatedAt: new Date('2026-02-14')
  },

  day2Ended: {
    _id: new mongoose.Types.ObjectId(),
    periodId: testPeriods.activeEnded._id,
    day: 2,
    title: '能量充电实践',
    content: '每日充电的方式',
    sequence: 2,
    icon: '⚡',
    checkinCount: 6,
    createdAt: new Date('2026-01-20'),
    updatedAt: new Date('2026-02-14')
  }
};

/**
 * 测试用户（User）
 * 包含：活跃用户、新手、禁用用户等
 */
const testUsers = {
  activeUser1: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_active_001',
    nickname: '小红',
    avatar: '🎀',
    avatarUrl: 'https://example.com/avatar-001.jpg',
    gender: 'female',
    role: 'user',
    status: 'active',
    totalCheckinDays: 35,
    currentStreak: 7,
    maxStreak: 20,
    totalPoints: 350,
    lastLoginAt: new Date('2026-03-03'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-03-03')
  },

  activeUser2: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_active_002',
    nickname: '小蓝',
    avatar: '🎯',
    avatarUrl: 'https://example.com/avatar-002.jpg',
    gender: 'male',
    role: 'user',
    status: 'active',
    totalCheckinDays: 15,
    currentStreak: 3,
    maxStreak: 5,
    totalPoints: 150,
    lastLoginAt: new Date('2026-03-02'),
    createdAt: new Date('2026-02-15'),
    updatedAt: new Date('2026-03-02')
  },

  activeUser3: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_active_003',
    nickname: '小绿',
    avatar: '🌿',
    avatarUrl: 'https://example.com/avatar-003.jpg',
    gender: 'female',
    role: 'user',
    status: 'active',
    totalCheckinDays: 0,
    currentStreak: 0,
    maxStreak: 0,
    totalPoints: 0,
    lastLoginAt: new Date('2026-03-03'),
    createdAt: new Date('2026-03-03'),
    updatedAt: new Date('2026-03-03')
  },

  disabledUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_disabled',
    nickname: '已禁用用户',
    avatar: '🚫',
    role: 'user',
    status: 'inactive',
    totalCheckinDays: 10,
    currentStreak: 0,
    maxStreak: 5,
    totalPoints: 100,
    lastLoginAt: new Date('2026-02-01'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-02-01')
  },

  adminUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_admin',
    nickname: '管理员',
    avatar: '👨‍💼',
    role: 'admin',
    status: 'active',
    totalCheckinDays: 100,
    currentStreak: 30,
    maxStreak: 60,
    totalPoints: 1000,
    lastLoginAt: new Date('2026-03-03'),
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2026-03-03')
  }
};

/**
 * 测试打卡（Checkin）
 * 包含：今天、昨天、私密、各种状态等
 */
const testCheckins = {
  // 今天的打卡（用户1）
  todayByUser1: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.activeUser1._id,
    periodId: testPeriods.activeOngoing._id,
    sectionId: testSections.day1Ongoing._id,
    day: 1,
    checkinDate: new Date(),
    readingTime: 45,
    completionRate: 100,
    note: '今天的阅读收获很大，深入理解了内心对话的重要性。',
    images: ['https://example.com/image1.jpg'],
    mood: 'happy',
    points: 10,
    isPublic: true,
    likeCount: 5,
    isFeatured: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // 昨天的打卡（用户1，连续打卡）
  yesterdayByUser1: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.activeUser1._id,
    periodId: testPeriods.activeOngoing._id,
    sectionId: testSections.day2Ongoing._id,
    day: 2,
    checkinDate: new Date(Date.now() - 86400000),
    readingTime: 60,
    completionRate: 95,
    note: '深度阅读技巧很实用，已经在实践中应用。',
    images: [],
    mood: 'calm',
    points: 10,
    isPublic: true,
    likeCount: 3,
    isFeatured: false,
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 86400000)
  },

  // 7天前的打卡（用户1）
  sevenDaysAgoByUser1: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.activeUser1._id,
    periodId: testPeriods.activeEnded._id,
    sectionId: testSections.day1Ended._id,
    day: 1,
    checkinDate: new Date(Date.now() - 7 * 86400000),
    readingTime: 30,
    completionRate: 100,
    note: '这期课程改变了我对能量的理解',
    images: ['https://example.com/image2.jpg'],
    mood: 'inspired',
    points: 10,
    isPublic: false, // 私密打卡
    likeCount: 0,
    isFeatured: false,
    createdAt: new Date(Date.now() - 7 * 86400000),
    updatedAt: new Date(Date.now() - 7 * 86400000)
  },

  // 用户2的打卡
  byUser2Today: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.activeUser2._id,
    periodId: testPeriods.activeOngoing._id,
    sectionId: testSections.day1Ongoing._id,
    day: 1,
    checkinDate: new Date(),
    readingTime: 20,
    completionRate: 80,
    note: '刚开始，还需要继续努力。',
    images: [],
    mood: 'thoughtful',
    points: 10,
    isPublic: true,
    likeCount: 2,
    isFeatured: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // 已完成期次的打卡1
  fromEndedPeriod1: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.activeUser1._id,
    periodId: testPeriods.activeEnded._id,
    sectionId: testSections.day2Ended._id,
    day: 2,
    checkinDate: new Date('2026-02-02'),
    readingTime: 50,
    completionRate: 100,
    note: '能量充电实践很有效果',
    images: [],
    mood: 'happy',
    points: 10,
    isPublic: true,
    likeCount: 8,
    isFeatured: true,
    createdAt: new Date('2026-02-02'),
    updatedAt: new Date('2026-02-02')
  },

  // 已完成期次的打卡2
  fromEndedPeriod2: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.activeUser2._id,
    periodId: testPeriods.activeEnded._id,
    sectionId: testSections.day1Ended._id,
    day: 1,
    checkinDate: new Date('2026-02-01'),
    readingTime: 40,
    completionRate: 90,
    note: '能量恢复开始了',
    images: [],
    mood: 'calm',
    points: 10,
    isPublic: true,
    likeCount: 4,
    isFeatured: false,
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01')
  },

  // 大量打卡（用于测试分页）
  bulkCheckins: Array.from({ length: 25 }, (_, i) => ({
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.activeUser1._id,
    periodId: testPeriods.activeOngoing._id,
    sectionId: testSections.day1Ongoing._id,
    day: 1,
    checkinDate: new Date(Date.now() - (25 - i) * 86400000),
    readingTime: 30 + i,
    completionRate: 80 + (i % 20),
    note: `第${i + 1}次打卡`,
    images: [],
    mood: ['happy', 'calm', 'thoughtful', 'inspired'][i % 4],
    points: 10,
    isPublic: i % 3 !== 0, // 部分私密
    likeCount: i % 5,
    isFeatured: i % 10 === 0,
    createdAt: new Date(Date.now() - (25 - i) * 86400000),
    updatedAt: new Date(Date.now() - (25 - i) * 86400000)
  }))
};

/**
 * 第2层：API 请求体
 */
const requestBodies = {
  // 创建打卡的有效请求
  validCreateCheckin: {
    periodId: testPeriods.activeOngoing._id.toString(),
    sectionId: testSections.day1Ongoing._id.toString(),
    day: 1,
    readingTime: 45,
    completionRate: 100,
    note: '深入思考，收获颇丰',
    images: ['https://example.com/image.jpg'],
    mood: 'happy',
    isPublic: true
  },

  // 最小化的创建打卡请求
  minimalCreateCheckin: {
    periodId: testPeriods.activeOngoing._id.toString(),
    sectionId: testSections.day1Ongoing._id.toString(),
    day: 1
  },

  // 私密打卡
  privateCheckin: {
    periodId: testPeriods.activeOngoing._id.toString(),
    sectionId: testSections.day1Ongoing._id.toString(),
    day: 1,
    note: '这是我的个人反思',
    isPublic: false
  },

  // 缺少必填字段：periodId
  missingPeriodId: {
    sectionId: testSections.day1Ongoing._id.toString(),
    day: 1
  },

  // 缺少必填字段：sectionId
  missingSectionId: {
    periodId: testPeriods.activeOngoing._id.toString(),
    day: 1
  },

  // 缺少必填字段：day
  missingDay: {
    periodId: testPeriods.activeOngoing._id.toString(),
    sectionId: testSections.day1Ongoing._id.toString()
  },

  // 无效的 completionRate（超过100）
  invalidCompletionRate: {
    periodId: testPeriods.activeOngoing._id.toString(),
    sectionId: testSections.day1Ongoing._id.toString(),
    day: 1,
    completionRate: 150
  },

  // 无效的 mood
  invalidMood: {
    periodId: testPeriods.activeOngoing._id.toString(),
    sectionId: testSections.day1Ongoing._id.toString(),
    day: 1,
    mood: 'invalid_mood'
  },

  // note 超长
  tooLongNote: {
    periodId: testPeriods.activeOngoing._id.toString(),
    sectionId: testSections.day1Ongoing._id.toString(),
    day: 1,
    note: 'a'.repeat(1001)
  },

  // 更新打卡的有效请求
  validUpdateCheckin: {
    note: '更新后的思考内容',
    readingTime: 60,
    completionRate: 95,
    mood: 'calm',
    isPublic: false,
    images: ['https://example.com/updated.jpg']
  },

  // 仅更新 note
  updateNoteOnly: {
    note: '只更新note的内容'
  },

  // 仅更新 isPublic
  updatePublicStatus: {
    isPublic: false
  },

  // 更新无效的 completionRate
  updateInvalidCompletionRate: {
    completionRate: -10
  }
};

/**
 * 第3层：预期响应
 */
const expectedResponses = {
  // 成功创建打卡
  successCreateCheckin: {
    code: 201,
    message: '打卡成功',
    data: {
      _id: 'objectId',
      userId: 'userId',
      periodId: 'periodId',
      sectionId: 'sectionId',
      day: 1,
      points: 10,
      isPublic: true
    }
  },

  // 成功获取打卡列表
  successGetCheckinList: {
    code: 200,
    message: '获取成功',
    data: [], // 数组
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0
    }
  },

  // 成功获取用户打卡
  successGetUserCheckins: {
    code: 200,
    message: '获取成功',
    data: {
      list: [],
      stats: {
        diaryCount: 0,
        featuredCount: 0,
        likeCount: 0,
        totalCheckins: 0,
        consecutiveDays: 0
      },
      calendar: null,
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
      }
    }
  },

  // 成功获取用户打卡（带日历）
  successGetUserCheckinsWithCalendar: {
    code: 200,
    message: '获取成功',
    data: {
      list: [],
      stats: {},
      calendar: {
        year: 2026,
        month: 3,
        checkinDays: [1, 2, 3]
      },
      pagination: {}
    }
  },

  // 成功获取期次打卡（广场）
  successGetPeriodCheckins: {
    code: 200,
    message: '获取成功',
    data: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNext: false
    }
  },

  // 成功获取打卡详情
  successGetCheckinDetail: {
    code: 200,
    message: '获取成功',
    data: {
      _id: 'objectId',
      userId: {},
      sectionId: {},
      periodId: {},
      note: '内容',
      isPublic: true
    }
  },

  // 成功更新打卡
  successUpdateCheckin: {
    code: 200,
    message: '打卡更新成功',
    data: {
      _id: 'objectId',
      note: '更新后的内容',
      updatedAt: 'date'
    }
  },

  // 成功删除打卡
  successDeleteCheckin: {
    code: 200,
    message: '打卡删除成功',
    data: null
  },

  // 成功获取后台打卡列表
  successGetAdminCheckins: {
    code: 200,
    message: '获取成功',
    data: {
      list: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
      },
      stats: {
        totalCount: 0,
        todayCount: 0,
        totalPoints: 0
      }
    }
  },

  // 成功获取打卡统计
  successGetCheckinStats: {
    code: 200,
    message: '获取成功',
    data: {
      totalCount: 0,
      todayCount: 0,
      uniqueUserCount: 0,
      totalPoints: 0,
      totalLikes: 0,
      featuredCount: 0,
      averagePointsPerUser: '0.00'
    }
  },

  // 错误：课节不存在
  errorSectionNotFound: {
    code: 404,
    message: '课程不存在'
  },

  // 错误：打卡不存在
  errorCheckinNotFound: {
    code: 404,
    message: '打卡记录不存在'
  },

  // 错误：无权更新
  errorForbiddenUpdate: {
    code: 403,
    message: '无权更新'
  },

  // 错误：无权删除
  errorForbiddenDelete: {
    code: 403,
    message: '无权删除'
  },

  // 错误：今日已打卡
  errorDuplicateCheckin: {
    code: 400,
    message: '今日已打卡'
  },

  // 错误：请求参数不合法
  errorBadRequest: {
    code: 400,
    message: '请求参数不合法'
  }
};

/**
 * 特殊场景：连续打卡计算
 */
const streakScenarios = {
  // 场景1：前一天有打卡，应该累加
  yesterdayHasCheckin: {
    description: '前一天有打卡，连续天数应该 +1',
    yesterday: new Date(Date.now() - 86400000),
    today: new Date(),
    expectedStreakIncrement: 1
  },

  // 场景2：前一天无打卡，应该重置为1
  yesterdayNoCheckin: {
    description: '前一天无打卡，连续天数应该重置为 1',
    yesterday: new Date(Date.now() - 86400000),
    today: new Date(),
    expectedStreak: 1
  },

  // 场景3：连续7天打卡
  sevenConsecutiveDays: {
    description: '连续7天打卡',
    checkinDates: Array.from({ length: 7 }, (_, i) =>
      new Date(Date.now() - (7 - i - 1) * 86400000)
    ),
    expectedConsecutiveDays: 7
  },

  // 场景4：有间隙的打卡
  gappedCheckins: {
    description: '有间隙的打卡，应该从最新的开始计算',
    checkinDates: [
      new Date(Date.now() - 86400000 * 0), // 今天
      new Date(Date.now() - 86400000 * 1), // 昨天
      new Date(Date.now() - 86400000 * 3)  // 3天前（有间隙）
    ],
    expectedConsecutiveDays: 2 // 从今天开始往前算
  }
};

/**
 * 边界值测试
 */
const edgeCases = {
  zeroReadingTime: {
    periodId: testPeriods.activeOngoing._id.toString(),
    sectionId: testSections.day1Ongoing._id.toString(),
    day: 1,
    readingTime: 0,
    completionRate: 0
  },

  maxReadingTime: {
    periodId: testPeriods.activeOngoing._id.toString(),
    sectionId: testSections.day1Ongoing._id.toString(),
    day: 1,
    readingTime: 1440 // 24小时
  },

  emptyNote: {
    periodId: testPeriods.activeOngoing._id.toString(),
    sectionId: testSections.day1Ongoing._id.toString(),
    day: 1,
    note: ''
  },

  emptyImages: {
    periodId: testPeriods.activeOngoing._id.toString(),
    sectionId: testSections.day1Ongoing._id.toString(),
    day: 1,
    images: []
  },

  manyImages: {
    periodId: testPeriods.activeOngoing._id.toString(),
    sectionId: testSections.day1Ongoing._id.toString(),
    day: 1,
    images: Array(20).fill('https://example.com/image.jpg')
  },

  negativeDay: {
    periodId: testPeriods.activeOngoing._id.toString(),
    sectionId: testSections.day1Ongoing._id.toString(),
    day: -1
  },

  veryLargeDay: {
    periodId: testPeriods.activeOngoing._id.toString(),
    sectionId: testSections.day1Ongoing._id.toString(),
    day: 999
  }
};

/**
 * 权限测试场景
 */
const permissionScenarios = {
  // 用户只能访问自己的打卡
  viewOwnCheckin: {
    owner: testUsers.activeUser1._id.toString(),
    viewer: testUsers.activeUser1._id.toString(),
    isPublic: false,
    shouldAllow: true,
    description: '用户可以查看自己的私密打卡'
  },

  // 其他用户不能访问私密打卡
  viewOtherPrivateCheckin: {
    owner: testUsers.activeUser1._id.toString(),
    viewer: testUsers.activeUser2._id.toString(),
    isPublic: false,
    shouldAllow: false,
    description: '其他用户不能查看私密打卡'
  },

  // 任何人都可以访问公开打卡
  viewPublicCheckin: {
    owner: testUsers.activeUser1._id.toString(),
    viewer: testUsers.activeUser2._id.toString(),
    isPublic: true,
    shouldAllow: true,
    description: '任何登录用户都可以查看公开打卡'
  },

  // 用户只能更新自己的打卡
  updateOwnCheckin: {
    owner: testUsers.activeUser1._id.toString(),
    updater: testUsers.activeUser1._id.toString(),
    shouldAllow: true,
    description: '用户只能更新自己的打卡'
  },

  // 其他用户不能更新别人的打卡
  updateOtherCheckin: {
    owner: testUsers.activeUser1._id.toString(),
    updater: testUsers.activeUser2._id.toString(),
    shouldAllow: false,
    description: '其他用户不能更新别人的打卡'
  }
};

module.exports = {
  // 第1层：测试数据集合
  testPeriods,
  testSections,
  testUsers,
  testCheckins,

  // 第2层：API 请求体
  requestBodies,

  // 第3层：预期响应
  expectedResponses,

  // 特殊场景
  streakScenarios,
  edgeCases,
  permissionScenarios
};
