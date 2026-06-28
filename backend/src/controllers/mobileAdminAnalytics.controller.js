const mongoose = require('mongoose');
const Enrollment = require('../models/Enrollment');
const Payment = require('../models/Payment');
const Period = require('../models/Period');
const User = require('../models/User');
const UserActivity = require('../models/UserActivity');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');

const ADMIN_ROLES = ['admin', 'super_admin'];

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
  insight_request_approve: '同意请求',
  zaichang_list_view: '进入在场列表',
  zaichang_publish_view: '进入发布印记页',
  zaichang_imprint_publish: '发布印记',
  zaichang_detail_view: '查看印记详情',
  zaichang_imprint_like: '点赞印记',
  zaichang_imprint_comment: '评论印记',
  index_popup_view: '点击首页弹窗',
  index_podcast_enter: '首页进入播客',
  checkin_records_view: '查看我的打卡',
  course_ai_read: '课程 AI 朗读',
  insight_ai_read: '小凡看见 AI 朗读',
  insight_share: '分享小凡看见',
  insight_like: '小凡看见点赞',
  insight_danmaku: '小凡看见发弹幕',
  podcast_play: '播客播放',
  podcast_bar_play: '底部悬浮窗播放播客',
  podcast_share: '播客分享',
  closing_video_share: '结营视频分享',
  course_share: '课程分享',
  activity_enroll: '活动报名'
};

const TREND_ACTIONS = [
  'app_open',
  'checkin_submit',
  'own_insight_view',
  'other_insight_view',
  'course_view',
  'meeting_enter'
];

function getShanghaiDateKey(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function parseDateKey(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return getShanghaiDateKey(date);
}

function parseDateRange(query = {}) {
  const todayKey = getShanghaiDateKey(new Date());
  const endKey = parseDateKey(query.endDate) || todayKey;
  const startKey = parseDateKey(query.startDate) || addDays(endKey, -29);

  const start = new Date(`${startKey}T00:00:00.000+08:00`);
  const end = new Date(`${endKey}T23:59:59.999+08:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    const error = new Error('日期范围无效');
    error.statusCode = 400;
    throw error;
  }

  return { startKey, endKey, start, end };
}

function buildDateRows(startKey, endKey, base = {}) {
  const rows = [];
  let cursor = startKey;
  while (cursor <= endKey) {
    rows.push({ date: cursor, ...base });
    cursor = addDays(cursor, 1);
  }
  return rows;
}

function toObjectId(value) {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

async function resolvePeriod(periodId) {
  const objectId = toObjectId(periodId);
  if (!periodId) return null;
  if (!objectId) {
    const error = new Error('期次参数无效');
    error.statusCode = 400;
    throw error;
  }

  const period = await Period.findById(objectId).select('_id name title').lean();
  if (!period) {
    const error = new Error('期次不存在或无权限访问');
    error.statusCode = 404;
    throw error;
  }
  return objectId;
}

function handleControllerError(res, error, logMessage) {
  if (error.statusCode === 400) {
    return res.status(400).json(errors.badRequest(error.message));
  }
  if (error.statusCode === 403) {
    return res.status(403).json(errors.forbidden(error.message));
  }
  if (error.statusCode === 404) {
    return res.status(404).json(errors.notFound(error.message));
  }
  logger.error(logMessage, error);
  return res.status(500).json(errors.serverError(logMessage));
}

async function requireMobileAdmin(req, res, next) {
  try {
    const userId = req.user?.userId || req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json(errors.unauthorized('未登录'));
    }

    const user = await User.findById(userId).select('role status nickname phone').lean();
    if (!user || user.status !== 'active' || !ADMIN_ROLES.includes(user.role)) {
      return res.status(403).json(errors.forbidden('需要管理员权限'));
    }

    req.mobileAdmin = user;
    return next();
  } catch (error) {
    logger.error('移动端管理员鉴权失败:', error);
    return res.status(500).json(errors.serverError('移动端管理员鉴权失败'));
  }
}

async function getPeriodOptions(req, res) {
  try {
    const periods = await Period.find({})
      .select('_id name title startDate endDate status')
      .sort({ startDate: -1, createdAt: -1 })
      .lean();

    res.json(
      success({
        list: periods.map((period) => ({
          id: period._id.toString(),
          name: period.name || period.title || '未命名期次',
          title: period.title || '',
          startDate: period.startDate,
          endDate: period.endDate,
          status: period.status
        }))
      })
    );
  } catch (error) {
    handleControllerError(res, error, '获取移动端数据分析期次失败');
  }
}

async function getOverviewAnalytics(req, res) {
  try {
    const { startKey, endKey, start, end } = parseDateRange(req.query);
    const periodObjectId = await resolvePeriod(req.query.periodId);
    const enrollmentMatch = {
      deleted: { $ne: true },
      enrolledAt: { $gte: start, $lte: end }
    };
    if (periodObjectId) enrollmentMatch.periodId = periodObjectId;

    const paymentDateStage = {
      $addFields: {
        analyticsPaidAt: {
          $ifNull: ['$paidAt', { $ifNull: ['$wechat.successTime', '$createdAt'] }]
        }
      }
    };
    const paymentMatch = {
      status: 'completed',
      analyticsPaidAt: { $gte: start, $lte: end }
    };
    if (periodObjectId) {
      paymentMatch.periodId = periodObjectId;
    }

    const [
      totalUsers,
      rangeNewUsers,
      enrollmentSummary,
      enrollmentTrendRaw,
      paymentSummary,
      paymentTrendRaw,
      paymentMethodDistribution,
      periodPopularity
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: start, $lte: end } }),
      Enrollment.aggregate([
        { $match: enrollmentMatch },
        {
          $group: {
            _id: null,
            totalEnrollments: { $sum: 1 },
            paidEnrollments: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
            }
          }
        }
      ]),
      Enrollment.aggregate([
        { $match: enrollmentMatch },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$enrolledAt',
                timezone: '+08:00'
              }
            },
            enrollmentCount: { $sum: 1 },
            paidEnrollmentCount: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Payment.aggregate([
        paymentDateStage,
        { $match: paymentMatch },
        {
          $group: {
            _id: null,
            enrollmentRevenue: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $ne: ['$enrollmentId', null] },
                      { $and: [{ $ne: ['$periodId', null] }, { $eq: ['$registrationId', null] }] }
                    ]
                  },
                  '$amount',
                  0
                ]
              }
            },
            activityRevenue: {
              $sum: {
                $cond: [{ $ne: ['$registrationId', null] }, '$amount', 0]
              }
            },
            totalRevenue: { $sum: '$amount' },
            paymentCount: { $sum: 1 }
          }
        }
      ]),
      Payment.aggregate([
        paymentDateStage,
        { $match: paymentMatch },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$analyticsPaidAt',
                timezone: '+08:00'
              }
            },
            enrollmentAmount: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $ne: ['$enrollmentId', null] },
                      { $and: [{ $ne: ['$periodId', null] }, { $eq: ['$registrationId', null] }] }
                    ]
                  },
                  '$amount',
                  0
                ]
              }
            },
            activityAmount: {
              $sum: {
                $cond: [{ $ne: ['$registrationId', null] }, '$amount', 0]
              }
            },
            totalAmount: { $sum: '$amount' },
            paymentCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Payment.aggregate([
        paymentDateStage,
        { $match: paymentMatch },
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            amount: { $sum: '$amount' }
          }
        },
        { $sort: { amount: -1, count: -1 } },
        {
          $project: {
            _id: 0,
            method: { $ifNull: ['$_id', 'unknown'] },
            count: 1,
            amount: 1
          }
        }
      ]),
      Enrollment.aggregate([
        { $match: enrollmentMatch },
        {
          $group: {
            _id: '$periodId',
            enrollmentCount: { $sum: 1 },
            paidEnrollmentCount: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
            }
          }
        },
        { $sort: { enrollmentCount: -1 } },
        { $limit: periodObjectId ? 1 : 10 },
        {
          $lookup: {
            from: 'periods',
            localField: '_id',
            foreignField: '_id',
            as: 'period'
          }
        },
        { $unwind: { path: '$period', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            periodId: '$_id',
            periodName: { $ifNull: ['$period.name', '已删除的期次'] },
            enrollmentCount: 1,
            paidEnrollmentCount: 1
          }
        }
      ])
    ]);

    const enrollmentTotals = enrollmentSummary[0] || {};
    const paymentTotals = paymentSummary[0] || {};
    const totalEnrollments = enrollmentTotals.totalEnrollments || 0;
    const paidEnrollments = enrollmentTotals.paidEnrollments || 0;

    const enrollmentTrendMap = new Map(
      enrollmentTrendRaw.map((item) => [
        item._id,
        {
          date: item._id,
          enrollmentCount: item.enrollmentCount || 0,
          paidEnrollmentCount: item.paidEnrollmentCount || 0
        }
      ])
    );
    const paymentTrendMap = new Map(
      paymentTrendRaw.map((item) => [
        item._id,
        {
          date: item._id,
          enrollmentAmount: item.enrollmentAmount || 0,
          activityAmount: item.activityAmount || 0,
          totalAmount: item.totalAmount || 0,
          paymentCount: item.paymentCount || 0
        }
      ])
    );

    const enrollmentTrend = buildDateRows(startKey, endKey, {
      enrollmentCount: 0,
      paidEnrollmentCount: 0
    }).map((row) => enrollmentTrendMap.get(row.date) || row);
    const paymentTrend = buildDateRows(startKey, endKey, {
      enrollmentAmount: 0,
      activityAmount: 0,
      totalAmount: 0,
      paymentCount: 0
    }).map((row) => paymentTrendMap.get(row.date) || row);

    res.json(
      success({
        filters: {
          startDate: startKey,
          endDate: endKey,
          periodId: periodObjectId ? periodObjectId.toString() : ''
        },
        summary: {
          totalUsers,
          rangeNewUsers,
          totalEnrollments,
          paidEnrollments,
          enrollmentRevenue: paymentTotals.enrollmentRevenue || 0,
          activityRevenue: paymentTotals.activityRevenue || 0,
          totalRevenue: paymentTotals.totalRevenue || 0,
          paymentCount: paymentTotals.paymentCount || 0,
          conversionRate: totalEnrollments
            ? Number(((paidEnrollments / totalEnrollments) * 100).toFixed(1))
            : 0
        },
        enrollmentTrend,
        paymentTrend,
        periodPopularity: periodPopularity.map((item) => ({
          ...item,
          periodId: item.periodId ? item.periodId.toString() : ''
        })),
        paymentMethodDistribution
      })
    );
  } catch (error) {
    handleControllerError(res, error, '获取移动端业务概览失败');
  }
}

async function aggregateActivitySummary(baseMatch, dateKey) {
  const [rows, activeRows, insightRows] = await Promise.all([
    UserActivity.aggregate([
      { $match: { ...baseMatch, actionDate: dateKey } },
      {
        $group: {
          _id: '$action',
          users: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          _id: 0,
          action: '$_id',
          userCount: { $size: '$users' }
        }
      }
    ]),
    UserActivity.aggregate([
      { $match: { ...baseMatch, actionDate: dateKey } },
      {
        $group: {
          _id: null,
          users: { $addToSet: '$userId' }
        }
      },
      { $project: { _id: 0, activeUsers: { $size: '$users' } } }
    ]),
    UserActivity.aggregate([
      {
        $match: {
          ...baseMatch,
          actionDate: dateKey,
          action: { $in: ['own_insight_view', 'other_insight_view'] }
        }
      },
      {
        $group: {
          _id: null,
          users: { $addToSet: '$userId' }
        }
      },
      { $project: { _id: 0, insightViewUsers: { $size: '$users' } } }
    ])
  ]);

  const map = rows.reduce((acc, item) => {
    acc[item.action] = item.userCount || 0;
    return acc;
  }, {});

  return {
    appOpenUsers: map.app_open || 0,
    checkinUsers: map.checkin_submit || 0,
    insightViewUsers: insightRows[0]?.insightViewUsers || 0,
    activeUsers: activeRows[0]?.activeUsers || 0
  };
}

function diffSummary(today, yesterday) {
  return {
    appOpenUsers: today.appOpenUsers - yesterday.appOpenUsers,
    checkinUsers: today.checkinUsers - yesterday.checkinUsers,
    insightViewUsers: today.insightViewUsers - yesterday.insightViewUsers,
    activeUsers: today.activeUsers - yesterday.activeUsers
  };
}

async function getActivityAnalytics(req, res) {
  try {
    const { startKey, endKey, start, end } = parseDateRange(req.query);
    const periodObjectId = await resolvePeriod(req.query.periodId);
    const rangeMatch = {
      occurredAt: { $gte: start, $lte: end }
    };
    const baseMatch = {};
    if (periodObjectId) {
      rangeMatch.periodId = periodObjectId;
      baseMatch.periodId = periodObjectId;
    }

    const [dailyActionUsers, dailyActiveUsers, detailRows] = await Promise.all([
      UserActivity.aggregate([
        { $match: rangeMatch },
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
        { $match: rangeMatch },
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
        { $match: rangeMatch },
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
                count: '$count',
                lastOccurredAt: '$lastOccurredAt'
              }
            },
            totalCount: { $sum: '$count' },
            lastOccurredAt: { $max: '$lastOccurredAt' }
          }
        },
        { $sort: { '_id.date': -1, totalCount: -1, lastOccurredAt: -1 } },
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
            avatarUrl: '$user.avatarUrl',
            actions: 1,
            totalCount: 1,
            lastOccurredAt: 1
          }
        }
      ])
    ]);

    const trendMap = new Map();
    dailyActiveUsers.forEach((item) => {
      trendMap.set(item.date, {
        date: item.date,
        activeUserCount: item.activeUserCount || 0
      });
    });
    dailyActionUsers.forEach((item) => {
      const row = trendMap.get(item.date) || {
        date: item.date,
        activeUserCount: 0
      };
      if (TREND_ACTIONS.includes(item.action)) {
        row[item.action] = item.userCount || 0;
      }
      trendMap.set(item.date, row);
    });

    const emptyTrendBase = TREND_ACTIONS.reduce(
      (acc, action) => ({ ...acc, [action]: 0 }),
      { activeUserCount: 0 }
    );
    const trend = buildDateRows(startKey, endKey, emptyTrendBase).map(
      (row) => ({ ...row, ...(trendMap.get(row.date) || {}) })
    );

    const todayKey = getShanghaiDateKey(new Date());
    const yesterdayKey = addDays(todayKey, -1);
    const [today, yesterday] = await Promise.all([
      aggregateActivitySummary(baseMatch, todayKey),
      aggregateActivitySummary(baseMatch, yesterdayKey)
    ]);

    res.json(
      success({
        filters: {
          startDate: startKey,
          endDate: endKey,
          periodId: periodObjectId ? periodObjectId.toString() : ''
        },
        summary: {
          today,
          yesterday,
          delta: diffSummary(today, yesterday)
        },
        actionLabels: ACTION_LABELS,
        trend,
        details: detailRows.map((row) => ({
          ...row,
          userId: row.userId ? row.userId.toString() : '',
          actions: row.actions.map((action) => ({
            ...action,
            label: ACTION_LABELS[action.action] || action.action
          }))
        }))
      })
    );
  } catch (error) {
    handleControllerError(res, error, '获取移动端活跃度分析失败');
  }
}

module.exports = {
  requireMobileAdmin,
  getPeriodOptions,
  getOverviewAnalytics,
  getActivityAnalytics,
  ACTION_LABELS,
  TREND_ACTIONS,
  parseDateRange,
  getShanghaiDateKey
};
