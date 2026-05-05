const mongoose = require('mongoose');
const UserActivity = require('../models/UserActivity');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');

const ACTION_LABELS = {
  app_open: '访问小程序',
  profile_update: '编辑个人资料',
  course_view: '查看课程',
  checkin_submit: '打卡',
  comment_create: '评论',
  like_create: '点赞',
  own_insight_view: '查看自己的小凡看见',
  other_insight_view: '查看他人的小凡看见',
  meeting_enter: '去晨读',
  insight_request_approve: '同意请求'
};

function getShanghaiDateKey(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function parseDateRange(query) {
  const end = query.endDate ? new Date(query.endDate) : new Date();
  const start = query.startDate ? new Date(query.startDate) : new Date(end);

  if (!query.startDate) {
    start.setDate(start.getDate() - 29);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function toObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }
  return new mongoose.Types.ObjectId(value);
}

exports.recordActivity = async (req, res) => {
  try {
    const { action, targetType, targetId, periodId, sectionId, metadata } =
      req.body || {};

    if (!UserActivity.ACTIONS.includes(action)) {
      return res.status(400).json(errors.badRequest('未知的行为类型'));
    }

    const occurredAt = new Date();
    const activity = await UserActivity.create({
      userId: req.user.userId || req.user._id,
      action,
      actionDate: getShanghaiDateKey(occurredAt),
      occurredAt,
      targetType: targetType || null,
      targetId: toObjectId(targetId),
      periodId: toObjectId(periodId),
      sectionId: toObjectId(sectionId),
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json(success({ id: activity._id }));
  } catch (error) {
    logger.error('记录用户行为失败:', error);
    res.status(500).json(errors.serverError('记录用户行为失败'));
  }
};

exports.getActivityAnalytics = async (req, res) => {
  try {
    const { start, end } = parseDateRange(req.query);
    const match = {
      occurredAt: { $gte: start, $lte: end }
    };

    if (req.query.action) {
      match.action = req.query.action;
    }

    const [dailyActionUsers, dailyActiveUsers, detailRows, totalActiveUsers] =
      await Promise.all([
        UserActivity.aggregate([
          { $match: match },
          {
            $group: {
              _id: { date: '$actionDate', action: '$action' },
              users: { $addToSet: '$userId' }
            }
          },
          {
            $project: {
              _id: 0,
              date: '$_id.date',
              action: '$_id.action',
              userCount: { $size: '$users' }
            }
          },
          { $sort: { date: 1, action: 1 } }
        ]),
        UserActivity.aggregate([
          { $match: match },
          { $group: { _id: '$actionDate', users: { $addToSet: '$userId' } } },
          {
            $project: {
              _id: 0,
              date: '$_id',
              activeUserCount: { $size: '$users' }
            }
          },
          { $sort: { date: 1 } }
        ]),
        UserActivity.aggregate([
          { $match: match },
          {
            $group: {
              _id: {
                date: '$actionDate',
                userId: '$userId',
                action: '$action'
              },
              count: { $sum: 1 },
              lastOccurredAt: { $max: '$occurredAt' }
            }
          },
          {
            $group: {
              _id: { date: '$_id.date', userId: '$_id.userId' },
              actions: {
                $push: {
                  action: '$_id.action',
                  label: { $literal: '' },
                  count: '$count',
                  lastOccurredAt: '$lastOccurredAt'
                }
              },
              totalCount: { $sum: '$count' },
              lastOccurredAt: { $max: '$lastOccurredAt' }
            }
          },
          { $sort: { '_id.date': -1, lastOccurredAt: -1 } },
          { $limit: 500 },
          {
            $lookup: {
              from: 'users',
              localField: '_id.userId',
              foreignField: '_id',
              as: 'user'
            }
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              date: '$_id.date',
              userId: '$_id.userId',
              nickname: { $ifNull: ['$user.nickname', '未知用户'] },
              phone: '$user.phone',
              avatar: '$user.avatar',
              avatarUrl: '$user.avatarUrl',
              actions: 1,
              totalCount: 1,
              lastOccurredAt: 1
            }
          }
        ]),
        UserActivity.distinct('userId', match)
      ]);

    const dailyMap = new Map();
    dailyActiveUsers.forEach((item) => {
      dailyMap.set(item.date, {
        date: item.date,
        activeUserCount: item.activeUserCount
      });
    });
    dailyActionUsers.forEach((item) => {
      const row = dailyMap.get(item.date) || {
        date: item.date,
        activeUserCount: 0
      };
      row[item.action] = item.userCount;
      dailyMap.set(item.date, row);
    });

    const dayCursor = new Date(start);
    while (dayCursor <= end) {
      const dateKey = getShanghaiDateKey(dayCursor);
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { date: dateKey, activeUserCount: 0 });
      }
      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    const daily = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const todayKey = getShanghaiDateKey(new Date());
    const today = daily.find((item) => item.date === todayKey) || {};
    const insightViewUsers = new Set();

    const todayInsightRows = await UserActivity.find({
      actionDate: todayKey,
      action: { $in: ['own_insight_view', 'other_insight_view'] }
    }).distinct('userId');
    todayInsightRows.forEach((id) => insightViewUsers.add(String(id)));

    const details = detailRows.map((row) => ({
      ...row,
      actions: row.actions.map((action) => ({
        ...action,
        label: ACTION_LABELS[action.action] || action.action
      }))
    }));

    res.json(
      success({
        actionLabels: ACTION_LABELS,
        summary: {
          totalActiveUsers: totalActiveUsers.length,
          todayAppOpenUsers: today.app_open || 0,
          todayCheckinUsers: today.checkin_submit || 0,
          todayInsightViewUsers: insightViewUsers.size,
          todayActiveUsers: today.activeUserCount || 0
        },
        daily,
        details
      })
    );
  } catch (error) {
    logger.error('获取活跃度分析失败:', error);
    res.status(500).json(errors.serverError('获取活跃度分析失败'));
  }
};

exports.ACTION_LABELS = ACTION_LABELS;
