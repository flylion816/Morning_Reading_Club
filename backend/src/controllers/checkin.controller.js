const Checkin = require('../models/Checkin');
const User = require('../models/User');
const Section = require('../models/Section');
const { success, errors } = require('../utils/response');

// 创建打卡记录
async function createCheckin(req, res, next) {
  try {
    const {
      periodId,
      sectionId,
      day,
      readingTime,
      completionRate,
      note,
      images,
      mood,
      isPublic
    } = req.body;

    // JWT payload from admin controller uses 'id', from auth uses 'userId'
    const userId = req.user.id || req.user.userId;

    // 验证课程存在
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json(errors.notFound('课程不存在'));
    }

    // 规范化checkinDate为当天的00:00:00（仅用于连续打卡计算）
    const now = new Date();
    const checkinDateNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 创建打卡记录
    // 注意：不再限制每日一次打卡，checkinDate使用当前精确时间
    const checkin = await Checkin.create({
      userId,
      periodId,
      sectionId,
      day,
      checkinDate: now,  // 使用当前精确时间，避免唯一索引冲突
      readingTime: readingTime || 0,
      completionRate: completionRate || 100,
      note,
      images: images || [],
      mood,
      points: 10,
      isPublic: isPublic !== undefined ? isPublic : true
    });

    // 更新用户统计
    const user = await User.findById(userId);
    user.totalCheckinDays += 1;
    user.totalPoints += 10;

    // 计算连续打卡天数：检查前一天是否打卡
    const yesterday = new Date(checkinDateNormalized);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const yesterdayCheckin = await Checkin.findOne({
      userId,
      checkinDate: {
        $gte: yesterdayStart,
        $lte: yesterdayEnd
      }
    });

    // 如果昨天有打卡，连续天数 +1；否则重置为 1
    if (yesterdayCheckin) {
      user.currentStreak += 1;
    } else {
      user.currentStreak = 1;
    }

    user.maxStreak = Math.max(user.maxStreak, user.currentStreak);
    await user.save();

    // 更新课节的打卡人数统计
    console.log('=== 更新Section.checkinCount ===');
    console.log('更新前 checkinCount:', section.checkinCount);
    section.checkinCount = (section.checkinCount || 0) + 1;
    console.log('更新后 checkinCount:', section.checkinCount);

    try {
      await section.save();
      console.log('✅ section.save() 成功');

      // 验证保存结果
      const verifySection = await Section.findById(section._id);
      console.log('✅ 验证成功，数据库中的checkinCount:', verifySection.checkinCount);
    } catch (saveError) {
      console.error('❌ section.save() 失败:', saveError);
    }

    res.status(201).json(success({
      checkin,
      userStats: {
        totalCheckinDays: user.totalCheckinDays,
        currentStreak: user.currentStreak,
        totalPoints: user.totalPoints
      }
    }, '打卡成功'));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json(errors.badRequest('今日已打卡'));
    }
    next(error);
  }
}

// 获取用户的打卡列表（包含统计和日历数据）
async function getUserCheckins(req, res, next) {
  try {
    const { page = 1, limit = 20, periodId, year, month } = req.query;
    const userId = req.params.userId || req.user.userId;

    const query = { userId };
    if (periodId) query.periodId = periodId;

    // 获取打卡列表
    const total = await Checkin.countDocuments(query);
    const checkins = await Checkin.find(query)
      .populate('userId', 'nickname avatar avatarUrl')
      .populate('sectionId', 'title day icon')
      .populate('periodId', 'name title')
      .sort({ checkinDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-__v');

    // 计算统计数据
    const stats = {
      diaryCount: 0,        // 日记总数（有内容的打卡）
      featuredCount: 0,     // 精选次数
      likeCount: 0,         // 获赞总数
      totalDays: 0,         // 总打卡天数
      consecutiveDays: 0    // 连续打卡天数（待计算）
    };

    // 统计所有打卡记录
    const allCheckins = await Checkin.find(query).select('note likeCount isFeatured checkinDate');

    stats.diaryCount = allCheckins.filter(c => c.note && c.note.trim().length > 0).length;
    stats.featuredCount = allCheckins.filter(c => c.isFeatured).length;
    stats.likeCount = allCheckins.reduce((sum, c) => sum + (c.likeCount || 0), 0);
    stats.totalDays = allCheckins.length;

    // 计算连续打卡天数
    if (allCheckins.length > 0) {
      const sortedCheckins = allCheckins.sort((a, b) => b.checkinDate - a.checkinDate);
      let consecutive = 0;
      let expectedDate = new Date();
      expectedDate.setHours(0, 0, 0, 0);

      for (const checkin of sortedCheckins) {
        const checkinDateNormalized = new Date(checkin.checkinDate);
        checkinDateNormalized.setHours(0, 0, 0, 0);

        if (expectedDate.getTime() === checkinDateNormalized.getTime()) {
          consecutive++;
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
          break;
        }
      }
      stats.consecutiveDays = consecutive;
    }

    // 如果提供了year和month，计算日历数据
    let calendar = null;
    if (year && month) {
      const targetYear = parseInt(year);
      const targetMonth = parseInt(month);

      // 获取指定月份的所有打卡日期
      const monthStart = new Date(targetYear, targetMonth - 1, 1);
      const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

      const monthCheckins = await Checkin.find({
        ...query,
        checkinDate: {
          $gte: monthStart,
          $lte: monthEnd
        }
      }).select('checkinDate');

      // 提取打卡的日期（仅日期部分）
      const checkinDays = monthCheckins.map(c => new Date(c.checkinDate).getDate());

      calendar = {
        year: targetYear,
        month: targetMonth,
        checkinDays: [...new Set(checkinDays)].sort((a, b) => a - b)
      };
    }

    res.json(success({
      list: checkins,
      stats,
      calendar,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error) {
    next(error);
  }
}

// 获取期次的打卡列表（广场）
async function getPeriodCheckins(req, res, next) {
  try {
    const { periodId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const query = {
      periodId,
      isPublic: true,
      note: { $ne: null, $ne: '' }
    };

    const total = await Checkin.countDocuments(query);
    const checkins = await Checkin.find(query)
      .populate('userId', 'nickname avatar avatarUrl')
      .populate('sectionId', 'title day')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-__v');

    res.json(success({
      list: checkins,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error) {
    next(error);
  }
}

// 获取打卡详情
async function getCheckinDetail(req, res, next) {
  try {
    const { checkinId } = req.params;

    const checkin = await Checkin.findById(checkinId)
      .populate('userId', 'nickname avatar avatarUrl signature')
      .populate('sectionId', 'title day icon')
      .populate('periodId', 'name title');

    if (!checkin) {
      return res.status(404).json(errors.notFound('打卡记录不存在'));
    }

    res.json(success(checkin));
  } catch (error) {
    next(error);
  }
}

// 删除打卡记录
async function deleteCheckin(req, res, next) {
  try {
    const { checkinId } = req.params;
    const userId = req.user.userId;

    const checkin = await Checkin.findById(checkinId);

    if (!checkin) {
      return res.status(404).json(errors.notFound('打卡记录不存在'));
    }

    // 只能删除自己的打卡
    if (checkin.userId.toString() !== userId) {
      return res.status(403).json(errors.forbidden('无权删除'));
    }

    await Checkin.findByIdAndDelete(checkinId);

    // 更新用户统计
    const user = await User.findById(userId);
    user.totalCheckinDays = Math.max(0, user.totalCheckinDays - 1);
    user.totalPoints = Math.max(0, user.totalPoints - checkin.points);
    await user.save();

    res.json(success(null, '打卡删除成功'));
  } catch (error) {
    next(error);
  }
}

// 【Admin】获取所有打卡记录（后台管理）
async function getAdminCheckins(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      userId,
      periodId,
      dateFrom,
      dateTo,
      search
    } = req.query;

    const query = {};

    // 按用户筛选
    if (userId) {
      query.userId = userId;
    }

    // 按期次筛选
    if (periodId) {
      query.periodId = periodId;
    }

    // 按日期范围筛选
    if (dateFrom || dateTo) {
      query.checkinDate = {};
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        query.checkinDate.$gte = fromDate;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query.checkinDate.$lte = toDate;
      }
    }

    // 按用户名或用户ID搜索
    if (search) {
      const searchUsers = await User.find({
        $or: [
          { nickname: { $regex: search, $options: 'i' } },
          { openid: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = searchUsers.map(u => u._id);
      if (userIds.length > 0) {
        query.userId = { $in: userIds };
      } else {
        // 搜索无结果
        return res.json(success({
          list: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          },
          stats: {
            totalCount: 0,
            todayCount: 0,
            totalPoints: 0
          }
        }));
      }
    }

    // 获取总数
    const total = await Checkin.countDocuments(query);

    // 获取打卡列表
    const checkins = await Checkin.find(query)
      .populate('userId', 'nickname avatar avatarUrl openid')
      .populate('sectionId', 'title day')
      .populate('periodId', 'name title')
      .sort({ checkinDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-__v');

    // 计算统计信息
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCount = await Checkin.countDocuments({
      checkinDate: {
        $gte: today,
        $lt: tomorrow
      }
    });

    const allCheckins = await Checkin.find(query).select('points');
    const totalPoints = allCheckins.reduce((sum, c) => sum + (c.points || 0), 0);

    res.json(success({
      list: checkins,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      stats: {
        totalCount: total,
        todayCount,
        totalPoints
      }
    }));
  } catch (error) {
    next(error);
  }
}

// 【Admin】删除打卡记录（管理员可删除任何记录）
async function deleteAdminCheckin(req, res, next) {
  try {
    const { checkinId } = req.params;

    const checkin = await Checkin.findById(checkinId);

    if (!checkin) {
      return res.status(404).json(errors.notFound('打卡记录不存在'));
    }

    // 更新用户统计
    const user = await User.findById(checkin.userId);
    if (user) {
      user.totalCheckinDays = Math.max(0, user.totalCheckinDays - 1);
      user.totalPoints = Math.max(0, user.totalPoints - (checkin.points || 0));
      await user.save();
    }

    // 更新课节统计
    const section = await Section.findById(checkin.sectionId);
    if (section) {
      section.checkinCount = Math.max(0, (section.checkinCount || 1) - 1);
      await section.save();
    }

    // 删除打卡记录
    await Checkin.findByIdAndDelete(checkinId);

    res.json(success(null, '打卡记录已删除'));
  } catch (error) {
    next(error);
  }
}

// 【Admin】获取打卡统计数据
async function getCheckinStats(req, res, next) {
  try {
    const { periodId, dateFrom, dateTo } = req.query;

    const query = {};

    if (periodId) {
      query.periodId = periodId;
    }

    // 按日期范围筛选
    if (dateFrom || dateTo) {
      query.checkinDate = {};
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        query.checkinDate.$gte = fromDate;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query.checkinDate.$lte = toDate;
      }
    }

    // 总统计
    const totalCount = await Checkin.countDocuments(query);
    const uniqueUsers = await Checkin.distinct('userId', query);

    // 使用聚合计算总积分和总点赞数，避免加载所有文档
    const statsAggregation = await Checkin.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalPoints: { $sum: '$points' },
          totalLikes: { $sum: '$likeCount' },
          featuredCount: {
            $sum: { $cond: [{ $eq: ['$isFeatured', true] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = statsAggregation.length > 0 ? statsAggregation[0] : {
      totalPoints: 0,
      totalLikes: 0,
      featuredCount: 0
    };

    // 今日统计
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCount = await Checkin.countDocuments({
      ...query,
      checkinDate: {
        $gte: today,
        $lt: tomorrow
      }
    });

    res.json(success({
      totalCount,
      todayCount,
      uniqueUserCount: uniqueUsers.length,
      totalPoints: stats.totalPoints,
      totalLikes: stats.totalLikes,
      featuredCount: stats.featuredCount,
      averagePointsPerUser: uniqueUsers.length > 0 ? (stats.totalPoints / uniqueUsers.length).toFixed(2) : 0
    }));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createCheckin,
  getUserCheckins,
  getPeriodCheckins,
  getCheckinDetail,
  deleteCheckin,
  // Admin functions
  getAdminCheckins,
  deleteAdminCheckin,
  getCheckinStats
};
