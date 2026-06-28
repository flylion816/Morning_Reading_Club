const mongoose = require('mongoose');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const Payment = require('../models/Payment');
const CommunityActivity = require('../models/CommunityActivity');
const ActivityRegistration = require('../models/ActivityRegistration');
const { success, errors } = require('../utils/response');
const { getCurrentTenantId } = require('../utils/tenantContext');
const logger = require('../utils/logger');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function parsePagination(query = {}) {
  const pageValue = Number.parseInt(query.page, 10);
  const pageSizeValue = Number.parseInt(query.pageSize || query.limit, 10);
  const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
  const pageSize = Number.isFinite(pageSizeValue) && pageSizeValue > 0
    ? Math.min(pageSizeValue, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize
  };
}

function buildPagination({ page, pageSize, total }) {
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasMore: page < totalPages
  };
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toObjectId(value) {
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function maskPhone(phone) {
  const text = String(phone || '').trim();
  if (!text) return '';
  if (/^1\d{10}$/.test(text)) return text.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
  if (text.length > 4) return `****${text.slice(-4)}`;
  return text;
}

function formatUser(user = {}) {
  const userId = user._id ? user._id.toString() : user.userId || '';
  return {
    userId,
    nickname: user.nickname || '微信用户',
    avatarUrl: user.avatarUrl || '',
    avatar: user.avatar || '',
    phone: user.phone || '',
    phoneMasked: maskPhone(user.phone),
    role: user.role || 'user',
    status: user.status || '',
    totalCheckinDays: user.totalCheckinDays || 0,
    currentStreak: user.currentStreak || 0,
    createdAt: user.createdAt || null,
    lastLoginAt: user.lastLoginAt || null
  };
}

function formatPayment(payment = null) {
  if (!payment) return null;
  return {
    paymentId: payment._id ? payment._id.toString() : '',
    orderNo: payment.orderNo || '',
    amount: payment.amount || 0,
    status: payment.status || '',
    paymentMethod: payment.paymentMethod || '',
    paidAt: payment.paidAt || payment.wechat?.successTime || null,
    createdAt: payment.createdAt || null
  };
}

function formatEnrollment(enrollment = {}, latestPayment = null) {
  const period = enrollment.periodId || {};
  return {
    enrollmentId: enrollment._id ? enrollment._id.toString() : '',
    periodId: period._id ? period._id.toString() : (enrollment.periodId || '').toString(),
    periodName: period.name || period.title || '未命名期次',
    status: enrollment.status || '',
    paymentStatus: enrollment.paymentStatus || '',
    paymentAmount: enrollment.paymentAmount || 0,
    paidAt: enrollment.paidAt || null,
    enrolledAt: enrollment.enrolledAt || enrollment.createdAt || null,
    name: enrollment.name || '',
    phone: enrollment.phone || '',
    latestPayment: formatPayment(latestPayment)
  };
}

function formatActivity(activity = {}, counts = {}) {
  return {
    activityId: activity._id ? activity._id.toString() : '',
    title: activity.title || '未命名活动',
    status: activity.status || '',
    type: activity.type || '',
    startTime: activity.startTime || null,
    endTime: activity.endTime || null,
    isPaid: !!activity.isPaid,
    price: activity.price || 0,
    registrationCount: counts.registrationCount || 0,
    paidCount: counts.paidCount || 0,
    pendingCount: counts.pendingCount || 0
  };
}

function formatRegistration(registration = {}) {
  const user = registration.userId || {};
  return {
    registrationId: registration._id ? registration._id.toString() : '',
    registeredAt: registration.registeredAt || registration.createdAt || null,
    status: registration.status || '',
    paymentStatus: registration.paymentStatus || '',
    paidAmount: registration.paidAmount || 0,
    reminderGranted: !!registration.reminderGranted,
    user: formatUser(user),
    payment: formatPayment(registration.paymentId)
  };
}

function handleError(res, error, message) {
  if (error.statusCode === 400) return res.status(400).json(errors.badRequest(error.message));
  if (error.statusCode === 403) return res.status(403).json(errors.forbidden(error.message));
  if (error.statusCode === 404) return res.status(404).json(errors.notFound(error.message));
  logger.error(message, error);
  return res.status(500).json(errors.serverError(message));
}

function buildLatestPaymentMap(payments = []) {
  const byEnrollmentId = new Map();
  payments.forEach((payment) => {
    const enrollmentId = payment.enrollmentId ? payment.enrollmentId.toString() : '';
    if (enrollmentId && !byEnrollmentId.has(enrollmentId)) {
      byEnrollmentId.set(enrollmentId, payment);
    }
  });
  return byEnrollmentId;
}

async function getUserSummaries(users = []) {
  const userIds = users.map((user) => user._id).filter(Boolean);
  if (userIds.length === 0) return new Map();

  const tenantId = getCurrentTenantId();
  const [enrollments, activityCounts] = await Promise.all([
    Enrollment.find({
      userId: { $in: userIds },
      deleted: { $ne: true }
    })
      .populate('periodId', 'name title')
      .sort({ enrolledAt: -1, createdAt: -1 })
      .lean(),
    ActivityRegistration.aggregate([
      { $match: { tenantId, userId: { $in: userIds } } },
      {
        $group: {
          _id: '$userId',
          registrationCount: { $sum: 1 }
        }
      }
    ])
  ]);

  const summaryMap = new Map();
  users.forEach((user) => {
    summaryMap.set(user._id.toString(), {
      enrollmentCount: 0,
      paidEnrollmentCount: 0,
      activityRegistrationCount: 0,
      latestEnrollment: null
    });
  });

  enrollments.forEach((enrollment) => {
    const userId = enrollment.userId ? enrollment.userId.toString() : '';
    const summary = summaryMap.get(userId);
    if (!summary) return;
    summary.enrollmentCount += 1;
    if (['paid', 'free'].includes(enrollment.paymentStatus)) {
      summary.paidEnrollmentCount += 1;
    }
    if (!summary.latestEnrollment) {
      summary.latestEnrollment = formatEnrollment(enrollment);
    }
  });

  activityCounts.forEach((row) => {
    const summary = summaryMap.get(row._id.toString());
    if (summary) summary.activityRegistrationCount = row.registrationCount || 0;
  });

  return summaryMap;
}

async function searchUsers(req, res) {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const keyword = String(req.query.q || req.query.keyword || req.query.search || '').trim();

    if (!keyword) {
      return res.json(success({
        list: [],
        pagination: buildPagination({ page, pageSize, total: 0 })
      }));
    }

    const regex = new RegExp(escapeRegex(keyword), 'i');
    const objectId = toObjectId(keyword);
    const enrollmentUserIds = await Enrollment.distinct('userId', {
      deleted: { $ne: true },
      $or: [
        { name: regex },
        { phone: regex }
      ]
    });

    const or = [
      { nickname: regex },
      { phone: regex },
      { openid: regex }
    ];
    if (objectId) or.push({ _id: objectId });
    if (enrollmentUserIds.length > 0) or.push({ _id: { $in: enrollmentUserIds } });

    const query = {
      status: { $ne: 'deleted' },
      $or: or
    };
    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select('_id nickname avatar avatarUrl phone role status totalCheckinDays currentStreak createdAt lastLoginAt')
        .sort({ lastLoginAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()
    ]);

    const summaries = await getUserSummaries(users);
    const list = users.map((user) => ({
      ...formatUser(user),
      summary: summaries.get(user._id.toString()) || {
        enrollmentCount: 0,
        paidEnrollmentCount: 0,
        activityRegistrationCount: 0,
        latestEnrollment: null
      }
    }));

    return res.json(success({
      list,
      pagination: buildPagination({ page, pageSize, total })
    }));
  } catch (error) {
    return handleError(res, error, '移动端管理员用户查询失败');
  }
}

async function getUserDetail(req, res) {
  try {
    const userObjectId = toObjectId(req.params.userId);
    if (!userObjectId) {
      const error = new Error('用户参数无效');
      error.statusCode = 400;
      throw error;
    }
    const tenantId = getCurrentTenantId();

    const user = await User.findOne({
      _id: userObjectId,
      status: { $ne: 'deleted' }
    })
      .select('_id nickname avatar avatarUrl phone role status totalCheckinDays currentStreak createdAt lastLoginAt')
      .lean();
    if (!user) {
      const error = new Error('用户不存在或无权限访问');
      error.statusCode = 404;
      throw error;
    }

    const enrollments = await Enrollment.find({
      userId: userObjectId,
      deleted: { $ne: true }
    })
      .populate('periodId', 'name title startDate endDate status')
      .sort({ enrolledAt: -1, createdAt: -1 })
      .limit(50)
      .lean();

    const enrollmentIds = enrollments.map((item) => item._id);
    const [payments, activityRegistrations] = await Promise.all([
      Payment.find({
        userId: userObjectId,
        enrollmentId: { $in: enrollmentIds }
      })
        .sort({ createdAt: -1 })
        .lean(),
      ActivityRegistration.find({ tenantId, userId: userObjectId })
        .populate('activityId', 'title type startTime endTime status isPaid price')
        .populate('paymentId', 'orderNo amount status paymentMethod paidAt wechat.successTime createdAt')
        .sort({ registeredAt: -1, createdAt: -1 })
        .limit(20)
        .lean()
    ]);
    const paymentMap = buildLatestPaymentMap(payments);

    return res.json(success({
      user: formatUser(user),
      enrollments: enrollments.map((item) => formatEnrollment(
        item,
        paymentMap.get(item._id.toString())
      )),
      activityRegistrations: activityRegistrations.map((item) => ({
        ...formatRegistration(item),
        activity: item.activityId ? formatActivity(item.activityId) : null
      }))
    }));
  } catch (error) {
    return handleError(res, error, '移动端管理员用户详情失败');
  }
}

async function listActivities(req, res) {
  try {
    const { page, pageSize, skip } = parsePagination(req.query);
    const tenantId = getCurrentTenantId();
    const keyword = String(req.query.q || req.query.keyword || '').trim();
    const status = String(req.query.status || '').trim();
    const query = { tenantId };
    if (status && status !== 'all') query.status = status;
    if (keyword) query.title = new RegExp(escapeRegex(keyword), 'i');

    const [total, activities] = await Promise.all([
      CommunityActivity.countDocuments(query),
      CommunityActivity.find(query)
        .select('_id title type status startTime endTime isPaid price')
        .sort({ startTime: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()
    ]);
    const activityIds = activities.map((activity) => activity._id);
    const countRows = activityIds.length === 0
      ? []
      : await ActivityRegistration.aggregate([
        { $match: { tenantId, activityId: { $in: activityIds }, status: 'registered' } },
        {
          $group: {
            _id: '$activityId',
            registrationCount: { $sum: 1 },
            paidCount: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] }
            },
            pendingCount: {
              $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] }
            }
          }
        }
      ]);
    const countMap = new Map(countRows.map((row) => [row._id.toString(), row]));

    return res.json(success({
      list: activities.map((activity) => formatActivity(
        activity,
        countMap.get(activity._id.toString())
      )),
      pagination: buildPagination({ page, pageSize, total })
    }));
  } catch (error) {
    return handleError(res, error, '移动端管理员活动列表失败');
  }
}

async function getActivityRegistrations(req, res) {
  try {
    const activityObjectId = toObjectId(req.params.activityId);
    if (!activityObjectId) {
      const error = new Error('活动参数无效');
      error.statusCode = 400;
      throw error;
    }
    const { page, pageSize, skip } = parsePagination(req.query);
    const tenantId = getCurrentTenantId();
    const keyword = String(req.query.q || req.query.keyword || '').trim();
    const status = String(req.query.status || 'registered').trim();
    const paymentStatus = String(req.query.paymentStatus || '').trim();

    const activity = await CommunityActivity.findOne({ _id: activityObjectId, tenantId })
      .select('_id title type status startTime endTime isPaid price')
      .lean();
    if (!activity) {
      const error = new Error('活动不存在或无权限访问');
      error.statusCode = 404;
      throw error;
    }

    const query = { tenantId, activityId: activityObjectId };
    if (status && status !== 'all') query.status = status;
    if (paymentStatus && paymentStatus !== 'all') query.paymentStatus = paymentStatus;
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), 'i');
      const matchedUsers = await User.find({
        status: { $ne: 'deleted' },
        $or: [
          { nickname: regex },
          { phone: regex }
        ]
      }).select('_id').lean();
      query.userId = { $in: matchedUsers.map((user) => user._id) };
    }

    const [total, registrations] = await Promise.all([
      ActivityRegistration.countDocuments(query),
      ActivityRegistration.find(query)
        .populate('userId', '_id nickname avatar avatarUrl phone role status totalCheckinDays currentStreak createdAt lastLoginAt')
        .populate('paymentId', 'orderNo amount status paymentMethod paidAt wechat.successTime createdAt')
        .sort({ registeredAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()
    ]);

    return res.json(success({
      activity: formatActivity(activity),
      list: registrations.map(formatRegistration),
      pagination: buildPagination({ page, pageSize, total })
    }));
  } catch (error) {
    return handleError(res, error, '移动端管理员活动报名名单失败');
  }
}

module.exports = {
  searchUsers,
  getUserDetail,
  listActivities,
  getActivityRegistrations,
  parsePagination,
  maskPhone
};
