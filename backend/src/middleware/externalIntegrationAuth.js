const crypto = require('crypto');
const ExternalIntegrationKey = require('../models/ExternalIntegrationKey');
const { withSystemContext, getCurrentTenantId } = require('../utils/tenantContext');
const { decryptIntegrationSecret } = require('../services/external-integration-credentials.service');
const securityAlertService = require('../services/security-alert.service');
const redisManager = require('../utils/redis');

const MAX_CLOCK_SKEW_SECONDS = 300;
const NONCE_TTL_SECONDS = 600;
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]{3,80}$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function signatureMessage(req, timestamp, nonce) {
  return [
    req.method.toUpperCase(),
    req.originalUrl,
    timestamp,
    nonce,
    JSON.stringify(req.body === undefined ? null : req.body)
  ].join('\n');
}

function signaturesEqual(actual, expected) {
  if (!/^[a-f0-9]{64}$/i.test(actual || '') || !/^[a-f0-9]{64}$/i.test(expected || '')) return false;
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function externalIntegrationAuth(requiredScope) {
  return async (req, res, next) => {
    const tenantId = getCurrentTenantId();
    const keyId = String(req.get('x-integration-key-id') || '');
    const timestamp = String(req.get('x-integration-timestamp') || '');
    const nonce = String(req.get('x-integration-nonce') || '');
    const signature = String(req.get('x-integration-signature') || '');
    const numericTimestamp = Number(timestamp);

    if (!tenantId || !KEY_ID_PATTERN.test(keyId) || !NONCE_PATTERN.test(nonce) || !Number.isInteger(numericTimestamp)) {
      return res.status(401).json({ code: 401, message: '外部集成认证无效' });
    }
    if (Math.abs(Math.floor(Date.now() / 1000) - numericTimestamp) > MAX_CLOCK_SKEW_SECONDS) {
      return res.status(401).json({ code: 401, message: '外部集成请求已过期' });
    }

    try {
      const integrationKey = await withSystemContext(null, () =>
        ExternalIntegrationKey.findOne({
          tenantId,
          keyId,
          status: { $in: ['active', 'revoked'] }
        }).select('+encryptedSecret').lean().exec()
      );
      if (!integrationKey) {
        securityAlertService.recordQuietly(
          'unknown_external_key',
          `${tenantId}:${keyId}`,
          { endpoint: req.originalUrl, detail: 'unknown integration key' }
        );
        return res.status(401).json({ code: 401, message: '外部集成认证无效' });
      }
      const activeKey = integrationKey.status === 'active' &&
        integrationKey.scopes?.includes(requiredScope) &&
        (!integrationKey.expiresAt || new Date(integrationKey.expiresAt) > new Date());
      if (!activeKey) {
        securityAlertService.recordQuietly(
          'revoked_external_key',
          `${tenantId}:${keyId}`,
          { endpoint: req.originalUrl, detail: integrationKey.status === 'revoked' ? 'revoked key' : 'inactive key' }
        );
        return res.status(401).json({ code: 401, message: '外部集成认证无效' });
      }

      const secret = decryptIntegrationSecret(integrationKey.encryptedSecret);
      const expected = crypto.createHmac('sha256', secret)
        .update(signatureMessage(req, timestamp, nonce))
        .digest('hex');
      if (!signaturesEqual(signature, expected)) {
        return res.status(401).json({ code: 401, message: '外部集成签名无效' });
      }

      const replayKey = `external-integration:nonce:${  tenantId  }:${  keyId  }:${  nonce}`;
      const consumed = await redisManager.setNxEx(replayKey, NONCE_TTL_SECONDS, '1');
      if (!consumed) return res.status(401).json({ code: 401, message: '外部集成请求已使用' });

      req.externalIntegration = { keyId, tenantId: String(tenantId), scope: requiredScope };
      return next();
    } catch (error) {
      if (error.name === 'MongoServerSelectionError' || error.name === 'MongoNetworkError') {
        return res.status(503).json({ code: 503, message: '暂时无法验证外部集成' });
      }
      if (error.message.includes('ENCRYPTION_KEY') || error.message.includes('32 bytes')) {
        return res.status(503).json({ code: 503, message: '外部集成凭据服务尚未配置' });
      }
      if (error.message.toLowerCase().includes('redis') || error.message.includes('setNxEx')) {
        return res.status(503).json({ code: 503, message: '暂时无法校验外部集成请求' });
      }
      return next(error);
    }
  };
}

module.exports = { externalIntegrationAuth, signatureMessage, signaturesEqual, MAX_CLOCK_SKEW_SECONDS, NONCE_TTL_SECONDS };
