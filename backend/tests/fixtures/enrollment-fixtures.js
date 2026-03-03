/**
 * Enrollment 模块测试 Fixtures
 * 包含期次、用户、报名记录等测试数据
 */

const mongoose = require('mongoose');

/**
 * 测试期次数据
 */
const testPeriods = {
  // 进行中的期次
  ongoingPeriod: {
    _id: new mongoose.Types.ObjectId(),
    title: '心流之境',
    description: '深度阅读七个习惯',
    coverImage: 'https://example.com/cover-1.jpg',
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7天前开始
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后结束
    enrollmentDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2天后截止报名
    enrollmentCount: 45,
    capacity: 100,
    price: 99,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-02-01')
  },

  // 未开始的期次
  upcomingPeriod: {
    _id: new mongoose.Types.ObjectId(),
    title: '主动积极',
    description: '掌握自己的命运',
    coverImage: 'https://example.com/cover-2.jpg',
    startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后开始
    endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60天后结束
    enrollmentDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15天后截止
    enrollmentCount: 10,
    capacity: 100,
    price: 99,
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-02-15')
  },

  // 报名截止的期次
  closedEnrollmentPeriod: {
    _id: new mongoose.Types.ObjectId(),
    title: '协同的威力',
    description: '1+1>2的力量',
    coverImage: 'https://example.com/cover-3.jpg',
    startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2天前开始
    endDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 28天后结束
    enrollmentDeadline: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 已截止
    enrollmentCount: 80,
    capacity: 100,
    price: 99,
    createdAt: new Date('2025-02-01'),
    updatedAt: new Date('2025-02-10')
  },

  // 已完成的期次
  completedPeriod: {
    _id: new mongoose.Types.ObjectId(),
    title: '要事优先',
    description: '时间管理的艺术',
    coverImage: 'https://example.com/cover-4.jpg',
    startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60天前开始
    endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天前结束
    enrollmentDeadline: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 已截止
    enrollmentCount: 95,
    capacity: 100,
    price: 99,
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2025-01-05')
  }
};

/**
 * 测试用户数据
 */
const testUsers = {
  enrolledUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_enrolled',
    nickname: '已报名用户',
    avatar: '📚',
    avatarUrl: 'https://example.com/avatar-enrolled.jpg',
    role: 'user',
    status: 'active',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-02-01')
  },

  normalUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_normal',
    nickname: '普通用户',
    avatar: '🦁',
    avatarUrl: 'https://example.com/avatar-normal.jpg',
    role: 'user',
    status: 'active',
    createdAt: new Date('2025-01-05'),
    updatedAt: new Date('2025-01-20')
  },

  anotherUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_another',
    nickname: '另一个用户',
    avatar: '🐯',
    avatarUrl: 'https://example.com/avatar-another.jpg',
    role: 'user',
    status: 'active',
    createdAt: new Date('2025-01-10'),
    updatedAt: new Date('2025-02-05')
  },

  adminUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_admin',
    nickname: '管理员',
    avatar: '👨‍💼',
    avatarUrl: 'https://example.com/avatar-admin.jpg',
    role: 'admin',
    status: 'active',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2025-02-01')
  },

  disabledUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_disabled',
    nickname: '禁用用户',
    avatar: '🚫',
    role: 'user',
    status: 'inactive',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-15')
  }
};

/**
 * 报名记录数据
 */
const enrollmentRecords = {
  // 已支付的报名
  paidEnrollment: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.enrolledUser._id,
    periodId: testPeriods.ongoingPeriod._id,
    status: 'active',
    paymentStatus: 'paid',
    paymentAmount: 99,
    paidAt: new Date('2025-02-01'),
    enrolledAt: new Date('2025-02-01'),
    completedAt: null,
    // 完整表单字段
    name: '张三',
    gender: 'male',
    province: '北京',
    detailedAddress: '朝阳区',
    age: 30,
    referrer: '朋友推荐',
    hasReadBook: 'yes',
    readTimes: 5,
    enrollReason: '想提升自己',
    expectation: '获得成长',
    commitment: '坚持学习',
    createdAt: new Date('2025-02-01'),
    updatedAt: new Date('2025-02-05')
  },

  // 待支付的报名
  unpaidEnrollment: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.normalUser._id,
    periodId: testPeriods.ongoingPeriod._id,
    status: 'active',
    paymentStatus: 'pending',
    paymentAmount: 99,
    paidAt: null,
    enrolledAt: new Date('2025-02-10'),
    completedAt: null,
    createdAt: new Date('2025-02-10'),
    updatedAt: new Date('2025-02-10')
  },

  // 已完成的报名
  completedEnrollment: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.enrolledUser._id,
    periodId: testPeriods.completedPeriod._id,
    status: 'completed',
    paymentStatus: 'paid',
    paymentAmount: 99,
    paidAt: new Date('2024-12-20'),
    enrolledAt: new Date('2024-12-15'),
    completedAt: new Date('2025-01-05'),
    createdAt: new Date('2024-12-15'),
    updatedAt: new Date('2025-01-05')
  },

  // 已取消的报名
  withdrawnEnrollment: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.anotherUser._id,
    periodId: testPeriods.ongoingPeriod._id,
    status: 'withdrawn',
    paymentStatus: 'pending',
    paymentAmount: 0,
    paidAt: null,
    enrolledAt: new Date('2025-02-05'),
    withdrawnAt: new Date('2025-02-08'),
    completedAt: null,
    createdAt: new Date('2025-02-05'),
    updatedAt: new Date('2025-02-08')
  },

  // 已拒绝的报名
  rejectedEnrollment: {
    _id: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    periodId: testPeriods.ongoingPeriod._id,
    status: 'rejected',
    paymentStatus: 'pending',
    rejectionReason: '不符合要求',
    enrolledAt: new Date('2025-02-12'),
    rejectedAt: new Date('2025-02-13'),
    completedAt: null,
    createdAt: new Date('2025-02-12'),
    updatedAt: new Date('2025-02-13')
  },

  // 免费报名
  freeEnrollment: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.normalUser._id,
    periodId: testPeriods.upcomingPeriod._id,
    status: 'active',
    paymentStatus: 'free',
    paymentAmount: 0,
    enrolledAt: new Date('2025-02-15'),
    completedAt: null,
    createdAt: new Date('2025-02-15'),
    updatedAt: new Date('2025-02-15')
  }
};

/**
 * API 请求体
 */
const requestBodies = {
  // 简化报名请求
  simpleEnrollment: {
    periodId: testPeriods.ongoingPeriod._id.toString()
  },

  // 完整报名表单
  fullEnrollmentForm: {
    periodId: testPeriods.ongoingPeriod._id.toString(),
    name: '李四',
    gender: 'female',
    province: '上海',
    detailedAddress: '浦东新区',
    age: 28,
    referrer: '官方宣传',
    hasReadBook: 'no',
    readTimes: 0,
    enrollReason: '想改变自己',
    expectation: '学到实用方法',
    commitment: '每天坚持'
  },

  // 缺少字段的表单
  incompleteEnrollmentForm: {
    periodId: testPeriods.ongoingPeriod._id.toString(),
    name: '王五',
    // 缺少 gender、province 等字段
    age: 25,
    referrer: '朋友介绍'
  },

  // 无效的period ID
  invalidPeriodEnrollment: {
    periodId: new mongoose.Types.ObjectId().toString()
  },

  // 空的报名请求
  emptyEnrollment: {}
};

/**
 * 预期的 API 响应
 */
const expectedResponses = {
  successEnrollment: {
    code: 200,
    message: '报名成功',
    data: {
      _id: enrollmentRecords.paidEnrollment._id,
      userId: {
        _id: testUsers.enrolledUser._id,
        nickname: testUsers.enrolledUser.nickname,
        avatar: testUsers.enrolledUser.avatar
      },
      periodId: {
        _id: testPeriods.ongoingPeriod._id,
        title: testPeriods.ongoingPeriod.title,
        description: testPeriods.ongoingPeriod.description
      },
      status: 'active',
      paymentStatus: 'pending'
    }
  },

  successWithdrawal: {
    code: 200,
    message: '退出成功',
    data: {
      status: 'withdrawn'
    }
  },

  successGetEnrollments: {
    code: 200,
    data: {
      list: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0
    }
  },

  successGetMembers: {
    code: 200,
    data: {
      list: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0
    }
  },

  successCheckEnrollment: {
    code: 200,
    data: {
      isEnrolled: true,
      paymentStatus: 'pending'
    }
  },

  errorDuplicateEnrollment: {
    code: 400,
    message: '您已报名该期次'
  },

  errorMissingFields: {
    code: 400,
    message: /缺少必填字段|缺少必要参数/
  },

  errorPeriodNotFound: {
    code: 404,
    message: '期次不存在'
  },

  errorEnrollmentNotFound: {
    code: 404,
    message: '报名记录不存在'
  },

  errorEnrollmentClosed: {
    code: 400,
    message: '期次已截止|报名已结束'
  }
};

/**
 * 权限场景
 */
const permissionScenarios = {
  // 用户只能操作自己的报名
  selfEnrollmentAccess: {
    description: '用户只能操作自己的报名记录',
    userId: testUsers.enrolledUser._id.toString(),
    enrollmentUserId: testUsers.enrolledUser._id.toString(),
    shouldAllow: true
  },

  // 用户无法操作他人的报名
  otherUserEnrollmentAccess: {
    description: '用户无法操作他人的报名记录',
    userId: testUsers.normalUser._id.toString(),
    enrollmentUserId: testUsers.enrolledUser._id.toString(),
    shouldAllow: false
  },

  // 管理员可以操作任何报名
  adminEnrollmentAccess: {
    description: '管理员可以操作任何报名记录',
    userId: testUsers.adminUser._id.toString(),
    enrollmentUserId: testUsers.enrolledUser._id.toString(),
    shouldAllow: true
  },

  // 普通用户无法审批报名
  userCannotApprove: {
    description: '普通用户无法审批或拒绝报名',
    userId: testUsers.normalUser._id.toString(),
    role: 'user',
    shouldAllow: false
  },

  // 管理员可以审批报名
  adminCanApprove: {
    description: '管理员可以审批或拒绝报名',
    userId: testUsers.adminUser._id.toString(),
    role: 'admin',
    shouldAllow: true
  }
};

/**
 * 边界值和特殊场景
 */
const edgeCases = {
  emptyPeriodId: '',
  nullPeriodId: null,
  undefinedPeriodId: undefined,
  invalidMongoIdPeriod: 'not-a-mongo-id',
  veryLongPeriodId: 'a'.repeat(10000),

  emptyUserId: '',
  nullUserId: null,
  invalidMongoIdUser: 'invalid-id',

  emptyEnrollmentId: '',
  invalidMongoIdEnrollment: 'not-a-valid-id',

  // 数字字段边界值
  ageZero: 0,
  ageNegative: -5,
  ageVeryHigh: 200,
  readTimesNegative: -1,
  readTimesVeryHigh: 999,

  // 字符串字段边界值
  emptyName: '',
  veryLongName: 'a'.repeat(500),
  specialCharName: '!@#$%^&*()',
  unicodeName: '中文名字🎉😀',

  // 日期边界值
  futureBoundaryDate: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
  pastBoundaryDate: new Date(Date.now() - 100 * 365 * 24 * 60 * 60 * 1000),

  // SQL/NoSQL 注入
  mongoInjectionName: { '$ne': null },
  sqlInjectionName: "'; DROP TABLE enrollments; --"
};

/**
 * 并发测试数据
 */
const concurrencyScenarios = {
  // 同时报名同一期次
  simultaneousEnrollment: {
    description: '多个用户同时报名同一期次',
    users: [
      testUsers.normalUser._id,
      testUsers.anotherUser._id,
      testUsers.enrolledUser._id
    ],
    periodId: testPeriods.ongoingPeriod._id,
    expectedResult: '所有用户报名成功'
  },

  // 同一用户同时多次报名
  multipleSimultaneousAttempts: {
    description: '同一用户同时发起多个报名请求',
    userId: testUsers.normalUser._id,
    periodId: testPeriods.ongoingPeriod._id,
    attempts: 3,
    expectedResult: '仅第一个报名成功，其他返回重复报名错误'
  }
};

module.exports = {
  testPeriods,
  testUsers,
  enrollmentRecords,
  requestBodies,
  expectedResponses,
  permissionScenarios,
  edgeCases,
  concurrencyScenarios
};
