const enrollmentService = require('../services/enrollment.service');

const OPTIMISTIC_ENROLLMENT_TTL_MS = 2 * 60 * 1000;

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

function hasPaidEnrollment(enrollmentList = []) {
  return enrollmentList.some(enrollment => {
    return isActiveEnrollment(enrollment) && isPaidStatus(enrollment.paymentStatus || null);
  });
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
  enrollmentId = '',
  syncPending = false,
  syncPendingExpiresAt = null
} = {}) {
  const canAccessCommunity = !!isEnrolled && isPaidStatus(paymentStatus);
  const communityAccessState = canAccessCommunity ? 'enabled' : 'locked';
  const normalizedSyncPending = !!syncPending && canAccessCommunity;

  return {
    periodId: extractId(periodId),
    isEnrolled: !!isEnrolled,
    paymentStatus,
    enrollmentId,
    paymentPending: !!isEnrolled && !canAccessCommunity,
    canAccessCommunity,
    communityAccessState,
    communityLocked: communityAccessState !== 'enabled',
    syncPending: normalizedSyncPending,
    syncPendingExpiresAt: normalizedSyncPending
      ? syncPendingExpiresAt || new Date(Date.now() + OPTIMISTIC_ENROLLMENT_TTL_MS).toISOString()
      : null
  };
}

function getAppInstance() {
  if (typeof getApp !== 'function') {
    return null;
  }

  try {
    return getApp();
  } catch (error) {
    return null;
  }
}

function getCurrentUserCacheKey() {
  const app = getAppInstance();
  const userInfo = app?.globalData?.userInfo || {};
  return extractId(userInfo._id || userInfo.id) || 'anonymous';
}

function getEnrollmentCacheStore() {
  const app = getAppInstance();
  if (!app) {
    return {};
  }

  if (!app.globalData._enrollmentCache) {
    app.globalData._enrollmentCache = {};
  }

  return app.globalData._enrollmentCache;
}

function getEnrollmentCacheBucket(userKey = null, createIfMissing = true) {
  const store = getEnrollmentCacheStore();
  const normalizedUserKey = userKey || getCurrentUserCacheKey();

  if (!store[normalizedUserKey] && createIfMissing) {
    store[normalizedUserKey] = {};
  }

  return store[normalizedUserKey] || null;
}

function getCachedEnrollmentAccess(periodId, userKey = null) {
  const normalizedPeriodId = extractId(periodId);
  if (!normalizedPeriodId) {
    return null;
  }

  const bucket = getEnrollmentCacheBucket(userKey, false);
  if (!bucket) {
    return null;
  }

  return bucket[normalizedPeriodId] || null;
}

function setCachedEnrollmentAccess(periodId, access, userKey = null) {
  const normalizedPeriodId = extractId(periodId);
  if (!normalizedPeriodId) {
    return;
  }

  const bucket = getEnrollmentCacheBucket(userKey, true);
  bucket[normalizedPeriodId] = access;
}

function clearEnrollmentCache(periodId = null, userKey = null) {
  const app = getAppInstance();
  if (!app) {
    return;
  }

  const store = getEnrollmentCacheStore();
  const normalizedUserKey = userKey || getCurrentUserCacheKey();

  if (!periodId) {
    if (normalizedUserKey && store[normalizedUserKey]) {
      delete store[normalizedUserKey];
    } else {
      app.globalData._enrollmentCache = {};
    }
    return;
  }

  const normalizedPeriodId = extractId(periodId);
  const bucket = store[normalizedUserKey];
  if (bucket && normalizedPeriodId) {
    delete bucket[normalizedPeriodId];
  }
}

function markEnrollmentCacheDirty(periodId = null, userKey = null) {
  const app = getAppInstance();
  if (!app) {
    return;
  }

  app.globalData._enrollmentChanged = true;
  clearEnrollmentCache(periodId, userKey);
}

function signalEnrollmentChanged() {
  const app = getAppInstance();
  if (!app) {
    return;
  }

  app.globalData._enrollmentChanged = true;
}

function isFreshOptimisticEnrollmentAccess(access, now = Date.now()) {
  if (!access || !access.syncPending || !access.canAccessCommunity) {
    return false;
  }

  const expiresAt = access.syncPendingExpiresAt ? Date.parse(access.syncPendingExpiresAt) : NaN;
  return Number.isFinite(expiresAt) && expiresAt > now;
}

async function getPeriodAccess(periodId, options = {}) {
  const normalizedPeriodId = extractId(periodId);
  if (!normalizedPeriodId) {
    return buildPeriodAccess();
  }

  // 刚付款写入的乐观缓存最可靠，任何来源都不能覆盖它
  const existing = getCachedEnrollmentAccess(normalizedPeriodId);
  if (isFreshOptimisticEnrollmentAccess(existing)) {
    return existing;
  }

  // 调用方已持有最新报名数据时，直接用并刷新缓存（优先级高于非 optimistic 旧缓存）
  const matchedEnrollment =
    options.enrollment || findEnrollmentForPeriod(options.enrollmentList || [], normalizedPeriodId);

  if (matchedEnrollment) {
    const access = buildPeriodAccess({
      periodId: normalizedPeriodId,
      isEnrolled: true,
      paymentStatus: matchedEnrollment.paymentStatus || null,
      enrollmentId:
        extractId(matchedEnrollment.enrollmentId) ||
        extractId(matchedEnrollment._id) ||
        extractId(matchedEnrollment.id)
    });
    setCachedEnrollmentAccess(normalizedPeriodId, access);
    return access;
  }

  // 调用方无数据时才查缓存（optimistic 分支已在上方提前返回，这里只处理普通缓存）
  const cached = existing || getCachedEnrollmentAccess(normalizedPeriodId);
  if (cached && !cached.syncPending) {
    return cached;
  }

  // syncPending 已过期：保留作降级兜底，再清除缓存重新请求
  const expiredAccess = (cached && cached.syncPending) ? cached : null;
  if (expiredAccess) {
    clearEnrollmentCache(normalizedPeriodId);
  }

  if (options.skipRequest) {
    if (expiredAccess) {
      const fallback = buildPeriodAccess({
        periodId: normalizedPeriodId,
        isEnrolled: expiredAccess.isEnrolled,
        paymentStatus: expiredAccess.paymentStatus,
        enrollmentId: expiredAccess.enrollmentId
      });
      setCachedEnrollmentAccess(normalizedPeriodId, fallback);
      return fallback;
    }
    return buildPeriodAccess({ periodId: normalizedPeriodId });
  }

  try {
    const result = await enrollmentService.checkEnrollment(normalizedPeriodId);
    const access = buildPeriodAccess({
      periodId: normalizedPeriodId,
      isEnrolled: result.isEnrolled,
      paymentStatus: result.paymentStatus || null,
      enrollmentId: extractId(result.enrollmentId)
    });
    setCachedEnrollmentAccess(normalizedPeriodId, access);
    return access;
  } catch (refreshError) {
    // 网络抖动：用过期的付费状态兜底，避免把已付款用户锁出去
    if (expiredAccess) {
      const fallback = buildPeriodAccess({
        periodId: normalizedPeriodId,
        isEnrolled: expiredAccess.isEnrolled,
        paymentStatus: expiredAccess.paymentStatus,
        enrollmentId: expiredAccess.enrollmentId
      });
      setCachedEnrollmentAccess(normalizedPeriodId, fallback);
      return fallback;
    }
    throw refreshError;
  }
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
  isActiveEnrollment,
  hasPaidEnrollment,
  findEnrollmentForPeriod,
  getPeriodAccess,
  clearEnrollmentCache,
  getCachedEnrollmentAccess,
  setCachedEnrollmentAccess,
  markEnrollmentCacheDirty,
  signalEnrollmentChanged,
  isFreshOptimisticEnrollmentAccess,
  redirectAfterCommunityDenied
};
