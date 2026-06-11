const mongoose = require('mongoose');
const Checkin = require('../models/Checkin');
const User = require('../models/User');
const Period = require('../models/Period');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');

function getRequestUserId(req) {
  return req.user?.userId || req.user?.id || req.user?._id || '';
}

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

    const userId = getRequestUserId(req);

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

    // 用 $facet 同时取分页数据、总数、当前用户排名，避免重复执行全量聚合
    const facetPipeline = [
      ...pipeline,
      {
        $facet: {
          data: [
            { $skip: (parseInt(page, 10) - 1) * parseInt(limit, 10) },
            { $limit: parseInt(limit, 10) },
            {
              $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'userInfo'
              }
            },
            { $unwind: '$userInfo' }
          ],
          totalCount: [{ $count: 'count' }],
          // 全量排序结果用于计算当前用户排名（只取 _id 和 checkinCount，节省传输）
          allRanked: [
            { $project: { _id: 1, checkinCount: 1 } }
          ]
        }
      }
    ];

    const [facetResult] = await Checkin.aggregate(facetPipeline);
    const rankings = facetResult.data;
    const total = facetResult.totalCount[0]?.count ?? 0;
    const allRanked = facetResult.allRanked ?? [];

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
    const currentUserIndex = allRanked.findIndex(
      item => String(item._id) === String(userId)
    );

    let currentUser = null;
    const currentUserInfo = userId
      ? await User.findById(userId).select('nickname avatar avatarUrl')
      : null;

    if (currentUserIndex !== -1 && currentUserInfo) {
      const currentUserData = allRanked[currentUserIndex];
      currentUser = {
        rank: currentUserIndex + 1,
        userId,
        nickname: currentUserInfo.nickname,
        avatar: currentUserInfo.avatar,
        avatarUrl: currentUserInfo.avatarUrl,
        checkinCount: currentUserData.checkinCount
      };
    } else if (currentUserInfo) {
      currentUser = {
        rank: null,
        userId,
        nickname: currentUserInfo.nickname,
        avatar: currentUserInfo.avatar,
        avatarUrl: currentUserInfo.avatarUrl,
        checkinCount: 0
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
        timeRange,
        periodName: period.name
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
