const subscribeMessageService = require('../services/subscribe-message.service');

const MAX_SUBSCRIBE_SCENES_PER_REQUEST = 5;
const SETTINGS_CACHE_TTL_MS = 15000;

let settingsCache = null;
let settingsCacheAt = 0;
let inFlightPromise = null;

function resetAutoTopUpState() {
  settingsCache = null;
  settingsCacheAt = 0;
  inFlightPromise = null;
}

const AUTO_TOP_UP_POLICIES = {
  enrollment_result: {
    scene: 'enrollment_result',
    title: '报名结果',
    description: '报名成功后提醒用户进入晨读营',
    templateId: 'Qzn9auOyMjCKUaHrfekzK0XMaQ64nO0mfdikQNXjbdo',
    target: 1,
    requiresPeriodId: false,
    scheduledSendText: ''
  },
  payment_result: {
    scene: 'payment_result',
    title: '付款结果',
    description: '支付完成后提醒用户进入晨读营',
    templateId: 'UCzIuWtUYbc_ucf05GEOqglXK1HJHzwtN50e1NkmhCI',
    target: 1,
    requiresPeriodId: false,
    scheduledSendText: ''
  },
  comment_received: {
    scene: 'comment_received',
    title: '收到评论',
    description: '有人评论或回复时提醒查看',
    templateId: 'oMN_lu5vxoBlqcqiTxNDDq_kx9M4ENLUlfruD2rPZbs',
    target: 50,
    requiresPeriodId: false,
    scheduledSendText: ''
  },
  like_received: {
    scene: 'like_received',
    title: '收到点赞',
    description: '有人点赞打卡或评论时提醒查看',
    templateId: '7bzStHl6spoC8Vh_DHDXvAebxF5htrNLlfiAoDjp9Ek',
    target: 50,
    requiresPeriodId: false,
    scheduledSendText: ''
  },
  insight_request_created: {
    scene: 'insight_request_created',
    title: '申请小凡看见',
    description: '有人请求查看你的小凡看见时提醒处理',
    templateId: '6M4Cb5qrZa5xF3uuJLvw4UPvRuMzAef_N0biZgx7j6A',
    target: 1,
    requiresPeriodId: false,
    scheduledSendText: ''
  },
  next_day_study_reminder: {
    scene: 'next_day_study_reminder',
    title: '明日学习提醒',
    description: '次日早上 5:45 提醒用户打开首页去学习',
    templateId: 'aVKlwM2zva8WuT04AdaiblJIXiNL9YvgHncb2uJbU_A',
    target: 1,
    requiresPeriodId: true,
    scheduledSendText: '每天 05:45 自动发送'
  }
};

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

function normalizeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getScenePolicy(sceneKey) {
  return AUTO_TOP_UP_POLICIES[sceneKey] || null;
}

function getSceneAutoTopUpTarget(scene = {}) {
  const policy = getScenePolicy(scene.scene);
  const explicitTarget = normalizeCount(scene.autoTopUpTarget);

  if (explicitTarget > 0) {
    return explicitTarget;
  }

  return policy ? policy.target : 0;
}

function mergeSceneMetadata(scene = {}) {
  const policy = getScenePolicy(scene.scene);
  const autoTopUpTarget = getSceneAutoTopUpTarget(scene);
  const scheduledSendDate = scene.scheduledSendDate || null;
  const scheduledSendText =
    scene.scheduledSendText ||
    (policy ? policy.scheduledSendText : '');

  return {
    ...scene,
    autoTopUpTarget,
    scheduledSendDate,
    scheduledSendText,
    localOnly: !!scene.localOnly,
    requiresPeriodId: scene.requiresPeriodId ?? !!(policy && policy.requiresPeriodId)
  };
}

function mergeAutoTopUpScenes(serverScenes = []) {
  const sceneMap = new Map((serverScenes || []).map(scene => [scene.scene, mergeSceneMetadata(scene)]));
  const mergedScenes = Array.from(sceneMap.values());

  Object.values(AUTO_TOP_UP_POLICIES).forEach(policy => {
    if (!sceneMap.has(policy.scene)) {
      mergedScenes.push(
        mergeSceneMetadata({
          ...policy,
          availableCount: 0,
          lastResult: null,
          lastAcceptedAt: null,
          lastRejectedAt: null,
          lastRequestedAt: null,
          localOnly: true
        })
      );
    }
  });

  return mergedScenes;
}

function buildEligibleScenes(scenes = [], options = {}) {
  const { sceneKeys = null, periodId = null } = options;
  const allowedSceneKeys = Array.isArray(sceneKeys) && sceneKeys.length > 0 ? new Set(sceneKeys) : null;

  return scenes.filter(scene => {
    if (!scene || scene.localOnly) {
      return false;
    }

    if (allowedSceneKeys && !allowedSceneKeys.has(scene.scene)) {
      return false;
    }

    const policy = getScenePolicy(scene.scene);
    if (!policy) {
      return false;
    }

    if (policy.requiresPeriodId && !periodId) {
      return false;
    }

    const target = getSceneAutoTopUpTarget(scene);
    if (target <= 0) {
      return false;
    }

    return normalizeCount(scene.availableCount) < target;
  });
}

function buildPromptableScenes(options = {}) {
  const { sceneKeys = null, periodId = null } = options;
  const targetSceneKeys =
    Array.isArray(sceneKeys) && sceneKeys.length > 0
      ? sceneKeys
      : Object.keys(AUTO_TOP_UP_POLICIES);

  return targetSceneKeys
    .map(sceneKey => getScenePolicy(sceneKey))
    .filter(Boolean)
    .filter(scene => !scene.requiresPeriodId || !!periodId)
    .map(scene =>
      mergeSceneMetadata({
        ...scene,
        periodId: periodId || null
      })
    );
}

function getSubscriptionSettingMap(settingResponse = {}) {
  const subscriptionsSetting = settingResponse.subscriptionsSetting || {};
  return subscriptionsSetting.itemSettings || {};
}

function requestSubscribeMessage(tmplIds = []) {
  if (!tmplIds.length || typeof wx === 'undefined' || typeof wx.requestSubscribeMessage !== 'function') {
    return Promise.resolve({});
  }

  return new Promise((resolve, reject) => {
    wx.requestSubscribeMessage({
      tmplIds,
      success: resolve,
      fail: reject
    });
  });
}

async function getSettings(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && settingsCache && now - settingsCacheAt < SETTINGS_CACHE_TTL_MS) {
    return settingsCache;
  }

  const response = await subscribeMessageService.getSettings();
  settingsCache = response;
  settingsCacheAt = now;
  return response;
}

function updateSettingsCache(response) {
  settingsCache = response || null;
  settingsCacheAt = Date.now();
}

function getWxSettingWithSubscriptions() {
  if (typeof wx === 'undefined' || typeof wx.getSetting !== 'function') {
    return Promise.resolve({});
  }

  return new Promise((resolve, reject) => {
    wx.getSetting({
      withSubscriptions: true,
      success: resolve,
      fail: reject
    });
  });
}

async function maybeAutoTopUpSubscriptions(options = {}) {
  if (inFlightPromise) {
    return inFlightPromise;
  }

  const app = getAppInstance();
  if (app && app.globalData && app.globalData.isLogin === false) {
    return {
      skipped: true,
      reason: 'not_logged_in'
    };
  }

  inFlightPromise = (async () => {
    const {
      sceneKeys = null,
      periodId = null,
      requestMode = 'remembered'
    } = options;
    let requestScenes = [];
    if (requestMode === 'remembered') {
      const response = await getSettings();
      const serverScenes = Array.isArray(response?.scenes) ? response.scenes : [];
      const eligibleScenes = buildEligibleScenes(serverScenes, { sceneKeys, periodId });
      if (!eligibleScenes.length) {
        return {
          skipped: true,
          reason: 'no_eligible_scene'
        };
      }

      const settingResponse = await getWxSettingWithSubscriptions();
      const itemSettings = getSubscriptionSettingMap(settingResponse);
      requestScenes = eligibleScenes.filter(scene => itemSettings[scene.templateId] === 'accept');
      if (!requestScenes.length) {
        return {
          skipped: true,
          reason: 'no_remembered_accept'
        };
      }
    } else {
      const promptableScenes = buildPromptableScenes({ sceneKeys, periodId });
      if (!promptableScenes.length) {
        return {
          skipped: true,
          reason: 'no_eligible_scene'
        };
      }

      const settingResponse = await getWxSettingWithSubscriptions();
      const itemSettings = getSubscriptionSettingMap(settingResponse);
      requestScenes = promptableScenes.filter(
        scene => itemSettings[scene.templateId] !== 'reject' && itemSettings[scene.templateId] !== 'ban'
      );
      if (!requestScenes.length) {
        return {
          skipped: true,
          reason: 'no_requestable_scene'
        };
      }
    }

    const requestBatch = requestScenes.slice(0, MAX_SUBSCRIBE_SCENES_PER_REQUEST);
    const requestResult = await requestSubscribeMessage(requestBatch.map(scene => scene.templateId));
    const grants = requestBatch.map(scene => ({
      scene: scene.scene,
      templateId: scene.templateId,
      result: requestResult[scene.templateId] || 'error',
      context: {
        periodId: periodId || scene.periodId || null,
        sourceAction: options.sourceAction || '',
        sourcePage: options.sourcePage || '',
        sectionId: options.sectionId || options.courseId || null,
        courseId: options.courseId || null
      }
    }));

    const saveResult = await subscribeMessageService.saveGrants(grants);
    updateSettingsCache(saveResult);

    return {
      skipped: false,
      requestedScenes: requestBatch.map(scene => scene.scene),
      grants,
      saveResult
    };
  })()
    .catch(error => {
      console.warn('自动补量失败:', error);
      return {
        skipped: true,
        reason: 'error',
        error: error.message || String(error)
      };
    })
    .finally(() => {
      inFlightPromise = null;
    });

  return inFlightPromise;
}

module.exports = {
  AUTO_TOP_UP_POLICIES,
  MAX_SUBSCRIBE_SCENES_PER_REQUEST,
  buildEligibleScenes,
  getSettings,
  getSceneAutoTopUpTarget,
  getScenePolicy,
  getSubscriptionSettingMap,
  mergeAutoTopUpScenes,
  maybeAutoTopUpSubscriptions,
  resetAutoTopUpState,
  updateSettingsCache
};
