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

    const userId = req.user.userId;

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

// 获取用户的打卡列表
async function getUserCheckins(req, res, next) {
  try {
    const { page = 1, limit = 20, periodId } = req.query;
    const userId = req.params.userId || req.user.userId;

    const query = { userId };
    if (periodId) query.periodId = periodId;

    const total = await Checkin.countDocuments(query);
    const checkins = await Checkin.find(query)
      .populate('userId', 'nickname avatar avatarUrl')
      .populate('sectionId', 'title day icon')
      .populate('periodId', 'name title')
      .sort({ checkinDate: -1 })
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
