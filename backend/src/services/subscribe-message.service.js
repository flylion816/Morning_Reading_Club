const axios = require('axios');
const User = require('../models/User');
const SubscribeMessageGrant = require('../models/SubscribeMessageGrant');
const SubscribeMessageDelivery = require('../models/SubscribeMessageDelivery');
const logger = require('../utils/logger');
const {
  getSubscribeSceneConfig,
  getSubscribeSceneList,
  normalizeMiniProgramPage
} = require('../config/subscribe-message.config');

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
    const shortageScenes = scenes.filter(scene => scene.availableCount <= 0).map(scene => scene.scene);

    return {
      totalScenes: scenes.length,
      availableSceneCount: scenes.filter(scene => scene.availableCount > 0).length,
      shortageSceneCount: shortageScenes.length,
      totalAvailableCount: scenes.reduce((sum, scene) => sum + (scene.availableCount || 0), 0),
      shortageScenes
    };
  }

  async getUserSubscriptionStates(userId) {
    const grants = await SubscribeMessageGrant.find({ userId }).lean();
    const grantMap = new Map(grants.map(item => [item.scene, item]));

    const scenes = getSubscribeSceneList().map(sceneConfig => {
      const grant = grantMap.get(sceneConfig.scene);
      return {
        scene: sceneConfig.scene,
        title: sceneConfig.title,
        description: sceneConfig.description,
        templateId: sceneConfig.templateId,
        page: normalizeMiniProgramPage(sceneConfig.page),
        availableCount: grant?.availableCount || 0,
        lastResult: grant?.lastResult || null,
        lastAcceptedAt: grant?.lastAcceptedAt || null,
        lastRejectedAt: grant?.lastRejectedAt || null,
        lastRequestedAt: grant?.lastRequestedAt || null
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

      const result = grant.result === 'accept' ? 'accept' : grant.result === 'reject' ? 'reject' : grant.result === 'ban' ? 'ban' : 'error';
      const update = {
        $set: {
          templateId: sceneConfig.templateId,
          lastResult: result,
          lastRequestedAt: now
        }
      };

      if (result === 'accept') {
        update.$inc = { availableCount: 1 };
        update.$set.lastAcceptedAt = now;
      }

      if (result === 'reject' || result === 'ban') {
        update.$set.lastRejectedAt = now;
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
    sourceId = null
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

    const grant = await SubscribeMessageGrant.findOneAndUpdate(
      {
        userId: recipientUserId,
        scene,
        templateId: sceneConfig.templateId,
        availableCount: { $gt: 0 }
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
