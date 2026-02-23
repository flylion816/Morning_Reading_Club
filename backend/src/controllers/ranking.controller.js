const mongoose = require('mongoose');
const Checkin = require('../models/Checkin');
const User = require('../models/User');
const Period = require('../models/Period');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * 获取期次排行榜
 * 按照期次内的打卡次数排名
 * GET /api/v1/periods/:periodId/ranking
 */
async function getPeriodRanking(req, res, next) {
  try {
    const { periodId } = req.params;
    const {
      timeRange = 'all', // all, thisWeek, lastWeek, today, yesterday
      page = 1,
      limit = 20
    } = req.query;

    const { userId } = req.user;

    // 验证期次是否存在
    const period = await Period.findById(periodId);
    if (!period) {
      return res.status(404).json(errors.notFound('期次不存在'));
    }

    // 计算时间范围
    const now = new Date();
    let dateQuery = {};

    switch (timeRange) {
      case 'today': {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        dateQuery = { $gte: startOfToday, $lt: endOfToday };
        break;
      }
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const startOfYesterday = new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate()
        );
        const endOfYesterday = new Date(startOfYesterday.getTime() + 24 * 60 * 60 * 1000);
        dateQuery = { $gte: startOfYesterday, $lt: endOfYesterday };
        break;
      }
      case 'thisWeek': {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        dateQuery = { $gte: weekStart };
        break;
      }
      case 'lastWeek': {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() - 7);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        dateQuery = { $gte: weekStart, $lt: weekEnd };
        break;
      }
      case 'all':
      default: {
        // 不限制日期
        break;
      }
    }

    // 聚合管道：统计每个用户在该期次的打卡次数
    const pipeline = [
      {
        $match: {
          periodId: new mongoose.Types.ObjectId(periodId)
        }
      }
    ];

    // 如果有时间限制，添加日期过滤
    if (Object.keys(dateQuery).length > 0) {
      pipeline.push({
        $match: { checkinDate: dateQuery }
      });
    }

    // 按用户分组，统计打卡次数
    pipeline.push({
      $group: {
        _id: '$userId',
        checkinCount: { $sum: 1 },
        lastCheckinDate: { $max: '$checkinDate' }
      }
    });

    // 排序：打卡次数多的排前面，相同次数按最后打卡时间排
    pipeline.push({
      $sort: {
        checkinCount: -1,
        lastCheckinDate: -1
      }
    });

    // 获取总数
    const countPipeline = [...pipeline];
    const countResult = await Checkin.aggregate(countPipeline);
    const total = countResult.length;

    // 分页
    pipeline.push(
      { $skip: (parseInt(page, 10) - 1) * parseInt(limit, 10) },
      { $limit: parseInt(limit, 10) }
    );

    // 填充用户信息
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userInfo'
      }
    });

    pipeline.push({
      $unwind: '$userInfo'
    });

    // 执行聚合查询
    const rankings = await Checkin.aggregate(pipeline);

    // 转换数据格式，添加排名和前端需要的字段
    const list = rankings.map((item, index) => ({
      rank: (parseInt(page, 10) - 1) * parseInt(limit, 10) + index + 1,
      userId: item._id.toString(),
      nickname: item.userInfo.nickname,
      avatar: item.userInfo.avatar,
      avatarUrl: item.userInfo.avatarUrl,
      checkinCount: item.checkinCount,
      lastCheckinDate: item.lastCheckinDate
    }));

    // 获取当前用户的排名和打卡次数
    const currentUserIndex = countResult.findIndex(item => item._id.toString() === userId);

    let currentUser = null;
    if (currentUserIndex !== -1) {
      const currentUserData = countResult[currentUserIndex];
      const currentUserInfo = await User.findById(userId).select('nickname avatar avatarUrl');
      currentUser = {
        rank: currentUserIndex + 1,
        userId,
        nickname: currentUserInfo.nickname,
        avatar: currentUserInfo.avatar,
        avatarUrl: currentUserInfo.avatarUrl,
        checkinCount: currentUserData.checkinCount
      };
    }

    res.json(
      success({
        list,
        currentUser,
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10)),
        timeRange
      })
    );
  } catch (error) {
    logger.error('获取排行榜失败:', error);
    next(error);
  }
}

module.exports = {
  getPeriodRanking
};
