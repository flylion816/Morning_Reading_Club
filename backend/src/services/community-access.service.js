const Enrollment = require('../models/Enrollment');
const { errors } = require('../utils/response');

const COMMUNITY_ACCESS_DENIED_MESSAGE = '当前期次未支付，暂不可打卡或互动';

async function findCommunityEnrollment(userId, periodId) {
  if (!userId || !periodId) {
    return null;
  }

  return Enrollment.findOne({
    userId,
    periodId,
    status: { $in: ['active', 'completed'] },
    deleted: { $ne: true }
  }).select('paymentStatus status');
}

async function getCommunityAccessiblePeriodIds(userId) {
  if (!userId) {
    return [];
  }

  const enrollments = await Enrollment.find({
    userId,
    status: { $in: ['active', 'completed'] },
    paymentStatus: 'paid',
    deleted: { $ne: true }
  })
    .select('periodId')
    .lean();

  return enrollments.map(enrollment => enrollment.periodId).filter(Boolean);
}

async function ensurePeriodCommunityAccess(res, userId, periodId) {
  const enrollment = await findCommunityEnrollment(userId, periodId);
  const hasCommunityAccess = !!enrollment && enrollment.paymentStatus === 'paid';

  if (hasCommunityAccess) {
    return true;
  }

  res.status(403).json(errors.forbidden(COMMUNITY_ACCESS_DENIED_MESSAGE));
  return false;
}

module.exports = {
  COMMUNITY_ACCESS_DENIED_MESSAGE,
  ensurePeriodCommunityAccess,
  findCommunityEnrollment,
  getCommunityAccessiblePeriodIds
};
