/**
 * 测试用户数据
 */

const mongoose = require('mongoose');

const testUsers = {
  regularUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_001',
    nickname: '测试用户1',
    avatar: '🦁',
    avatarUrl: 'https://example.com/avatar1.jpg',
    signature: '这是一个测试签名',
    gender: 'male',
    role: 'user',
    status: 'active',
    totalCheckinDays: 10,
    currentStreak: 5,
    maxStreak: 8,
    totalCompletedPeriods: 2,
    totalPoints: 100,
    level: 2,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date()
  },

  inactiveUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_002',
    nickname: '禁用用户',
    avatar: '🐢',
    role: 'user',
    status: 'inactive',
    totalCheckinDays: 0,
    currentStreak: 0,
    maxStreak: 0,
    totalCompletedPeriods: 0,
    totalPoints: 0,
    level: 1,
    createdAt: new Date(),
    updatedAt: new Date()
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
    totalCompletedPeriods: 10,
    totalPoints: 1000,
    level: 10,
    createdAt: new Date(),
    updatedAt: new Date()
  },

  newUser: {
    _id: new mongoose.Types.ObjectId(),
    openid: 'test_openid_new',
    nickname: '微信用户',
    avatar: '🐱',
    role: 'user',
    status: 'active',
    totalCheckinDays: 0,
    currentStreak: 0,
    maxStreak: 0,
    totalCompletedPeriods: 0,
    totalPoints: 0,
    level: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  }
};

module.exports = testUsers;
