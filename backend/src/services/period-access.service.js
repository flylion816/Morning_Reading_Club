const Enrollment = require('../models/Enrollment');

function effectiveReadingAccess(period) {
  // Historical periods predate this setting and were publicly readable.
  return period?.readingAccess || 'open';
}

function isVisibleToUser(period, userId) {
  if (!period || period.visibilityType !== 'specific') return true;
  if (!userId) return false;
  return (period.visibleUserIds || []).some(id => String(id) === String(userId));
}

async function findEffectiveEnrollment(userId, periodId) {
  if (!userId || !periodId) return null;
  return Enrollment.findOne({
    userId,
    periodId,
    status: { $in: ['active', 'completed'] },
    paymentStatus: { $in: ['paid', 'free'] },
    deleted: { $ne: true }
  }).select('_id status paymentStatus paymentAmount').lean();
}

async function getPeriodAccessState(period, userId, { isAdmin = false } = {}) {
  const readingAccess = effectiveReadingAccess(period);
  const enrollment = readingAccess === 'enrolled'
    ? await findEffectiveEnrollment(userId, period?._id)
    : null;
  const visible = isAdmin || isVisibleToUser(period, userId) || Boolean(enrollment);
  const published = isAdmin || period?.readingAccess === undefined || period?.isPublished !== false;
  const canRead = Boolean(isAdmin || (published && visible && (readingAccess === 'open' || enrollment)));
  return {
    readingAccess,
    requiresEnrollment: readingAccess === 'enrolled',
    canRead,
    canInteract: Boolean(enrollment),
    enrollmentId: enrollment?._id || null,
    enrollmentStatus: enrollment?.status || null,
    paymentStatus: enrollment?.paymentStatus || null,
    reason: canRead ? null : (!published ? '课程尚未发布' : (!visible ? '当前用户不可见' : '请先完成报名'))
  };
}

async function ensurePeriodReadAccess(req, res, period) {
  const state = await getPeriodAccessState(period, req.user?.userId || req.user?.id || req.user?._id, { isAdmin: Boolean(req.admin) });
  if (state.canRead) return state;
  return res.status(req.user || req.admin ? 403 : 403).json({
    code: 403,
    message: state.reason === '请先完成报名' ? '请先报名后学习' : state.reason,
    data: { access: state }
  });
}

async function ensurePeriodInteractionAccess(req, res, periodId) {
  const userId = req.user?.userId || req.user?.id || req.user?._id;
  const enrollment = await findEffectiveEnrollment(userId, periodId);
  if (enrollment) return enrollment;
  res.status(403).json({ code: 403, message: '请先完成报名后参与互动' });
  return null;
}

module.exports = {
  effectiveReadingAccess,
  isVisibleToUser,
  findEffectiveEnrollment,
  getPeriodAccessState,
  ensurePeriodReadAccess,
  ensurePeriodInteractionAccess
};
