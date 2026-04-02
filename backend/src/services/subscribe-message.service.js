const axios = require('axios');
const Enrollment = require('../models/Enrollment');
const Section = require('../models/Section');
const User = require('../models/User');
const Period = require('../models/Period');
const SubscribeMessageGrant = require('../models/SubscribeMessageGrant');
const SubscribeMessageDelivery = require('../models/SubscribeMessageDelivery');
const logger = require('../utils/logger');
const {
  getSubscribeSceneConfig,
  getSubscribeSceneList,
  normalizeMiniProgramPage
} = require('../config/subscribe-message.config');
const {
  buildNextDayStudyReminderPlan,
  normalizeGrantContext
} = require('../utils/study-reminder.utils');

const NON_CONSUMING_FAILURE_CODES = new Set([43101]);
const WECHAT_REAUTH_REQUIRED_ERROR_CODES = new Set([43101]);

function getSceneAutoTopUpTarget(sceneConfig) {
  const target = Number(sceneConfig?.autoTopUpTarget);
  if (Number.isInteger(target) && target > 0) {
    return target;
  }
  return 1;
}

async function resolveLeanResult(queryOrValue) {
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

function parseFieldKeyMap(envKey) {
  const raw = process.env[envKey];
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    logger.warn('订阅消息字段映射解析失败', {
      envKey,
      message: error.message
    });
    return null;
  }
}

function stringifyTemplateValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

class SubscribeMessageService {
  constructor() {
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
  }

  resolveFieldKeyMap(sceneConfig) {
    const fieldKeyMap = parseFieldKeyMap(sceneConfig.fieldKeyMapEnv) || sceneConfig.defaultFieldKeyMap;
    if (!fieldKeyMap) {
      return null;
    }

    const missingKeys = sceneConfig.fieldDefinitions
      .map(field => field.name)
      .filter(fieldName => !fieldKeyMap[fieldName]);

    if (missingKeys.length > 0) {
      logger.warn('订阅消息字段映射不完整', {
        scene: sceneConfig.scene,
        missingKeys
      });
      return null;
    }

    return fieldKeyMap;
  }

  buildTemplateData(sceneConfig, fields = {}) {
    const fieldKeyMap = this.resolveFieldKeyMap(sceneConfig);
    if (!fieldKeyMap) {
      return null;
    }

    return sceneConfig.fieldDefinitions.reduce((result, field) => {
      result[fieldKeyMap[field.name]] = {
        value: stringifyTemplateValue(fields[field.name])
      };
      return result;
    }, {});
  }

  buildSummary(scenes) {
    const shortageScenes = scenes
      .filter(scene => (scene.availableCount || 0) < getSceneAutoTopUpTarget(scene))
      .map(scene => scene.scene);
    const reauthorizationScenes = scenes
      .filter(scene => scene.deliveryBlocked)
      .map(scene => scene.scene);

    return {
      totalScenes: scenes.length,
      availableSceneCount: scenes.filter(scene => scene.availableCount > 0).length,
      targetReadySceneCount: scenes.filter(
        scene => (scene.availableCount || 0) >= getSceneAutoTopUpTarget(scene)
      ).length,
      shortageSceneCount: shortageScenes.length,
      needsReauthorizationSceneCount: reauthorizationScenes.length,
      totalAvailableCount: scenes.reduce((sum, scene) => sum + (scene.availableCount || 0), 0),
      shortageScenes,
      reauthorizationScenes
    };
  }

  async getUserSubscriptionStates(userId) {
    const grants = (await resolveLeanResult(SubscribeMessageGrant.find({ userId }))) || [];
    const grantMap = new Map(grants.map(item => [item.scene, item]));

    const scenes = getSubscribeSceneList().map(sceneConfig => {
      const grant = grantMap.get(sceneConfig.scene);
      const autoTopUpTarget = getSceneAutoTopUpTarget(sceneConfig);
      const availableCount = grant?.availableCount || 0;
      return {
        scene: sceneConfig.scene,
        title: sceneConfig.title,
        description: sceneConfig.description,
        templateId: sceneConfig.templateId,
        page: normalizeMiniProgramPage(sceneConfig.page),
        availableCount,
        autoTopUpTarget,
        remainingToTarget: Math.max(0, autoTopUpTarget - availableCount),
        periodId: grant?.periodId || grant?.context?.periodId || null,
        sourceAction: grant?.sourceAction || grant?.context?.sourceAction || null,
        scheduledSendDate: grant?.scheduledSendDate || null,
        scheduledSendDateKey: grant?.scheduledSendDateKey || null,
        retryAt: grant?.retryAt || null,
        retryCount: grant?.retryCount || 0,
        context: grant?.context || {},
        lastResult: grant?.lastResult || null,
        lastAcceptedAt: grant?.lastAcceptedAt || null,
        lastRejectedAt: grant?.lastRejectedAt || null,
        lastRequestedAt: grant?.lastRequestedAt || null,
        deliveryBlocked: !!grant?.deliveryBlocked,
        deliveryBlockedReason: grant?.deliveryBlockedReason || null,
        lastWechatErrorCode: grant?.lastWechatErrorCode || null,
        lastWechatRefusedAt: grant?.lastWechatRefusedAt || null,
        needsReauthorization: !!grant?.deliveryBlocked
      };
    });

    return {
      scenes,
      summary: this.buildSummary(scenes)
    };
  }

  async recordUserGrantResults(userId, grants = []) {
    const now = new Date();

    for (const grant of grants) {
      const sceneConfig = getSubscribeSceneConfig(grant.scene);
      if (!sceneConfig || grant.templateId !== sceneConfig.templateId) {
        continue;
      }

      const existingGrant = await SubscribeMessageGrant.findOne({
        userId,
        scene: sceneConfig.scene,
        templateId: sceneConfig.templateId
      });
      const currentAvailableCount = existingGrant?.availableCount || 0;
      const autoTopUpTarget = getSceneAutoTopUpTarget(sceneConfig);
      const normalizedContext = normalizeGrantContext(grant.context);
      let normalizedPeriodId = normalizedContext.periodId || existingGrant?.periodId || null;
      const result = grant.result === 'accept' ? 'accept' : grant.result === 'reject' ? 'reject' : grant.result === 'ban' ? 'ban' : 'error';
      const update = {
        $set: {
          templateId: sceneConfig.templateId,
          lastResult: result,
          lastRequestedAt: now,
          autoTopUpTarget,
          context: normalizedContext,
          periodId: normalizedPeriodId,
          sourceAction: normalizedContext.sourceAction || existingGrant?.sourceAction || null
        }
      };

      if (result === 'accept') {
        update.$set.lastAcceptedAt = now;
        update.$set.deliveryBlocked = false;
        update.$set.deliveryBlockedReason = null;
        update.$set.lastWechatErrorCode = null;
        update.$set.lastWechatRefusedAt = null;

        if (sceneConfig.scene === 'next_day_study_reminder') {
          const eligibleEnrollment = normalizedPeriodId
            ? await resolveLeanResult(
                Enrollment.findOne({
                  userId,
                  periodId: normalizedPeriodId,
                  status: { $in: ['active', 'completed'] },
                  paymentStatus: { $in: ['paid', 'free'] },
                  deleted: { $ne: true }
                }).select('periodId')
              )
            : await resolveLeanResult(
                Enrollment.findOne({
                  userId,
                  status: { $in: ['active', 'completed'] },
                  paymentStatus: { $in: ['paid', 'free'] },
                  deleted: { $ne: true }
                })
                  .sort({ enrolledAt: -1, createdAt: -1 })
                  .select('periodId')
              );

          if (eligibleEnrollment?.periodId) {
            normalizedPeriodId = String(eligibleEnrollment.periodId);
            update.$set.periodId = normalizedPeriodId;
            update.$set.context = {
              ...normalizedContext,
              periodId: normalizedPeriodId
            };
          }

          const period = normalizedPeriodId
            ? await resolveLeanResult(Period.findById(normalizedPeriodId))
            : null;
          const reminderPlan = buildNextDayStudyReminderPlan({ period, now });

          // next_day 场景需要真实期次信息；如果 context 中没有 periodId，或者超出期次边界，
          // 就只记录本次授权事件，不覆盖已有的未来提醒状态。
          if (reminderPlan.status === 'ok') {
            const section = await resolveLeanResult(
              Section.findOne({
                periodId: normalizedPeriodId,
                day: reminderPlan.dayIndex,
                isPublished: true
              }).select('_id')
            );

            if (section) {
              update.$set.availableCount = 1;
              update.$set.scheduledSendDate = reminderPlan.sendDate;
              update.$set.scheduledSendDateKey = reminderPlan.sendDateKey;
              update.$set.retryAt = null;
              update.$set.retryCount = 0;
            }
          }
        } else {
          const nextAvailableCount = Math.min(currentAvailableCount + 1, autoTopUpTarget);
          update.$set.availableCount = nextAvailableCount;
        }
      }

      if (result === 'reject' || result === 'ban') {
        update.$set.lastRejectedAt = now;
        update.$set.deliveryBlocked = true;
        update.$set.deliveryBlockedReason = result === 'ban' ? 'wechat_user_ban' : 'wechat_user_reject';
        update.$set.lastWechatErrorCode = null;
        update.$set.lastWechatRefusedAt = now;
        if (sceneConfig.scene === 'next_day_study_reminder') {
          update.$set.availableCount = 0;
          update.$set.scheduledSendDate = null;
          update.$set.scheduledSendDateKey = null;
          update.$set.retryAt = null;
          update.$set.retryCount = 0;
        }
      }

      await SubscribeMessageGrant.findOneAndUpdate(
        {
          userId,
          scene: sceneConfig.scene,
          templateId: sceneConfig.templateId
        },
        update,
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      );
    }

    return this.getUserSubscriptionStates(userId);
  }

  async createDeliveryLog({
    userId,
    scene,
    templateId,
    status,
    targetPage = null,
    payload = {},
    responseData = null,
    errorCode = null,
    errorMessage = null,
    sourceType = null,
    sourceId = null
  }) {
    return SubscribeMessageDelivery.create({
      userId,
      scene,
      templateId,
      status,
      targetPage,
      payload,
      responseData,
      errorCode,
      errorMessage,
      sourceType,
      sourceId: sourceId ? String(sourceId) : null
    });
  }

  async restoreGrantInventoryIfNeeded(grant, { consumeOnSuccess = false, errorCode = null } = {}) {
    if (consumeOnSuccess || !grant?._id) {
      return;
    }

    const normalizedErrorCode = Number(errorCode);
    if (!NON_CONSUMING_FAILURE_CODES.has(normalizedErrorCode)) {
      return;
    }

    await SubscribeMessageGrant.findByIdAndUpdate(grant._id, {
      $inc: { availableCount: 1 }
    });
  }

  async markGrantDeliveryBlockedIfNeeded(grant, { errorCode = null } = {}) {
    if (!grant?._id) {
      return;
    }

    const normalizedErrorCode = Number(errorCode);
    if (!WECHAT_REAUTH_REQUIRED_ERROR_CODES.has(normalizedErrorCode)) {
      return;
    }

    await SubscribeMessageGrant.findByIdAndUpdate(grant._id, {
      $set: {
        deliveryBlocked: true,
        deliveryBlockedReason: 'wechat_delivery_refused',
        lastWechatErrorCode: normalizedErrorCode,
        lastWechatRefusedAt: new Date()
      }
    });
  }

  async getAccessToken() {
    if (Date.now() < this.accessTokenExpiresAt && this.accessToken) {
      return this.accessToken;
    }

    const appid = process.env.WECHAT_APPID;
    const secret = process.env.WECHAT_SECRET;

    if (!appid || !secret) {
      throw new Error('未配置 WECHAT_APPID 或 WECHAT_SECRET');
    }

    const response = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
      params: {
        grant_type: 'client_credential',
        appid,
        secret
      },
      timeout: 5000
    });

    if (response.data.errcode) {
      throw new Error(response.data.errmsg || `微信 access_token 获取失败: ${response.data.errcode}`);
    }

    this.accessToken = response.data.access_token;
    this.accessTokenExpiresAt = Date.now() + Math.max((response.data.expires_in - 120) * 1000, 60000);

    return this.accessToken;
  }

  async sendSceneMessage({
    scene,
    recipientUserId,
    fields = {},
    page = '',
    sourceType = null,
    sourceId = null,
    consumeOnSuccess = false
  }) {
    const sceneConfig = getSubscribeSceneConfig(scene);
    if (!sceneConfig) {
      return null;
    }

    const targetPage = normalizeMiniProgramPage(page || sceneConfig.page);
    const fieldKeyMap = this.resolveFieldKeyMap(sceneConfig);

    if (!fieldKeyMap) {
      return this.createDeliveryLog({
        userId: recipientUserId,
        scene,
        templateId: sceneConfig.templateId,
        status: 'skipped_missing_config',
        targetPage,
        payload: { fields },
        errorMessage: `缺少 ${sceneConfig.fieldKeyMapEnv} 配置且代码默认映射不可用`,
        sourceType,
        sourceId
      });
    }

    const user = await User.findById(recipientUserId).select('openid nickname').lean();
    if (!user?.openid) {
      return this.createDeliveryLog({
        userId: recipientUserId,
        scene,
        templateId: sceneConfig.templateId,
        status: 'skipped_missing_openid',
        targetPage,
        payload: { fields },
        errorMessage: '用户缺少 openid',
        sourceType,
        sourceId
      });
    }

    const grantQuery = {
      userId: recipientUserId,
      scene,
      templateId: sceneConfig.templateId,
      availableCount: { $gt: 0 }
    };

    const blockedGrant = await SubscribeMessageGrant.findOne({
      ...grantQuery,
      deliveryBlocked: true
    });

    if (blockedGrant) {
      return this.createDeliveryLog({
        userId: recipientUserId,
        scene,
        templateId: sceneConfig.templateId,
        status: 'skipped_reauthorization_required',
        targetPage,
        payload: { fields },
        errorCode: blockedGrant.lastWechatErrorCode || null,
        errorMessage: '微信侧订阅授权已失效，等待用户重新授权',
        sourceType,
        sourceId
      });
    }

    const grant = consumeOnSuccess
      ? await SubscribeMessageGrant.findOne({
          ...grantQuery,
          deliveryBlocked: { $ne: true }
        })
      : await SubscribeMessageGrant.findOneAndUpdate(
          {
            ...grantQuery,
            deliveryBlocked: { $ne: true }
          },
          {
            $inc: { availableCount: -1 }
          },
          {
            new: true
          }
        );

    if (!grant) {
      return this.createDeliveryLog({
        userId: recipientUserId,
        scene,
        templateId: sceneConfig.templateId,
        status: 'skipped_no_grant',
        targetPage,
        payload: { fields },
        sourceType,
        sourceId
      });
    }

    const templateData = this.buildTemplateData(sceneConfig, fields);
    if (!templateData) {
      return this.createDeliveryLog({
        userId: recipientUserId,
        scene,
        templateId: sceneConfig.templateId,
        status: 'skipped_missing_config',
        targetPage,
        payload: { fields },
        errorMessage: `缺少 ${sceneConfig.fieldKeyMapEnv} 配置且代码默认映射不可用`,
        sourceType,
        sourceId
      });
    }

    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      if (consumeOnSuccess) {
        await SubscribeMessageGrant.findByIdAndUpdate(grant._id, {
          $inc: { availableCount: -1 }
        });
      }

      return this.createDeliveryLog({
        userId: recipientUserId,
        scene,
        templateId: sceneConfig.templateId,
        status: 'mocked',
        targetPage,
        payload: {
          touser: user.openid,
          template_id: sceneConfig.templateId,
          page: targetPage,
          data: templateData
        },
        sourceType,
        sourceId
      });
    }

    try {
      const accessToken = await this.getAccessToken();
      const payload = {
        touser: user.openid,
        template_id: sceneConfig.templateId,
        page: targetPage,
        data: templateData
      };

      const response = await axios.post(
        `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
        payload,
        {
          timeout: 5000
        }
      );

      if (response.data.errcode && response.data.errcode !== 0) {
        await this.restoreGrantInventoryIfNeeded(grant, {
          consumeOnSuccess,
          errorCode: response.data.errcode
        });
        await this.markGrantDeliveryBlockedIfNeeded(grant, {
          errorCode: response.data.errcode
        });

        return this.createDeliveryLog({
          userId: recipientUserId,
          scene,
          templateId: sceneConfig.templateId,
          status: 'failed',
          targetPage,
          payload,
          responseData: response.data,
          errorCode: response.data.errcode,
          errorMessage: response.data.errmsg || '订阅消息发送失败',
          sourceType,
          sourceId
        });
      }

      if (consumeOnSuccess) {
        await SubscribeMessageGrant.findByIdAndUpdate(grant._id, {
          $inc: { availableCount: -1 }
        });
      }

      return this.createDeliveryLog({
        userId: recipientUserId,
        scene,
        templateId: sceneConfig.templateId,
        status: 'sent',
        targetPage,
        payload,
        responseData: response.data,
        sourceType,
        sourceId
      });
    } catch (error) {
      logger.error('发送订阅消息失败', error, {
        scene,
        recipientUserId,
        sourceType,
        sourceId
      });

      return this.createDeliveryLog({
        userId: recipientUserId,
        scene,
        templateId: sceneConfig.templateId,
        status: 'failed',
        targetPage,
        payload: {
          fields,
          page: targetPage
        },
        errorMessage: error.message,
        sourceType,
        sourceId
      });
    }
  }
}

module.exports = new SubscribeMessageService();
