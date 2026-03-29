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
    status: { $in: ['active', 'completed'] }
  }).select('paymentStatus status');
}

async function ensurePeriodCommunityAccess(res, userId, periodId) {
  const enrollment = await findCommunityEnrollment(userId, periodId);
  const hasCommunityAccess =
    !!enrollment && (enrollment.paymentStatus === 'paid' || enrollment.paymentStatus === 'free');

  if (hasCommunityAccess) {
    return true;
  }

  res.status(403).json(errors.forbidden(COMMUNITY_ACCESS_DENIED_MESSAGE));
  return false;
}

module.exports = {
  COMMUNITY_ACCESS_DENIED_MESSAGE,
  ensurePeriodCommunityAccess,
  findCommunityEnrollment
};
