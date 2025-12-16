/**
 * 测试数据导出
 */

const mongoose = require('mongoose');

const users = require('./users');

const testData = {
  users,

  // 测试期次数据
  periods: {
    activePeriod: {
      _id: new mongoose.Types.ObjectId(),
      name: '2024年第一期',
      title: '新年计划',
      description: '新年新开始，养成好习惯',
      status: 'active',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      duration: 365,
      capacity: 100,
      enrolledCount: 45,
      material: 'https://example.com/material.pdf',
      icon: '🎯',
      createdAt: new Date(),
      updatedAt: new Date()
    },

    inactivePeriod: {
      _id: new mongoose.Types.ObjectId(),
      name: '2024年第二期',
      title: '春季计划',
      status: 'inactive',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-06-30'),
      duration: 90,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  },

  // 测试课节数据
  sections: {
    activeSection: {
      _id: new mongoose.Types.ObjectId(),
      periodId: users.regularUser._id,
      day: 1,
      title: '第一课 - 养成习惯的科学',
      content: '了解习惯养成的心理学原理',
      duration: 30,
      icon: '📚',
      checkinCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  },

  // 测试打卡数据
  checkins: {
    validCheckin: {
      _id: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(),
      periodId: new mongoose.Types.ObjectId(),
      sectionId: new mongoose.Types.ObjectId(),
      day: 1,
      checkinDate: new Date(),
      readingTime: 30,
      completionRate: 100,
      note: '今天学到了很多东西，非常有收获！',
      images: [],
      mood: '😊',
      points: 10,
      isPublic: true,
      likeCount: 0,
      isFeatured: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }
};

module.exports = testData;
