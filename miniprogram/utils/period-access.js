const enrollmentService = require('../services/enrollment.service');

function extractId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value._id || value.id || '';
  return String(value);
}

function isPaidStatus(paymentStatus) {
  return paymentStatus === 'paid' || paymentStatus === 'free';
}

function isActiveEnrollment(enrollment) {
  if (!enrollment) return false;
  if (!enrollment.status) return true;
  return enrollment.status === 'active' || enrollment.status === 'completed';
}

function findEnrollmentForPeriod(enrollmentList = [], periodId) {
  const normalizedPeriodId = extractId(periodId);
  return enrollmentList.find(enrollment => {
    return (
      isActiveEnrollment(enrollment) &&
      extractId(enrollment.periodId) === normalizedPeriodId
    );
  });
}

function buildPeriodAccess({
  periodId,
  isEnrolled = false,
  paymentStatus = null,
  enrollmentId = ''
} = {}) {
  const canAccessCommunity = !!isEnrolled && isPaidStatus(paymentStatus);
  const communityAccessState = canAccessCommunity ? 'enabled' : 'locked';

  return {
    periodId: extractId(periodId),
    isEnrolled: !!isEnrolled,
    paymentStatus,
    enrollmentId,
    paymentPending: !!isEnrolled && !canAccessCommunity,
    canAccessCommunity,
    communityAccessState,
    communityLocked: communityAccessState !== 'enabled'
  };
}

async function getPeriodAccess(periodId, options = {}) {
  const normalizedPeriodId = extractId(periodId);
  if (!normalizedPeriodId) {
    return buildPeriodAccess();
  }

  const matchedEnrollment =
    options.enrollment || findEnrollmentForPeriod(options.enrollmentList || [], normalizedPeriodId);

  if (matchedEnrollment) {
    return buildPeriodAccess({
      periodId: normalizedPeriodId,
      isEnrolled: true,
      paymentStatus: matchedEnrollment.paymentStatus || null,
      enrollmentId:
        extractId(matchedEnrollment.enrollmentId) ||
        extractId(matchedEnrollment._id) ||
        extractId(matchedEnrollment.id)
    });
  }

  if (options.skipRequest) {
    return buildPeriodAccess({ periodId: normalizedPeriodId });
  }

  const result = await enrollmentService.checkEnrollment(normalizedPeriodId);
  return buildPeriodAccess({
    periodId: normalizedPeriodId,
    isEnrolled: result.isEnrolled,
    paymentStatus: result.paymentStatus || null,
    enrollmentId: extractId(result.enrollmentId)
  });
}

function redirectAfterCommunityDenied(targetUrl, title = '未支付暂不可互动') {
  wx.showToast({
    title,
    icon: 'none'
  });

  setTimeout(() => {
    if (targetUrl) {
      wx.redirectTo({
        url: targetUrl,
        fail: () => {
          wx.navigateBack({
            delta: 1,
            fail: () => {}
          });
        }
      });
      return;
    }

    wx.navigateBack({
      delta: 1,
      fail: () => {}
    });
  }, 1200);
}

module.exports = {
  extractId,
  isPaidStatus,
  findEnrollmentForPeriod,
  getPeriodAccess,
  redirectAfterCommunityDenied
};
