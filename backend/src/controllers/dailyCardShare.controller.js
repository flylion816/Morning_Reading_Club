const mongoose = require('mongoose');
const DailyCardShare = require('../models/DailyCardShare');
const { getCurrentTenantId } = require('../utils/tenantContext');
const { generateShareCode, SHARE_CODE_PATTERN } = require('../utils/share-code');
const { requestWxacode, normalizeEnvVersion } = require('../services/wxacode.service');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');

const TEXT_LIMITS = { quote: 120, note: 40, source: 40, periodName: 30 };
const VARIANTS = ['dawn', 'paper', 'blank'];

function readSnapshot(body = {}) {
  const snapshot = {};
  for (const [key, limit] of Object.entries(TEXT_LIMITS)) {
    const value = body[key] === undefined || body[key] === null ? '' : body[key];
    if (typeof value !== 'string' || Array.from(value.trim()).length > limit) return null;
    snapshot[key] = value.trim();
  }
  const day = body.day === undefined || body.day === null || body.day === '' ? 0 : Number(body.day);
  if (!Number.isInteger(day) || day < 0 || day > 9999) return null;
  const dateStr = body.dateStr || '';
  if (typeof dateStr !== 'string' || (dateStr && !/^\d{4}-\d{2}-\d{2}$/.test(dateStr))) return null;
  const variant = body.variant || 'dawn';
  if (!VARIANTS.includes(variant)) return null;
  return { ...snapshot, day, dateStr, variant };
}

// 访客也可以保存日签。分享者身份只取认证态，不能由请求正文指定。
async function createDailyCardShare(req, res, next) {
  try {
    const snapshot = readSnapshot(req.body);
    if (!snapshot) return res.status(400).json(errors.badRequest('日签内容或参数不正确'));
    const actorId = req.user?.userId || req.user?._id || req.user?.id || null;
    const userId = actorId && mongoose.isValidObjectId(actorId) ? actorId : null;
    const envVersion = normalizeEnvVersion(req.body?.envVersion);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const code = generateShareCode();
      let imageBase64;
      try {
        imageBase64 = await requestWxacode({ scene: `c=${code}`, page: 'pages/landing/landing', envVersion });
        if (typeof imageBase64 !== 'string' || !imageBase64) throw new Error('小程序码为空');
      } catch (error) {
        logger.warn('生成日签分享码失败', { name: error?.name || 'Error' });
        return res.status(503).json(errors.serviceUnavailable('日签分享码暂时生成不了，请稍后再试'));
      }
      try {
        await DailyCardShare.create({ tenantId: getCurrentTenantId(), code, userId, ...snapshot });
        return res.json(success({ code, imageBase64, contentType: 'image/png' }));
      } catch (error) {
        if (!error || error.code !== 11000) throw error;
      }
    }
    return res.status(503).json(errors.serviceUnavailable('日签分享码暂时生成不了，请稍后再试'));
  } catch (error) {
    return next(error);
  }
}

// 公开读取只返回这张主动分享的日签快照，租户插件限制查询范围。
async function resolveDailyCardShare(req, res, next) {
  try {
    const code = String(req.params.code || '').toLowerCase();
    if (!SHARE_CODE_PATTERN.test(code)) return res.status(404).json(errors.notFound('这张日签暂时翻不到了'));
    const share = await DailyCardShare.findOne({ code }).lean();
    if (!share) return res.status(404).json(errors.notFound('这张日签暂时翻不到了'));
    return res.json(success({
      inviterId: share.userId ? String(share.userId) : '',
      sourceType: 'daily_card',
      quote: share.quote || '',
      note: share.note || '',
      lessonName: share.source || '',
      periodName: share.periodName || '',
      dayNumber: share.day || 0,
      dateStr: share.dateStr || '',
      variant: VARIANTS.includes(share.variant) ? share.variant : 'dawn'
    }));
  } catch (error) {
    return next(error);
  }
}

module.exports = { createDailyCardShare, resolveDailyCardShare, readSnapshot };
