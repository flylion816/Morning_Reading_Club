const Period = require('../models/Period')
const Enrollment = require('../models/Enrollment')
const Payment = require('../models/Payment')
const Checkin = require('../models/Checkin')
const User = require('../models/User')
const { success, errors } = require('../utils/response')

/**
 * 获取仪表板统计数据
 * 返回：总报名数、总支付数、活跃期次、最近报名等
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date()

    // 获取所有期次
    const totalPeriods = await Period.countDocuments({})

    // 获取活跃期次（当前日期在期次时间范围内）
    const activePeriods = await Period.countDocuments({
      startDate: { $lte: now },
      endDate: { $gte: now }
    })

    // 获取总报名数
    const totalEnrollments = await Enrollment.countDocuments({})

    // 获取待审批报名数
    const pendingEnrollments = await Enrollment.countDocuments({
      approvalStatus: 'pending'
    })

    // 获取已支付报名数
    const paidEnrollments = await Enrollment.countDocuments({
      paymentStatus: 'paid'
    })

    // 获取总支付金额
    const paymentStats = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
    ])
    const totalPaymentAmount = paymentStats[0]?.totalAmount || 0

    // 获取最近10条报名记录
    const recentEnrollments = await Enrollment.find({})
      .populate('userId', 'nickname avatar')
      .populate('periodId', 'name')
      .sort({ enrolledAt: -1 })
      .limit(10)
      .lean()

    // 获取活跃用户数
    const activeUsers = await User.countDocuments({
      lastLoginAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    })

    res.json(success({
      totalPeriods,
      activePeriods,
      totalEnrollments,
      pendingEnrollments,
      paidEnrollments,
      totalPaymentAmount,
      activeUsers,
      recentEnrollments: recentEnrollments.map(e => ({
        id: e._id,
        userName: e.userId?.nickname || '匿名用户',
        userAvatar: e.userId?.avatar,
        periodName: e.periodId?.name || '已删除的期次',
        enrolledAt: e.enrolledAt,
        approvalStatus: e.approvalStatus,
        paymentStatus: e.paymentStatus
      }))
    }))
  } catch (error) {
    console.error('获取仪表板统计失败:', error)
    res.status(500).json(errors.internalServerError('获取仪表板统计失败'))
  }
}

/**
 * 获取报名统计数据
 * 返回：各期次的报名数、性别分布、地区分布、审批状态分布等
 */
exports.getEnrollmentStats = async (req, res) => {
  try {
    // 各期次的报名数
    const periodStats = await Enrollment.aggregate([
      { $group: {
        _id: '$periodId',
        count: { $sum: 1 },
        approved: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'approved'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'pending'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$approvalStatus', 'rejected'] }, 1, 0] } }
      }},
      { $lookup: { from: 'periods', localField: '_id', foreignField: '_id', as: 'period' }},
      { $unwind: '$period' },
      { $project: {
        _id: 1,
        periodName: '$period.name',
        total: '$count',
        approved: 1,
        pending: 1,
        rejected: 1
      }}
    ])

    // 性别分布
    const genderStats = await Enrollment.aggregate([
      { $group: {
        _id: '$gender',
        count: { $sum: 1 }
      }},
      { $project: {
        gender: '$_id',
        count: 1,
        _id: 0
      }}
    ])

    // 地区分布（前10）
    const regionStats = await Enrollment.aggregate([
      { $group: {
        _id: '$province',
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 }},
      { $limit: 10 },
      { $project: {
        province: '$_id',
        count: 1,
        _id: 0
      }}
    ])

    // 年龄分布
    const ageStats = await Enrollment.aggregate([
      { $bucket: {
        groupBy: '$age',
        boundaries: [0, 20, 30, 40, 50, 100],
        default: 'unknown',
        output: { count: { $sum: 1 } }
      }}
    ])

    // 报名渠道分布（通过推荐人）
    const channelStats = await Enrollment.aggregate([
      { $group: {
        _id: { hasReferrer: { $ne: ['$referrer', null] } },
        count: { $sum: 1 }
      }},
      { $project: {
        channel: { $cond: ['$_id.hasReferrer', '推荐', '直接报名'] },
        count: 1,
        _id: 0
      }}
    ])

    res.json(success({
      periodStats,
      genderStats,
      regionStats,
      ageStats,
      channelStats
    }))
  } catch (error) {
    console.error('获取报名统计失败:', error)
    res.status(500).json(errors.internalServerError('获取报名统计失败'))
  }
}

/**
 * 获取支付统计数据
 * 返回：各支付方式统计、支付趋势、订单状态分布等
 */
exports.getPaymentStats = async (req, res) => {
  try {
    // 支付方式统计
    const paymentMethodStats = await Payment.aggregate([
      { $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }},
      { $project: {
        method: '$_id',
        count: 1,
        totalAmount: 1,
        _id: 0
      }}
    ])

    // 订单状态统计
    const statusStats = await Payment.aggregate([
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }},
      { $project: {
        status: '$_id',
        count: 1,
        totalAmount: 1,
        _id: 0
      }}
    ])

    // 支付趋势（最近30天）
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const paymentTrend = await Payment.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } }},
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }},
      { $sort: { _id: 1 }}
    ])

    // 待对账订单数
    const unreconciled = await Payment.countDocuments({
      status: 'completed',
      reconciled: false
    })

    // 总支付金额和笔数
    const totalStats = await Payment.aggregate([
      { $match: { status: 'completed' }},
      { $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalCount: { $sum: 1 }
      }}
    ])

    res.json(success({
      paymentMethodStats,
      statusStats,
      paymentTrend,
      unreconciledCount: unreconciled,
      totalPaymentAmount: totalStats[0]?.totalAmount || 0,
      totalPaymentCount: totalStats[0]?.totalCount || 0
    }))
  } catch (error) {
    console.error('获取支付统计失败:', error)
    res.status(500).json(errors.internalServerError('获取支付统计失败'))
  }
}

/**
 * 获取打卡统计数据
 * 返回：期次打卡数、用户打卡排行、打卡趋势等
 */
exports.getCheckinStats = async (req, res) => {
  try {
    const { periodId } = req.query

    // 构建查询条件
    let matchStage = {}
    if (periodId) {
      matchStage = { periodId: require('mongoose').Types.ObjectId(periodId) }
    }

    // 期次打卡数统计
    const periodCheckinStats = await Checkin.aggregate([
      { $match: matchStage },
      { $group: {
        _id: '$periodId',
        count: { $sum: 1 }
      }},
      { $lookup: { from: 'periods', localField: '_id', foreignField: '_id', as: 'period' }},
      { $unwind: '$period' },
      { $project: {
        periodName: '$period.name',
        checkinCount: '$count'
      }}
    ])

    // 用户打卡排行（前20）
    const userCheckinRanking = await Checkin.aggregate([
      { $match: matchStage },
      { $group: {
        _id: '$userId',
        checkinCount: { $sum: 1 }
      }},
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' }},
      { $unwind: '$user' },
      { $sort: { checkinCount: -1 }},
      { $limit: 20 },
      { $project: {
        rank: 1,
        userName: '$user.nickname',
        userAvatar: '$user.avatar',
        checkinCount: 1,
        _id: 0
      }}
    ])

    // 打卡趋势（最近30天）
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const checkinTrend = await Checkin.aggregate([
      { $match: {
        ...matchStage,
        createdAt: { $gte: thirtyDaysAgo }
      }},
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$checkinDate' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 }}
    ])

    res.json(success({
      periodCheckinStats,
      userCheckinRanking,
      checkinTrend
    }))
  } catch (error) {
    console.error('获取打卡统计失败:', error)
    res.status(500).json(errors.internalServerError('获取打卡统计失败'))
  }
}
