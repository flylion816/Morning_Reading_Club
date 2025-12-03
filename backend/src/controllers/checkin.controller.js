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

    // 规范化checkinDate为当天的00:00:00（用于防止同一天重复打卡）
    const now = new Date();
    const checkinDateNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 检查是否已打卡（同一天、同一期次）
    const existingCheckin = await Checkin.findOne({
      userId,
      periodId,
      checkinDate: {
        $gte: checkinDateNormalized,
        $lt: new Date(checkinDateNormalized.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (existingCheckin) {
      return res.status(400).json(errors.badRequest('今日已打卡'));
    }

    // 创建打卡记录
    const checkin = await Checkin.create({
      userId,
      periodId,
      sectionId,
      day,
      checkinDate: checkinDateNormalized,  // 使用规范化的日期
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
    user.currentStreak += 1;
    user.maxStreak = Math.max(user.maxStreak, user.currentStreak);
    user.totalPoints += 10;
    await user.save();

    // 更新课节的打卡人数统计
    console.log('更新前 section.checkinCount:', section.checkinCount);
    section.checkinCount = (section.checkinCount || 0) + 1;
    console.log('更新后 section.checkinCount:', section.checkinCount);
    console.log('section对象:', section.toObject());

    try {
      const updatedSection = await section.save();
      console.log('✅ section.save() 成功，updatedSection.checkinCount:', updatedSection.checkinCount);
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

module.exports = {
  createCheckin,
  getUserCheckins,
  getPeriodCheckins,
  getCheckinDetail,
  deleteCheckin
};
