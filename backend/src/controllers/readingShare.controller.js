const mongoose = require('mongoose');
const ReadingShare = require('../models/ReadingShare');
const Section = require('../models/Section');
const Period = require('../models/Period');
const User = require('../models/User');
const { getPeriodAccessState } = require('../services/period-access.service');
const { getCurrentTenantId } = require('../utils/tenantContext');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { generateShareCode, SHARE_CODE_PATTERN } = require('../utils/share-code');
const { requestWxacode, normalizeEnvVersion } = require('../services/wxacode.service');

const MAX_QUOTE_LENGTH = 60;
const MAX_PARAGRAPH_INDEX = 5000;
const QR_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const QR_CACHE_MAX = 500;
const qrCache = new Map();

function currentUserId(req) {
  return req.user?.userId || req.user?._id || req.user?.id || null;
}

function toObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function clampQuote(value) {
  return Array.from(String(value || '').replace(/\s+/g, ' ').trim()).slice(0, MAX_QUOTE_LENGTH).join('');
}

async function findOrCreateShare({ userId, section, paragraphIndex, quote }) {
  const filter = { userId, sectionId: section._id, paragraphIndex };
  const share = await ReadingShare.findOne(filter);
  if (share) {
    if (quote && share.quote !== quote) {
      share.quote = quote;
      await share.save();
    }
    return share;
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await ReadingShare.create({
        tenantId: getCurrentTenantId(),
        code: generateShareCode(),
        userId,
        sectionId: section._id,
        periodId: section.periodId?._id || section.periodId || null,
        paragraphIndex,
        quote
      });
    } catch (error) {
      if (!error || error.code !== 11000) throw error;
      // 同一段刚被并发生成过：直接用已有的；否则是短码撞了，换一个再试
      const existing = await ReadingShare.findOne(filter);
      if (existing) return existing;
    }
  }
  throw new Error('生成分享码失败');
}

/**
 * 生成分享此刻的小程序码（登录用户）：扫码后直接定位到这一课的这一段。
 * POST /reading-shares  { sectionId, paragraphIndex, quote, envVersion }
 */
async function createReadingShare(req, res, next) {
  try {
    const userId = currentUserId(req);
    const sectionId = toObjectId(req.body?.sectionId);
    if (!sectionId) return res.status(400).json(errors.badRequest('课程参数不正确'));
    const paragraphIndex = Number(req.body?.paragraphIndex);
    if (!Number.isInteger(paragraphIndex) || paragraphIndex < 0 || paragraphIndex > MAX_PARAGRAPH_INDEX) {
      return res.status(400).json(errors.badRequest('段落参数不正确'));
    }

    const section = await Section.findById(sectionId)
      .populate('periodId', '_id name title isPublished readingAccess visibilityType visibleUserIds')
      .lean();
    if (!section) return res.status(404).json(errors.notFound('课程不存在'));

    // 只有自己能读的课程才能生成分享码
    const access = await getPeriodAccessState(section.periodId, userId);
    if (!access.canRead) return res.status(403).json(errors.forbidden('先报名后才能分享这一课'));

    const share = await findOrCreateShare({ userId, section, paragraphIndex, quote: clampQuote(req.body?.quote) });

    const envVersion = normalizeEnvVersion(req.body?.envVersion);
    const cacheKey = `${getCurrentTenantId() || ''}:${envVersion}:${share.code}`;
    const cached = qrCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(success({ code: share.code, imageBase64: cached.imageBase64, contentType: 'image/png' }));
    }

    let imageBase64;
    try {
      imageBase64 = await requestWxacode({ scene: `k=${share.code}`, page: 'pages/reading-mode/reading-mode', envVersion });
    } catch (error) {
      // 生成失败时前端退回通用码，海报照常可用
      logger.error('生成阅读分享小程序码失败:', error);
      return res.status(503).json(errors.serviceUnavailable('小程序码暂时生成不了'));
    }
    if (qrCache.size >= QR_CACHE_MAX) qrCache.delete(qrCache.keys().next().value);
    qrCache.set(cacheKey, { imageBase64, expiresAt: Date.now() + QR_CACHE_TTL_MS });
    return res.json(success({ code: share.code, imageBase64, contentType: 'image/png' }));
  } catch (error) {
    return next(error);
  }
}

/**
 * 用短码换回分享的内容（访客也能调用）：课程、段落位置、分享人。
 * GET /reading-shares/:code
 */
async function resolveReadingShare(req, res, next) {
  try {
    const code = String(req.params.code || '').toLowerCase();
    if (!SHARE_CODE_PATTERN.test(code)) return res.status(404).json(errors.notFound('这个分享已经失效了'));
    const share = await ReadingShare.findOne({ code }).lean();
    if (!share) return res.status(404).json(errors.notFound('这个分享已经失效了'));

    const [section, period, inviter] = await Promise.all([
      Section.findById(share.sectionId).select('title day').lean(),
      share.periodId ? Period.findById(share.periodId).select('name title').lean() : null,
      User.findById(share.userId).select('nickname avatarUrl avatar status').lean()
    ]);
    if (!section) return res.status(404).json(errors.notFound('这个分享已经失效了'));

    return res.json(
      success({
        sectionId: String(share.sectionId),
        periodId: share.periodId ? String(share.periodId) : '',
        paragraphIndex: share.paragraphIndex,
        quote: share.quote || '',
        sectionTitle: section.title || '',
        day: section.day ?? null,
        periodName: (period && (period.name || period.title)) || '',
        inviter:
          inviter && inviter.status === 'active'
            ? { _id: inviter._id, nickname: inviter.nickname || '书友', avatarUrl: inviter.avatarUrl || '', avatar: inviter.avatar || '' }
            : null
      })
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = { createReadingShare, resolveReadingShare, generateCode: generateShareCode, clampQuote };
