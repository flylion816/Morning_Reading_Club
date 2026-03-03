/**
 * Insight 模块测试 Fixtures
 * 包含小凡看见、权限申请、用户、期次等测试数据
 *
 * 三层结构：
 * 第1层：测试数据集合（用户、期次、课节、小凡看见、权限申请）
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
 */
const testSections = {
  day1Ongoing: {
    _id: new mongoose.Types.ObjectId(),
    periodId: testPeriods.activeOngoing._id,
    day: 1,
    title: '开启内心对话',
    content: '什么是内心对话？如何开启有意义的思考',
    sequence: 1,
    icon: '📖',
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
    createdAt: new Date('2026-02-20'),
    updatedAt: new Date('2026-02-20')
  }
};

/**
 * 测试用户（User）
 */
const testUsers = {
  user1: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_001',
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

  user2: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_002',
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

  user3: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_003',
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
  },

  systemUser: {
    _id: new mongoose.Types.ObjectId(),
    nickname: 'System',
    avatar: '🤖',
    role: 'system',
    status: 'active',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2026-03-03')
  }
};

/**
 * 测试报名信息（Enrollment）
 */
const testEnrollments = {
  user1InPeriod1: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.user1._id,
    periodId: testPeriods.activeOngoing._id,
    enrollmentDate: new Date('2026-02-20'),
    status: 'active',
    createdAt: new Date('2026-02-20'),
    updatedAt: new Date('2026-02-20')
  },

  user2InPeriod1: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.user2._id,
    periodId: testPeriods.activeOngoing._id,
    enrollmentDate: new Date('2026-02-22'),
    status: 'active',
    createdAt: new Date('2026-02-22'),
    updatedAt: new Date('2026-02-22')
  },

  user3InPeriod1: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.user3._id,
    periodId: testPeriods.activeOngoing._id,
    enrollmentDate: new Date('2026-03-01'),
    status: 'active',
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01')
  }
};

/**
 * 测试小凡看见（Insight）
 * 包含：创建者视角、被分配者视角、各种状态等
 */
const testInsights = {
  // 用户1创建，分配给用户2的
  user1ToUser2: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.user1._id,
    targetUserId: testUsers.user2._id,
    periodId: testPeriods.activeOngoing._id,
    sectionId: testSections.day1Ongoing._id,
    type: 'insight',
    mediaType: 'text',
    content: '我看到你在阅读时的专注力，这种专注是学习的基础。',
    summary: '看到你的专注力',
    status: 'completed',
    isPublished: true,
    likeCount: 5,
    likes: [testUsers.user3._id],
    clicks: 2,
    comments: [
      {
        userId: testUsers.user2._id,
        content: '感谢你的洞见！',
        createdAt: new Date('2026-03-03 10:00:00')
      }
    ],
    isFeatured: false,
    createdAt: new Date('2026-03-03 08:00:00'),
    updatedAt: new Date('2026-03-03 08:00:00')
  },

  // 用户2创建，分配给用户1的
  user2ToUser1: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.user2._id,
    targetUserId: testUsers.user1._id,
    periodId: testPeriods.activeOngoing._id,
    sectionId: testSections.day1Ongoing._id,
    type: 'insight',
    mediaType: 'text',
    content: '你的持续参与给我很多启发',
    summary: '看到你的坚持',
    status: 'completed',
    isPublished: true,
    likeCount: 3,
    likes: [],
    clicks: 1,
    comments: [],
    isFeatured: false,
    createdAt: new Date('2026-03-02 09:00:00'),
    updatedAt: new Date('2026-03-02 09:00:00')
  },

  // 用户1创建的，未发布
  user1Unpublished: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.user1._id,
    targetUserId: testUsers.user2._id,
    periodId: testPeriods.activeOngoing._id,
    sectionId: testSections.day2Ongoing._id,
    type: 'insight',
    mediaType: 'text',
    content: '草稿内容',
    summary: '草稿',
    status: 'completed',
    isPublished: false,
    likeCount: 0,
    likes: [],
    clicks: 0,
    comments: [],
    isFeatured: false,
    createdAt: new Date('2026-03-03 07:00:00'),
    updatedAt: new Date('2026-03-03 07:00:00')
  },

  // 用户1创建给用户3的，已发布
  user1ToUser3: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.user1._id,
    targetUserId: testUsers.user3._id,
    periodId: testPeriods.activeOngoing._id,
    sectionId: testSections.day1Ongoing._id,
    type: 'insight',
    mediaType: 'text',
    content: '欢迎加入我们的阅读社区',
    summary: '欢迎新成员',
    status: 'completed',
    isPublished: true,
    likeCount: 1,
    likes: [],
    clicks: 0,
    comments: [],
    isFeatured: false,
    createdAt: new Date('2026-03-01 10:00:00'),
    updatedAt: new Date('2026-03-01 10:00:00')
  },

  // 系统用户创建的（外部接口）
  systemCreated: {
    _id: new mongoose.Types.ObjectId(),
    userId: testUsers.systemUser._id,
    targetUserId: testUsers.user1._id,
    periodId: testPeriods.activeOngoing._id,
    sectionId: testSections.day1Ongoing._id,
    type: 'insight',
    mediaType: 'text',
    content: '来自外部系统的洞见',
    summary: '系统反馈',
    status: 'completed',
    isPublished: true,
    likeCount: 0,
    likes: [],
    clicks: 0,
    comments: [],
    isFeatured: false,
    createdAt: new Date('2026-03-03 12:00:00'),
    updatedAt: new Date('2026-03-03 12:00:00')
  }
};

/**
 * 测试权限申请（InsightRequest）
 */
const testInsightRequests = {
  // 用户2申请查看用户1的，待批准
  user2ToUser1Pending: {
    _id: new mongoose.Types.ObjectId(),
    fromUserId: testUsers.user2._id,
    toUserId: testUsers.user1._id,
    periodId: testPeriods.activeOngoing._id,
    status: 'pending',
    reason: '想看看你的成长经历',
    createdAt: new Date('2026-03-02 15:00:00'),
    updatedAt: new Date('2026-03-02 15:00:00')
  },

  // 用户2申请查看用户1的，已批准
  user2ToUser1Approved: {
    _id: new mongoose.Types.ObjectId(),
    fromUserId: testUsers.user2._id,
    toUserId: testUsers.user1._id,
    periodId: testPeriods.activeOngoing._id,
    status: 'approved',
    reason: '想看看你的成长经历',
    approvedAt: new Date('2026-03-02 16:00:00'),
    createdAt: new Date('2026-03-02 15:00:00'),
    updatedAt: new Date('2026-03-02 16:00:00')
  },

  // 用户3申请查看用户1的，已拒绝
  user3ToUser1Rejected: {
    _id: new mongoose.Types.ObjectId(),
    fromUserId: testUsers.user3._id,
    toUserId: testUsers.user1._id,
    periodId: testPeriods.activeOngoing._id,
    status: 'rejected',
    reason: '想了解更多',
    rejectedAt: new Date('2026-03-01 10:00:00'),
    createdAt: new Date('2026-03-01 09:00:00'),
    updatedAt: new Date('2026-03-01 10:00:00')
  },

  // 用户3申请查看用户2的，已撤销
  user3ToUser2Revoked: {
    _id: new mongoose.Types.ObjectId(),
    fromUserId: testUsers.user3._id,
    toUserId: testUsers.user2._id,
    periodId: testPeriods.activeOngoing._id,
    status: 'revoked',
    reason: '想学习你的方法',
    approvedAt: new Date('2026-02-28 10:00:00'),
    revokedAt: new Date('2026-03-01 14:00:00'),
    createdAt: new Date('2026-02-28 09:00:00'),
    updatedAt: new Date('2026-03-01 14:00:00')
  },

  // 用户1申请查看用户2的，待批准
  user1ToUser2Pending: {
    _id: new mongoose.Types.ObjectId(),
    fromUserId: testUsers.user1._id,
    toUserId: testUsers.user2._id,
    periodId: testPeriods.activeOngoing._id,
    status: 'pending',
    reason: '想看看你的想法',
    createdAt: new Date('2026-03-03 11:00:00'),
    updatedAt: new Date('2026-03-03 11:00:00')
  },

  // 用户1申请查看用户3的，已批准
  user1ToUser3Approved: {
    _id: new mongoose.Types.ObjectId(),
    fromUserId: testUsers.user1._id,
    toUserId: testUsers.user3._id,
    periodId: testPeriods.activeOngoing._id,
    status: 'approved',
    reason: '欢迎新成员',
    approvedAt: new Date('2026-03-01 11:00:00'),
    createdAt: new Date('2026-03-01 10:00:00'),
    updatedAt: new Date('2026-03-01 11:00:00')
  }
};

/**
 * 第2层：API 请求体
 */

const createInsightRequests = {
  valid: {
    targetUserId: testUsers.user2._id.toString(),
    periodId: testPeriods.activeOngoing._id.toString(),
    type: 'insight',
    mediaType: 'text',
    content: '我看到你的进步',
    summary: '看到你的进步'
  },

  validWithImage: {
    targetUserId: testUsers.user2._id.toString(),
    periodId: testPeriods.activeOngoing._id.toString(),
    type: 'insight',
    mediaType: 'image',
    content: '这张图片代表我们的共同成长',
    summary: '共同成长',
    imageUrl: 'https://example.com/image.jpg'
  },

  missingContent: {
    targetUserId: testUsers.user2._id.toString(),
    periodId: testPeriods.activeOngoing._id.toString(),
    type: 'insight',
    mediaType: 'text'
  },

  missingTargetUserId: {
    periodId: testPeriods.activeOngoing._id.toString(),
    type: 'insight',
    mediaType: 'text',
    content: '测试内容',
    summary: '测试'
  },

  selfTarget: {
    targetUserId: testUsers.user1._id.toString(),
    periodId: testPeriods.activeOngoing._id.toString(),
    type: 'insight',
    mediaType: 'text',
    content: '给自己的洞见',
    summary: '自己'
  },

  invalidType: {
    targetUserId: testUsers.user2._id.toString(),
    periodId: testPeriods.activeOngoing._id.toString(),
    type: 'invalid_type',
    mediaType: 'text',
    content: '测试',
    summary: '测试'
  }
};

const createInsightRequestRequests = {
  valid: {
    toUserId: testUsers.user1._id.toString(),
    periodId: testPeriods.activeOngoing._id.toString()
  },

  validWithReason: {
    toUserId: testUsers.user1._id.toString(),
    periodId: testPeriods.activeOngoing._id.toString(),
    reason: '想学习你的经验'
  },

  selfRequest: {
    toUserId: testUsers.user2._id.toString(),
    periodId: testPeriods.activeOngoing._id.toString()
  },

  missingToUserId: {
    periodId: testPeriods.activeOngoing._id.toString()
  },

  invalidToUserId: {
    toUserId: 'invalid_id',
    periodId: testPeriods.activeOngoing._id.toString()
  }
};

const approveRequestRequests = {
  valid: {
    periodId: testPeriods.activeOngoing._id.toString()
  },

  missingPeriodId: {}
};

const updateInsightRequests = {
  valid: {
    content: '更新后的内容',
    summary: '更新后的总结'
  },

  partial: {
    content: '仅更新内容'
  }
};

/**
 * 第3层：预期响应
 */

const expectedResponses = {
  success201: {
    code: 201,
    message: '创建成功'
  },

  success200: {
    code: 200,
    message: '操作成功'
  },

  badRequest400: {
    code: 400,
    messageIncludes: ['缺少', '必填', '无效']
  },

  forbidden403: {
    code: 403,
    messageIncludes: ['无权', '禁止', '权限']
  },

  notFound404: {
    code: 404,
    messageIncludes: ['不存在', '未找到', '找不到']
  },

  serverError500: {
    code: 500,
    messageIncludes: ['错误', '异常']
  }
};

/**
 * 批量数据集合（用于分页测试）
 */

const bulkInsights = Array.from({ length: 50 }, (_, i) => ({
  _id: new mongoose.Types.ObjectId(),
  userId: testUsers.user1._id,
  targetUserId: testUsers.user2._id,
  periodId: testPeriods.activeOngoing._id,
  sectionId: testSections.day1Ongoing._id,
  type: 'insight',
  mediaType: 'text',
  content: `洞见 #${i + 1}`,
  summary: `总结 #${i + 1}`,
  status: 'completed',
  isPublished: true,
  likeCount: i % 10,
  likes: [],
  clicks: i % 5,
  comments: [],
  isFeatured: false,
  createdAt: new Date(Date.now() - i * 3600000),
  updatedAt: new Date(Date.now() - i * 3600000)
}));

const bulkRequests = Array.from({ length: 30 }, (_, i) => {
  const statuses = ['pending', 'approved', 'rejected', 'revoked'];
  const status = statuses[i % 4];
  const request = {
    _id: new mongoose.Types.ObjectId(),
    fromUserId: testUsers.user1._id,
    toUserId: testUsers.user2._id,
    periodId: testPeriods.activeOngoing._id,
    status: status,
    reason: `申请 #${i + 1}`,
    createdAt: new Date(Date.now() - i * 3600000),
    updatedAt: new Date(Date.now() - i * 3600000)
  };

  // 根据状态添加时间戳
  if (status === 'approved') {
    request.approvedAt = new Date(Date.now() - i * 3600000 + 1800000);
  } else if (status === 'rejected') {
    request.rejectedAt = new Date(Date.now() - i * 3600000 + 1800000);
  } else if (status === 'revoked') {
    request.approvedAt = new Date(Date.now() - i * 3600000 + 1800000);
    request.revokedAt = new Date(Date.now() - i * 3600000 + 3600000);
  }

  return request;
});

module.exports = {
  // 第1层：测试数据集合
  testPeriods,
  testSections,
  testUsers,
  testEnrollments,
  testInsights,
  testInsightRequests,

  // 第2层：API 请求体
  createInsightRequests,
  createInsightRequestRequests,
  approveRequestRequests,
  updateInsightRequests,

  // 第3层：预期响应
  expectedResponses,

  // 批量数据（分页测试）
  bulkInsights,
  bulkRequests
};
