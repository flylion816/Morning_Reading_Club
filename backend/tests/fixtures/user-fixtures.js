/**
 * User 模块测试 Fixtures
 * 包含用户信息、更新数据、请求体等测试数据
 */

const mongoose = require('mongoose');

/**
 * 测试用户数据
 */
const testUsers = {
  normalUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_normal',
    nickname: '普通用户',
    avatar: '🦁',
    avatarUrl: 'https://example.com/avatar-normal.jpg',
    signature: '我是普通用户',
    gender: 'male',
    role: 'user',
    status: 'active',
    totalCheckinDays: 10,
    currentStreak: 5,
    maxStreak: 8,
    totalCompletedPeriods: 2,
    totalPoints: 100,
    level: 2,
    lastLoginAt: new Date(),
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-15')
  },

  anotherNormalUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_another',
    nickname: '另一个用户',
    avatar: '🐯',
    avatarUrl: 'https://example.com/avatar-another.jpg',
    signature: '你好',
    gender: 'female',
    role: 'user',
    status: 'active',
    totalCheckinDays: 25,
    currentStreak: 12,
    maxStreak: 15,
    totalCompletedPeriods: 3,
    totalPoints: 250,
    level: 3,
    lastLoginAt: new Date(),
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-20')
  },

  disabledUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_disabled',
    nickname: '禁用用户',
    avatar: '🚫',
    avatarUrl: 'https://example.com/avatar-disabled.jpg',
    signature: '我被禁用了',
    gender: 'unknown',
    role: 'user',
    status: 'inactive',
    totalCheckinDays: 5,
    currentStreak: 0,
    maxStreak: 3,
    totalCompletedPeriods: 1,
    totalPoints: 50,
    level: 1,
    lastLoginAt: new Date('2024-12-01'),
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01')
  },

  adminUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_admin',
    nickname: '管理员',
    avatar: '👨‍💼',
    avatarUrl: 'https://example.com/avatar-admin.jpg',
    signature: '管理员签名',
    gender: 'male',
    role: 'admin',
    status: 'active',
    totalCheckinDays: 100,
    currentStreak: 50,
    maxStreak: 100,
    totalCompletedPeriods: 10,
    totalPoints: 1000,
    level: 10,
    lastLoginAt: new Date(),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2025-02-01')
  },

  newUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_new',
    nickname: '新用户',
    avatar: '🐶',
    avatarUrl: 'https://example.com/avatar-new.jpg',
    signature: '',
    gender: 'unknown',
    role: 'user',
    status: 'active',
    totalCheckinDays: 0,
    currentStreak: 0,
    maxStreak: 0,
    totalCompletedPeriods: 0,
    totalPoints: 0,
    level: 1,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },

  enrolledUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_enrolled',
    nickname: '已报名用户',
    avatar: '📚',
    avatarUrl: 'https://example.com/avatar-enrolled.jpg',
    signature: '喜欢阅读',
    gender: 'female',
    role: 'user',
    status: 'active',
    totalCheckinDays: 15,
    currentStreak: 8,
    maxStreak: 10,
    totalCompletedPeriods: 2,
    totalPoints: 150,
    level: 2,
    lastLoginAt: new Date(),
    createdAt: new Date('2025-01-10'),
    updatedAt: new Date('2025-02-10')
  }
};

/**
 * 用户更新数据
 */
const updateData = {
  validUpdate: {
    nickname: '更新后的昵称',
    avatar: '✨',
    avatarUrl: 'https://new.example.com/avatar.jpg',
    signature: '新的签名',
    gender: 'female'
  },

  nicknameOnly: {
    nickname: '仅更新昵称'
  },

  avatarOnly: {
    avatar: '🎉',
    avatarUrl: 'https://new.example.com/new-avatar.jpg'
  },

  signatureOnly: {
    signature: '只更新签名'
  },

  genderOnly: {
    gender: 'male'
  },

  partialUpdate: {
    nickname: '部分更新',
    signature: '部分签名'
  },

  emptyNickname: {
    nickname: ''
  },

  veryLongNickname: {
    nickname: 'a'.repeat(100)
  },

  specialCharNickname: {
    nickname: '用户🎉😀!@#'
  }
};

/**
 * API 请求体
 */
const requestBodies = {
  validUpdateProfile: {
    nickname: '更新后的用户',
    avatar: '🎯',
    avatarUrl: 'https://example.com/new-avatar.jpg',
    signature: '新签名',
    gender: 'male'
  },

  updateNicknameOnly: {
    nickname: '仅更新昵称'
  },

  updateWithoutNickname: {
    avatar: '🌟',
    avatarUrl: 'https://example.com/avatar.jpg'
  },

  validGetUser: {
    // no body needed for GET
  },

  invalidUserId: 'not-a-valid-id',

  adminUpdateUser: {
    status: 'inactive',
    role: 'admin'
  },

  adminActivateUser: {
    isActive: true,
    status: 'active'
  },

  adminDeactivateUser: {
    isActive: false,
    status: 'inactive'
  }
};

/**
 * 预期的 API 响应
 */
const expectedResponses = {
  successGetCurrentUser: {
    code: 200,
    message: undefined,
    data: {
      _id: testUsers.normalUser._id,
      openid: testUsers.normalUser.openid,
      nickname: testUsers.normalUser.nickname,
      avatar: testUsers.normalUser.avatar,
      avatarUrl: testUsers.normalUser.avatarUrl,
      signature: testUsers.normalUser.signature,
      gender: testUsers.normalUser.gender,
      totalCheckinDays: 10,
      currentStreak: 5,
      maxStreak: 8,
      totalCompletedPeriods: 2,
      totalPoints: 100,
      level: 2,
      role: 'user',
      status: 'active'
    }
  },

  successUpdateProfile: {
    code: 200,
    message: '资料更新成功',
    data: {
      _id: testUsers.normalUser._id,
      nickname: updateData.validUpdate.nickname,
      avatar: updateData.validUpdate.avatar,
      avatarUrl: updateData.validUpdate.avatarUrl,
      signature: updateData.validUpdate.signature,
      gender: updateData.validUpdate.gender
    }
  },

  successGetUserById: {
    code: 200,
    message: undefined,
    data: {
      _id: testUsers.normalUser._id,
      nickname: testUsers.normalUser.nickname,
      avatarUrl: testUsers.normalUser.avatarUrl,
      avatar: testUsers.normalUser.avatar,
      signature: testUsers.normalUser.signature,
      gender: testUsers.normalUser.gender,
      totalCheckinDays: 10,
      currentStreak: 5,
      maxStreak: 8,
      totalCompletedPeriods: 2,
      totalPoints: 100,
      level: 2,
      createdAt: testUsers.normalUser.createdAt
    }
  },

  successGetUserStats: {
    code: 200,
    message: undefined,
    data: {
      totalCheckinDays: 10,
      currentStreak: 5,
      maxStreak: 8,
      totalCompletedPeriods: 2,
      totalPoints: 100,
      level: 2
    }
  },

  successGetUserList: {
    code: 200,
    message: undefined,
    data: {
      list: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
      }
    }
  },

  errorBadRequest: {
    code: 400,
    message: '缺少必要参数'
  },

  errorUnauthorized: {
    code: 401,
    message: '未授权'
  },

  errorNotFound: {
    code: 404,
    message: '用户不存在'
  },

  errorForbidden: {
    code: 403,
    message: '用户已被禁用'
  }
};

/**
 * 统计数据场景
 */
const statsScenarios = {
  activeUser: {
    totalCheckinDays: 30,
    currentStreak: 15,
    maxStreak: 20,
    totalCompletedPeriods: 3,
    totalPoints: 300,
    level: 3
  },

  newbieUser: {
    totalCheckinDays: 1,
    currentStreak: 1,
    maxStreak: 1,
    totalCompletedPeriods: 0,
    totalPoints: 10,
    level: 1
  },

  inactiveUser: {
    totalCheckinDays: 0,
    currentStreak: 0,
    maxStreak: 5,
    totalCompletedPeriods: 0,
    totalPoints: 0,
    level: 1
  },

  powerUser: {
    totalCheckinDays: 100,
    currentStreak: 50,
    maxStreak: 100,
    totalCompletedPeriods: 10,
    totalPoints: 1000,
    level: 10
  }
};

/**
 * 权限检查场景
 */
const permissionScenarios = {
  selfUpdate: {
    description: '用户只能更新自己的信息',
    requesterId: testUsers.normalUser._id.toString(),
    targetId: testUsers.normalUser._id.toString(),
    shouldAllow: true
  },

  otherUserUpdate: {
    description: '用户不能更新他人的信息',
    requesterId: testUsers.normalUser._id.toString(),
    targetId: testUsers.anotherNormalUser._id.toString(),
    shouldAllow: false
  },

  adminUpdate: {
    description: '管理员可以更新任何用户的信息',
    requesterId: testUsers.adminUser._id.toString(),
    targetId: testUsers.normalUser._id.toString(),
    shouldAllow: true
  }
};

/**
 * 边界值和错误场景
 */
const edgeCases = {
  emptyUserId: '',
  nullUserId: null,
  undefinedUserId: undefined,
  invalidMongoId: 'not-a-mongo-id',
  malformedMongoId: '123456789012345678901',
  veryLongUserId: 'a'.repeat(10000),
  specialCharUserId: '!@#$%^&*()',
  unicodeUserId: '中文用户ID',
  emptyNickname: '',
  nullNickname: null,
  veryLongNickname: 'a'.repeat(10000),
  specialCharNickname: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  mongoInjectionNickname: { '$ne': null },
  sqlInjectionNickname: "'; DROP TABLE users; --"
};

module.exports = {
  testUsers,
  updateData,
  requestBodies,
  expectedResponses,
  statsScenarios,
  permissionScenarios,
  edgeCases
};
