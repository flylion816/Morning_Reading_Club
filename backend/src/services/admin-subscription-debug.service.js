const mongoose = require('mongoose');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const Period = require('../models/Period');
const SubscribeMessageGrant = require('../models/SubscribeMessageGrant');
const SubscribeMessageDelivery = require('../models/SubscribeMessageDelivery');
const { getSubscribeSceneList } = require('../config/subscribe-message.config');
const { buildNextDayStudyReminderPlan } = require('../utils/study-reminder.utils');

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toBoolean(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function toObjectIdString(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'object' && value._id) {
    return String(value._id);
  }
  return String(value);
}

async function resolveQueryResult(queryOrValue) {
  if (!queryOrValue) {
    return queryOrValue;
  }

  if (typeof queryOrValue.lean === 'function') {
    const leanResult = queryOrValue.lean();
    if (leanResult && typeof leanResult.exec === 'function') {
      return leanResult.exec();
    }
    return leanResult;
  }

  if (typeof queryOrValue.exec === 'function') {
    return queryOrValue.exec();
  }

  if (typeof queryOrValue.then === 'function') {
    return queryOrValue;
  }

  return queryOrValue;
}

async function fetchMany(model, filter, options = {}) {
  const query = model.find(filter);
  if (options.select && typeof query.select === 'function') {
    query.select(options.select);
  }
  if (options.sort && typeof query.sort === 'function') {
    query.sort(options.sort);
  }
  if (options.skip != null && typeof query.skip === 'function') {
    query.skip(options.skip);
  }
  if (options.limit != null && typeof query.limit === 'function') {
    query.limit(options.limit);
  }
  return resolveQueryResult(query);
}

async function fetchOne(model, filter, options = {}) {
  const query = model.findOne(filter);
  if (options.select && typeof query.select === 'function') {
    query.select(options.select);
  }
  if (options.sort && typeof query.sort === 'function') {
    query.sort(options.sort);
  }
  return resolveQueryResult(query);
}

function buildUserSearchFilter(search) {
  const trimmed = String(search || '').trim();
  if (!trimmed) {
    return null;
  }

  const regex = new RegExp(escapeRegExp(trimmed), 'i');
  const orConditions = [
    { nickname: regex },
    { phone: regex },
    { openid: regex },
    { signature: regex }
  ];

  if (mongoose.Types.ObjectId.isValid(trimmed)) {
    orConditions.push({ _id: trimmed });
  }

  return { $or: orConditions };
}

function normalizeStatusFilter(status) {
  const value = String(status || '').trim();
  if (!value || value === 'all') {
    return '';
  }

  const map = {
    normal: 'ready',
    ready: 'ready',
    shortage: 'needs_topup',
    needs_topup: 'needs_topup',
    planned: 'scheduled',
    scheduled: 'scheduled',
    anomaly: 'anomaly',
    blocked: 'blocked',
    rejected: 'blocked',
    banned: 'blocked'
  };

  return map[value] || value;
}

function getSceneAutoTopUpTarget(sceneConfig) {
  const target = Number(sceneConfig?.autoTopUpTarget);
  return Number.isInteger(target) && target > 0 ? target : 1;
}

function getEnrollmentPeriodId(enrollment) {
  return toObjectIdString(enrollment?.periodId);
}

function getGrantPeriodId(grant) {
  return toObjectIdString(grant?.periodId) || toObjectIdString(grant?.context?.periodId);
}

function getSceneState(sceneConfig, grant, currentPeriodId = null, options = {}) {
  const target = getSceneAutoTopUpTarget(sceneConfig);
  const availableCount = Number(grant?.availableCount || 0);
  const lastResult = grant?.lastResult || null;
  const scheduledSendDate = grant?.scheduledSendDate || null;
  const retryAt = grant?.retryAt || null;
  const retryCount = Number(grant?.retryCount || 0);
  const effectivePeriodId = getGrantPeriodId(grant) || currentPeriodId || null;
  const disableTargetCheck = !!options.disableTargetCheck;

  const isBlocked = lastResult === 'reject' || lastResult === 'ban';
  const isScheduled =
    sceneConfig.scene === 'next_day_study_reminder' ? !!scheduledSendDate || !!retryAt : false;
  const isShortage = !disableTargetCheck && availableCount < target;

  let status = 'ready';
  if (isBlocked) {
    status = 'blocked';
  } else if (isScheduled) {
    status = 'scheduled';
  } else if (isShortage) {
    status = 'needs_topup';
  }

  const anomalyReasons = [];
  if (isBlocked) {
    anomalyReasons.push({
      code: 'scene_blocked',
      scene: sceneConfig.scene,
      label: `${sceneConfig.title} 最近授权被拒绝`,
      severity: 'high'
    });
  }
  if (isShortage) {
    anomalyReasons.push({
      code: 'scene_shortage',
      scene: sceneConfig.scene,
      label: `${sceneConfig.title} 库存不足（${availableCount}/${target}）`,
      severity: 'medium'
    });
  }

  return {
    scene: sceneConfig.scene,
    title: sceneConfig.title,
    description: sceneConfig.description,
    templateId: sceneConfig.templateId,
    page: sceneConfig.page,
    availableCount,
    autoTopUpTarget: target,
    remainingToTarget: disableTargetCheck ? 0 : Math.max(0, target - availableCount),
    lastResult,
    lastAcceptedAt: grant?.lastAcceptedAt || null,
    lastRejectedAt: grant?.lastRejectedAt || null,
    lastRequestedAt: grant?.lastRequestedAt || null,
    periodId: effectivePeriodId,
    sourceAction: grant?.sourceAction || grant?.context?.sourceAction || null,
    scheduledSendDate,
    scheduledSendDateKey: grant?.scheduledSendDateKey || null,
    retryAt,
    retryCount,
    context: grant?.context || {},
    status,
    statusLabel: options.statusLabelOverride
      || (status === 'blocked'
        ? lastResult === 'ban'
          ? '已封禁'
          : '已拒绝'
        : status === 'scheduled'
          ? '计划发送'
          : status === 'needs_topup'
            ? '库存不足'
            : '正常'),
    anomalyReasons
  };
}

function buildRowStatus(user, sceneStates) {
  if (!user || user.status !== 'active') {
    return 'blocked';
  }

  if (sceneStates.some(scene => scene.status === 'blocked')) {
    return 'blocked';
  }

  if (sceneStates.some(scene => scene.status === 'scheduled')) {
    return 'scheduled';
  }

  if (sceneStates.some(scene => scene.status === 'needs_topup')) {
    return 'needs_topup';
  }

  return 'ready';
}

function buildRowAnomalies(user, sceneStates) {
  const anomalies = [];

  if (!user) {
    anomalies.push({
      code: 'user_missing',
      label: '用户不存在',
      severity: 'high'
    });
    return anomalies;
  }

  if (user.status !== 'active') {
    anomalies.push({
      code: 'user_inactive',
      label: `用户状态为 ${user.status}`,
      severity: 'high'
    });
  }

  sceneStates.forEach(sceneState => {
    anomalies.push(...sceneState.anomalyReasons);
  });

  return anomalies;
}

function buildCurrentPeriod(enrollments = [], periodsMap = new Map(), periodIdFilter = null, fallbackPeriodId = null) {
  const chosenEnrollment = pickCurrentEnrollment(enrollments, periodIdFilter);
  const currentPeriodId =
    getEnrollmentPeriodId(chosenEnrollment) || periodIdFilter || fallbackPeriodId || null;

  if (!currentPeriodId) {
    return null;
  }

  const period = periodsMap.get(currentPeriodId);
  if (!period) {
    return {
      _id: currentPeriodId,
      title: null,
      name: null,
      subtitle: null,
      startDate: null,
      endDate: null,
      dateRange: null,
      status: null,
      isPublished: null
    };
  }

  return {
    _id: period._id,
    title: period.title || null,
    name: period.name || null,
    subtitle: period.subtitle || null,
    startDate: period.startDate || null,
    endDate: period.endDate || null,
    dateRange: period.dateRange || null,
    status: period.status || null,
    isPublished: typeof period.isPublished === 'boolean' ? period.isPublished : null
  };
}

function pickCurrentEnrollment(enrollments = [], periodId = null) {
  if (!enrollments.length) {
    return null;
  }

  const sorted = [...enrollments].sort((left, right) => {
    const leftStatusWeight = left.status === 'active' ? 0 : 1;
    const rightStatusWeight = right.status === 'active' ? 0 : 1;
    if (leftStatusWeight !== rightStatusWeight) {
      return leftStatusWeight - rightStatusWeight;
    }

    const leftPaymentWeight = left.paymentStatus === 'paid' || left.paymentStatus === 'free' ? 0 : 1;
    const rightPaymentWeight = right.paymentStatus === 'paid' || right.paymentStatus === 'free' ? 0 : 1;
    if (leftPaymentWeight !== rightPaymentWeight) {
      return leftPaymentWeight - rightPaymentWeight;
    }

    const leftDate = new Date(left.enrolledAt || left.createdAt || 0).getTime();
    const rightDate = new Date(right.enrolledAt || right.createdAt || 0).getTime();
    return rightDate - leftDate;
  });

  if (periodId) {
    return sorted.find(item => String(item.periodId) === String(periodId)) || sorted[0];
  }

  return sorted[0];
}

function buildSceneDefinitions() {
  return getSubscribeSceneList().map(sceneConfig => ({
    scene: sceneConfig.scene,
    title: sceneConfig.title,
    description: sceneConfig.description,
    templateId: sceneConfig.templateId,
    page: sceneConfig.page,
    autoTopUpTarget: getSceneAutoTopUpTarget(sceneConfig)
  }));
}

function getCurrentPeriodId(grants = [], enrollments = [], periodIdFilter = null) {
  if (periodIdFilter) {
    return periodIdFilter;
  }

  const chosenEnrollment = pickCurrentEnrollment(enrollments);
  if (chosenEnrollment) {
    return getEnrollmentPeriodId(chosenEnrollment);
  }

  const grantPeriod = grants.map(grant => getGrantPeriodId(grant)).find(Boolean);
  return grantPeriod || null;
}

function buildUserRow(user, grants = [], enrollments = [], periodsMap = new Map(), deliveries = [], periodIdFilter = null) {
  const currentPeriodId = getCurrentPeriodId(grants, enrollments, periodIdFilter);
  const currentPeriod = buildCurrentPeriod(enrollments, periodsMap, periodIdFilter, currentPeriodId);
  const sceneConfigs = getSubscribeSceneList();
  const grantMap = new Map(grants.map(grant => [grant.scene, grant]));
  const currentEnrollment = pickCurrentEnrollment(enrollments, periodIdFilter);
  const reminderPlan = buildNextDayStudyReminderPlan({
    period: currentPeriod,
    now: new Date()
  });
  const isReminderEligible =
    !!currentEnrollment
    && (currentEnrollment.paymentStatus === 'paid' || currentEnrollment.paymentStatus === 'free')
    && reminderPlan.status === 'ok';
  const sceneStates = sceneConfigs.map(sceneConfig => {
    const grant = grantMap.get(sceneConfig.scene);
    const disableTargetCheck =
      sceneConfig.scene === 'next_day_study_reminder' && !isReminderEligible && !grant;
    return getSceneState(sceneConfig, grant, currentPeriodId, {
      disableTargetCheck,
      statusLabelOverride: disableTargetCheck ? '未启用' : null
    });
  });
  const status = buildRowStatus(user, sceneStates);
  const anomalies = buildRowAnomalies(user, sceneStates);
  const lastActivityAt = [
    user?.updatedAt,
    user?.lastLoginAt,
    ...grants.map(grant => grant.updatedAt || grant.lastRequestedAt || grant.lastAcceptedAt || grant.lastRejectedAt),
    ...enrollments.map(enrollment => enrollment.updatedAt || enrollment.enrolledAt),
    ...deliveries.map(delivery => delivery.createdAt)
  ]
    .filter(Boolean)
    .map(date => new Date(date).getTime())
    .reduce((max, current) => Math.max(max, current), 0);

  return {
    user: user
      ? {
          _id: user._id,
          nickname: user.nickname || '微信用户',
          phone: user.phone || null,
          openid: user.openid || null,
          avatar: user.avatar || null,
          avatarUrl: user.avatarUrl || null,
          status: user.status || 'active',
          signature: user.signature || null,
          lastLoginAt: user.lastLoginAt || null,
          createdAt: user.createdAt || null,
          updatedAt: user.updatedAt || null
        }
      : null,
    userId: user ? String(user._id) : null,
    nickname: user?.nickname || '微信用户',
    phone: user?.phone || null,
    openid: user?.openid || null,
    currentPeriod,
    periodId: currentPeriod?._id ? String(currentPeriod._id) : null,
    periodName: currentPeriod?.title || currentPeriod?.name || null,
    scenes: sceneStates,
    sceneStates,
    status,
    statusLabel:
      status === 'blocked'
        ? '已阻断'
        : status === 'scheduled'
          ? '计划发送'
          : status === 'needs_topup'
            ? '库存不足'
            : '正常',
    summaryStatus:
      status === 'blocked'
        ? '异常'
        : status === 'needs_topup'
          ? '待补量'
          : status === 'scheduled'
            ? '计划发送'
            : '正常',
    anomalyReasons: anomalies,
    anomalyCount: anomalies.length,
    hasAnomaly: anomalies.length > 0,
    totalAvailableCount: sceneStates.reduce((sum, sceneState) => sum + (sceneState.availableCount || 0), 0),
    shortageSceneCount: sceneStates.filter(sceneState => sceneState.status === 'needs_topup').length,
    targetReadySceneCount: sceneStates.filter(
      sceneState => sceneState.availableCount >= sceneState.autoTopUpTarget
    ).length,
    lastRequestedAt: sceneStates
      .map(sceneState => sceneState.lastRequestedAt)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null,
    lastAcceptedAt: sceneStates
      .map(sceneState => sceneState.lastAcceptedAt)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null,
    lastRejectedAt: sceneStates
      .map(sceneState => sceneState.lastRejectedAt)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null,
    lastActivityAt: lastActivityAt ? new Date(lastActivityAt).toISOString() : null,
    deliveries: deliveries.slice(0, 5).map(delivery => ({
      _id: delivery._id,
      scene: delivery.scene,
      templateId: delivery.templateId,
      status: delivery.status,
      targetPage: delivery.targetPage || null,
      errorCode: delivery.errorCode || null,
      errorMessage: delivery.errorMessage || null,
      sourceType: delivery.sourceType || null,
      sourceId: delivery.sourceId || null,
      createdAt: delivery.createdAt || null
    })),
    recentDeliveries: deliveries.slice(0, 5).map(delivery => ({
      _id: delivery._id,
      scene: delivery.scene,
      templateId: delivery.templateId,
      status: delivery.status,
      targetPage: delivery.targetPage || null,
      errorCode: delivery.errorCode || null,
      errorMessage: delivery.errorMessage || null,
      sourceType: delivery.sourceType || null,
      sourceId: delivery.sourceId || null,
      createdAt: delivery.createdAt || null
    }))
  };
}

async function buildSubscriptionDebugDataset(params = {}, { deliveryLimit = 20 } = {}) {
  const search = String(params.search || '').trim();
  const scene = params.scene ? String(params.scene) : '';
  const periodId = params.periodId ? String(params.periodId) : '';
  const status = normalizeStatusFilter(params.status);
  const onlyAnomalies = toBoolean(params.onlyAnomalies);

  const userIds = new Set();
  const searchUserIds = new Set();

  if (search) {
    const searchFilter = buildUserSearchFilter(search);
    const matchedUsers = (await fetchMany(User, searchFilter, {
      select: '_id nickname phone openid status avatar avatarUrl signature',
      sort: { createdAt: -1 }
    })) || [];

    matchedUsers.forEach(user => {
      const userId = toObjectIdString(user._id);
      if (userId) {
        searchUserIds.add(userId);
        userIds.add(userId);
      }
    });
  }

  const grantQuery = {};
  if (scene) {
    grantQuery.scene = scene;
  }
  if (periodId) {
    grantQuery.$or = [{ periodId }, { 'context.periodId': periodId }];
  }
  if (searchUserIds.size > 0) {
    grantQuery.userId = { $in: Array.from(searchUserIds) };
  }

  const grants = (await fetchMany(SubscribeMessageGrant, grantQuery, {
    sort: { updatedAt: -1, createdAt: -1 }
  })) || [];

  grants.forEach(grant => {
    const userId = toObjectIdString(grant.userId);
    if (userId) {
      userIds.add(userId);
    }
  });

  const enrollmentQuery = {
    deleted: { $ne: true },
    status: { $in: ['active', 'completed'] }
  };
  if (userIds.size > 0) {
    enrollmentQuery.userId = { $in: Array.from(userIds) };
  }
  if (periodId) {
    enrollmentQuery.periodId = periodId;
  }

  const shouldLoadEnrollments = userIds.size > 0 || periodId || searchUserIds.size > 0;
  const enrollments = shouldLoadEnrollments
    ? (await fetchMany(Enrollment, enrollmentQuery, {
        sort: { enrolledAt: -1, createdAt: -1 }
      })) || []
    : [];

  enrollments.forEach(enrollment => {
    const userId = toObjectIdString(enrollment.userId);
    if (userId) {
      userIds.add(userId);
    }
  });

  const baseUserIds = Array.from(userIds);
  if (baseUserIds.length === 0) {
    return {
      list: [],
      summary: {
        totalUsers: 0,
        readyCount: 0,
        needsTopUpCount: 0,
        scheduledCount: 0,
        blockedCount: 0,
        anomalyCount: 0,
        totalAvailableCount: 0,
        shortageSceneCount: 0,
        targetReadySceneCount: 0
      },
      pagination: {
        page: 1,
        limit: Math.max(1, Math.min(100, parseInt(params.limit, 10) || 20)),
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      },
      sceneDefinitions: buildSceneDefinitions()
    };
  }

  const users = (await fetchMany(
    User,
    { _id: { $in: baseUserIds } },
    {
      select: '_id nickname phone openid status avatar avatarUrl signature createdAt updatedAt lastLoginAt',
      sort: { createdAt: -1 }
    }
  )) || [];
  const enrollmentsAll = (await fetchMany(
    Enrollment,
    {
      userId: { $in: baseUserIds },
      deleted: { $ne: true },
      status: { $in: ['active', 'completed'] }
    },
    { sort: { enrolledAt: -1, createdAt: -1 } }
  )) || [];
  const deliveries = (await fetchMany(
    SubscribeMessageDelivery,
    { userId: { $in: baseUserIds } },
    { sort: { createdAt: -1 }, limit: deliveryLimit }
  )) || [];

  const periodIds = new Set();
  enrollmentsAll.forEach(enrollment => {
    const period = getEnrollmentPeriodId(enrollment);
    if (period) {
      periodIds.add(period);
    }
  });
  grants.forEach(grant => {
    const period = getGrantPeriodId(grant);
    if (period) {
      periodIds.add(period);
    }
  });

  const periods = periodIds.size > 0
    ? (await fetchMany(
        Period,
        { _id: { $in: Array.from(periodIds) } },
        { select: '_id name title subtitle startDate endDate isPublished status sortOrder', sort: { startDate: -1, createdAt: -1 } }
      )) || []
    : [];

  const userMap = new Map(users.map(user => [toObjectIdString(user._id), user]));
  const grantMap = new Map();
  grants.forEach(grant => {
    const userId = toObjectIdString(grant.userId);
    if (!userId) {
      return;
    }
    if (!grantMap.has(userId)) {
      grantMap.set(userId, []);
    }
    grantMap.get(userId).push(grant);
  });

  const enrollmentMap = new Map();
  enrollmentsAll.forEach(enrollment => {
    const userId = toObjectIdString(enrollment.userId);
    if (!userId) {
      return;
    }
    if (!enrollmentMap.has(userId)) {
      enrollmentMap.set(userId, []);
    }
    enrollmentMap.get(userId).push(enrollment);
  });

  const deliveryMap = new Map();
  deliveries.forEach(delivery => {
    const userId = toObjectIdString(delivery.userId);
    if (!userId) {
      return;
    }
    if (!deliveryMap.has(userId)) {
      deliveryMap.set(userId, []);
    }
    deliveryMap.get(userId).push(delivery);
  });

  const rows = baseUserIds
    .map(userId => {
      const user = userMap.get(userId) || null;
      const userGrants = grantMap.get(userId) || [];
      const userEnrollments = enrollmentMap.get(userId) || [];
      const userDeliveries = deliveryMap.get(userId) || [];
      const row = buildUserRow(
        user,
        userGrants,
        userEnrollments,
        new Map(periods.map(period => [toObjectIdString(period._id), period])),
        userDeliveries,
        periodId || null
      );
      return row;
    })
    .filter(row => {
      if (status && status !== 'anomaly' && row.status !== status) {
        return false;
      }
      if ((onlyAnomalies || status === 'anomaly') && row.anomalyCount <= 0) {
        return false;
      }
      return true;
    })
    .sort((left, right) => {
      const leftAt = left.lastActivityAt ? new Date(left.lastActivityAt).getTime() : 0;
      const rightAt = right.lastActivityAt ? new Date(right.lastActivityAt).getTime() : 0;
      return rightAt - leftAt;
    });

  const page = Math.max(1, parseInt(params.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(params.limit, 10) || 20));
  const total = rows.length;
  const pagedRows = rows.slice((page - 1) * limit, (page - 1) * limit + limit);

  const summary = rows.reduce(
    (acc, row) => {
      acc.totalUsers += 1;
      acc.totalAvailableCount += row.totalAvailableCount;
      acc.shortageSceneCount += row.shortageSceneCount;
      acc.targetReadySceneCount += row.targetReadySceneCount;
      if (row.status === 'ready') acc.readyCount += 1;
      if (row.status === 'needs_topup') acc.needsTopUpCount += 1;
      if (row.status === 'scheduled') acc.scheduledCount += 1;
      if (row.status === 'blocked') acc.blockedCount += 1;
      if (row.anomalyCount > 0) acc.anomalyCount += 1;
      return acc;
    },
    {
      totalUsers: 0,
      readyCount: 0,
      needsTopUpCount: 0,
      scheduledCount: 0,
      blockedCount: 0,
      anomalyCount: 0,
      readyUserCount: 0,
      shortageUserCount: 0,
      plannedReminderCount: 0,
      anomalyUserCount: 0,
      totalAvailableCount: 0,
      shortageSceneCount: 0,
      targetReadySceneCount: 0
    }
  );

  summary.readyUserCount = summary.readyCount;
  summary.shortageUserCount = summary.needsTopUpCount;
  summary.plannedReminderCount = summary.scheduledCount;
  summary.anomalyUserCount = summary.anomalyCount;

  return {
    list: pagedRows,
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    },
    sceneDefinitions: buildSceneDefinitions()
  };
}

async function getSubscriptionDebugUserDetail(userId, params = {}) {
  const trimmedUserId = String(userId || '').trim();
  if (!trimmedUserId) {
    return null;
  }

  const user = await fetchOne(
    User,
    { _id: trimmedUserId },
    { select: '_id nickname phone openid status avatar avatarUrl signature lastLoginAt createdAt updatedAt' }
  );

  if (!user) {
    return null;
  }

  const periodId = params.periodId ? String(params.periodId) : '';
  const grantsFilter = { userId: trimmedUserId };
  if (periodId) {
    grantsFilter.$or = [{ periodId }, { 'context.periodId': periodId }];
  }

  const [grants, enrollments, deliveries] = await Promise.all([
    fetchMany(SubscribeMessageGrant, grantsFilter, { sort: { updatedAt: -1, createdAt: -1 } }),
    fetchMany(
      Enrollment,
      {
        userId: trimmedUserId,
        deleted: { $ne: true },
        status: { $in: ['active', 'completed'] }
      },
      { sort: { enrolledAt: -1, createdAt: -1 } }
    ),
    fetchMany(
      SubscribeMessageDelivery,
      { userId: trimmedUserId },
      { sort: { createdAt: -1 }, limit: 20 }
    )
  ]);

  const periodIds = new Set([
    ...(enrollments || []).map(item => getEnrollmentPeriodId(item)).filter(Boolean),
    ...(grants || []).map(item => getGrantPeriodId(item)).filter(Boolean)
  ]);

  const periods = periodIds.size > 0
    ? (await fetchMany(
        Period,
        { _id: { $in: Array.from(periodIds) } },
        { select: '_id name title subtitle startDate endDate isPublished status sortOrder' }
      )) || []
    : [];

  const periodsMap = new Map(periods.map(period => [toObjectIdString(period._id), period]));
  const currentPeriodId = getCurrentPeriodId(grants || [], enrollments || [], periodId || null);
  const currentPeriod = buildCurrentPeriod(
    enrollments || [],
    periodsMap,
    periodId || null,
    currentPeriodId
  );
  const grantMap = new Map((grants || []).map(grant => [grant.scene, grant]));
  const sceneDefinitions = buildSceneDefinitions();
  const sceneStates = sceneDefinitions.map(sceneConfig =>
    getSceneState(sceneConfig, grantMap.get(sceneConfig.scene) || null, currentPeriodId)
  );
  const anomalies = buildRowAnomalies(user, sceneStates);
  const status = buildRowStatus(user, sceneStates);

  return {
    user: {
      _id: user._id,
      nickname: user.nickname || '微信用户',
      phone: user.phone || null,
      openid: user.openid || null,
      avatar: user.avatar || null,
      avatarUrl: user.avatarUrl || null,
      status: user.status || 'active',
      signature: user.signature || null,
      lastLoginAt: user.lastLoginAt || null,
      createdAt: user.createdAt || null,
      updatedAt: user.updatedAt || null
    },
    currentPeriod,
    period: currentPeriod,
    sceneDefinitions,
    scenes: sceneStates,
    sceneStates,
    status,
    statusLabel:
      status === 'blocked'
        ? '已阻断'
        : status === 'scheduled'
          ? '计划发送'
          : status === 'needs_topup'
            ? '库存不足'
            : '正常',
    anomalyReasons: anomalies,
    summary: {
      totalAvailableCount: sceneStates.reduce((sum, sceneState) => sum + (sceneState.availableCount || 0), 0),
      shortageSceneCount: sceneStates.filter(sceneState => sceneState.status === 'needs_topup').length,
      targetReadySceneCount: sceneStates.filter(
        sceneState => sceneState.availableCount >= sceneState.autoTopUpTarget
      ).length,
      blockedSceneCount: sceneStates.filter(sceneState => sceneState.status === 'blocked').length,
      scheduledSceneCount: sceneStates.filter(sceneState => sceneState.status === 'scheduled').length,
      anomalyCount: anomalies.length
    },
    enrollments: (enrollments || []).map(enrollment => ({
      _id: enrollment._id,
      periodId: getEnrollmentPeriodId(enrollment),
      period: periodsMap.get(getEnrollmentPeriodId(enrollment)) || null,
      status: enrollment.status || null,
      paymentStatus: enrollment.paymentStatus || null,
      paymentAmount: enrollment.paymentAmount || 0,
      enrolledAt: enrollment.enrolledAt || null,
      paidAt: enrollment.paidAt || null,
      completedAt: enrollment.completedAt || null,
      withdrawnAt: enrollment.withdrawnAt || null,
      createdAt: enrollment.createdAt || null,
      updatedAt: enrollment.updatedAt || null
    })),
    recentDeliveries: (deliveries || []).map(delivery => ({
      _id: delivery._id,
      scene: delivery.scene,
      templateId: delivery.templateId,
      status: delivery.status,
      targetPage: delivery.targetPage || null,
      errorCode: delivery.errorCode || null,
      errorMessage: delivery.errorMessage || null,
      sourceType: delivery.sourceType || null,
      sourceId: delivery.sourceId || null,
      createdAt: delivery.createdAt || null,
      responseData: delivery.responseData || null
    })),
    deliveries: (deliveries || []).map(delivery => ({
      _id: delivery._id,
      scene: delivery.scene,
      templateId: delivery.templateId,
      status: delivery.status,
      targetPage: delivery.targetPage || null,
      errorCode: delivery.errorCode || null,
      errorMessage: delivery.errorMessage || null,
      sourceType: delivery.sourceType || null,
      sourceId: delivery.sourceId || null,
      createdAt: delivery.createdAt || null,
      responseData: delivery.responseData || null
    }))
  };
}

module.exports = {
  buildSubscriptionDebugDataset,
  getSubscriptionDebugUserDetail
};
