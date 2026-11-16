/**
 * 随喜 / 觉察的分享：作者逐条开启、可随时停止；收到的人登录且有权限才能看只读视图。
 * 没有登录、没有权限、分享已停止、笔记已删除、作者已停用，一律当作「打不开」，小程序回到首页。
 */
const mongoose = require('mongoose');
const JoyNote = require('../models/JoyNote');
const JoyNoteShare = require('../models/JoyNoteShare');
const Period = require('../models/Period');
const Section = require('../models/Section');
const User = require('../models/User');
const { getCommunityAccessiblePeriodIds } = require('../services/community-access.service');
const { requestWxacode, normalizeEnvVersion } = require('../services/wxacode.service');
const { generateShareCode, SHARE_CODE_PATTERN } = require('../utils/share-code');
const { getCurrentTenantId } = require('../utils/tenantContext');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { formatAwareness } = require('./joyNote.controller');

const AUDIENCES = ['period', 'login'];
const QR_PAGE = 'pages/joy-notes/shared/shared';
const QR_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const QR_CACHE_MAX = 500;
const qrCache = new Map();

function requestUserId(req) {
  return req.user?.userId || req.user?.id || req.user?._id;
}

function isId(value) {
  return typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value) && mongoose.Types.ObjectId.isValid(value);
}

function sameId(a, b) {
  return String(a || '') === String(b || '');
}

async function findOwnNote(userId, noteId) {
  if (!isId(noteId)) return null;
  return JoyNote.findOne({ _id: noteId, userId }).select('_id periodId').lean();
}

// 返回 { share, created }：并发时别人刚开启过，就直接用已有的（created 为 false）
async function createWithFreshCode(data) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return { share: await JoyNoteShare.create({ ...data, code: generateShareCode() }), created: true };
    } catch (error) {
      if (!error || error.code !== 11000) throw error;
      // 这条笔记刚被并发开启过：直接用已有的；否则是短码撞了，换一个再试
      const existing = await JoyNoteShare.findOne({ noteId: data.noteId });
      if (existing) return { share: existing, created: false };
    }
  }
  throw new Error('生成分享码失败');
}

/**
 * 开启（或取回）分享：POST /joy-note-shares { noteId, audience }
 * 已经在分享中就沿用；停止过的会换一个新码。created 表示这次是新开启的（用户没用就关面板时要撤销）。
 */
async function createShare(req, res, next) {
  try {
    const userId = requestUserId(req);
    const note = await findOwnNote(userId, req.body?.noteId);
    if (!note) return res.status(404).json(errors.notFound('记录不存在'));

    const rawAudience = req.body?.audience;
    if (rawAudience !== undefined && !AUDIENCES.includes(rawAudience)) {
      return res.status(400).json(errors.badRequest('分享范围不正确'));
    }
    // 没有关联期次的记录，「本期书友」没有意义，一律是登录的书友
    const audience = note.periodId ? (rawAudience || 'period') : 'login';

    let share = await JoyNoteShare.findOne({ noteId: note._id });
    let created = false;
    if (!share) {
      ({ share, created } = await createWithFreshCode({ noteId: note._id, userId, audience }));
    } else if (share.revokedAt) {
      share.code = await uniqueCode();
      share.revokedAt = null;
      share.audience = audience;
      await share.save();
      created = true;
    } else if (rawAudience !== undefined && share.audience !== audience) {
      share.audience = audience;
      await share.save();
    }
    return res.json(success({
      code: share.code,
      audience: share.audience,
      active: true,
      created,
      periodLinked: Boolean(note.periodId)
    }));
  } catch (error) {
    return next(error);
  }
}

async function uniqueCode() {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = generateShareCode();
    // eslint-disable-next-line no-await-in-loop
    const exists = await JoyNoteShare.findOne({ code }).select('_id').lean();
    if (!exists) return code;
  }
  throw new Error('生成分享码失败');
}

// 这条记录现在有没有在分享：GET /joy-note-shares/note/:noteId
async function getShareStatus(req, res, next) {
  try {
    const userId = requestUserId(req);
    const note = await findOwnNote(userId, req.params.noteId);
    if (!note) return res.status(404).json(errors.notFound('记录不存在'));
    const share = await JoyNoteShare.findOne({ noteId: note._id, revokedAt: null }).lean();
    if (!share) return res.json(success({ active: false, periodLinked: Boolean(note.periodId) }));
    return res.json(success({
      active: true,
      code: share.code,
      audience: share.audience,
      periodLinked: Boolean(note.periodId)
    }));
  } catch (error) {
    return next(error);
  }
}

// 停止分享：DELETE /joy-note-shares/note/:noteId。此前的链接和二维码立即失效
async function revokeShare(req, res, next) {
  try {
    const userId = requestUserId(req);
    const note = await findOwnNote(userId, req.params.noteId);
    if (!note) return res.status(404).json(errors.notFound('记录不存在'));
    await JoyNoteShare.updateOne({ noteId: note._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    return res.json(success({ active: false }, '已停止分享'));
  } catch (error) {
    return next(error);
  }
}

// 长图上的小程序码：POST /joy-note-shares/:code/qrcode { envVersion }。只有作者能生成
async function createQrcode(req, res, next) {
  try {
    const userId = requestUserId(req);
    const code = String(req.params.code || '').toLowerCase();
    if (!SHARE_CODE_PATTERN.test(code)) return res.status(404).json(errors.notFound('这个分享已经停止了'));
    const share = await JoyNoteShare.findOne({ code, userId, revokedAt: null }).lean();
    if (!share) return res.status(404).json(errors.notFound('这个分享已经停止了'));

    const envVersion = normalizeEnvVersion(req.body?.envVersion);
    const cacheKey = `${getCurrentTenantId() || ''}:${envVersion}:${code}`;
    const cached = qrCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(success({ code, imageBase64: cached.imageBase64, contentType: 'image/png' }));
    }
    let imageBase64;
    try {
      imageBase64 = await requestWxacode({ scene: `s=${code}`, page: QR_PAGE, envVersion });
    } catch (error) {
      // 生成失败时前端退回通用小程序码，长图照常可用
      logger.error('生成随喜/觉察分享小程序码失败:', error);
      return res.status(503).json(errors.serviceUnavailable('小程序码暂时生成不了'));
    }
    if (qrCache.size >= QR_CACHE_MAX) qrCache.delete(qrCache.keys().next().value);
    qrCache.set(cacheKey, { imageBase64, expiresAt: Date.now() + QR_CACHE_TTL_MS });
    return res.json(success({ code, imageBase64, contentType: 'image/png' }));
  } catch (error) {
    return next(error);
  }
}

/**
 * 收到分享的人读这一页：GET /joy-note-shares/:code（必须登录）。
 * 不返回回访状态等只属于作者的信息；audience 为 login 的非本期书友看不到期次名和课程名。
 */
async function resolveShare(req, res, next) {
  try {
    const viewerId = requestUserId(req);
    const code = String(req.params.code || '').toLowerCase();
    const gone = () => res.status(404).json(errors.notFound('这个分享已经停止了'));
    if (!SHARE_CODE_PATTERN.test(code)) return gone();

    const share = await JoyNoteShare.findOne({ code, revokedAt: null }).lean();
    if (!share) return gone();
    const note = await JoyNote.findOne({ _id: share.noteId, userId: share.userId }).lean();
    if (!note) return gone();
    const author = await User.findById(share.userId).select('nickname avatar avatarUrl status').lean();
    if (!author || (author.status && author.status !== 'active')) return gone();

    const isOwner = sameId(viewerId, share.userId);
    let canSeeSource = isOwner;
    if (!isOwner && share.audience === 'period') {
      // 关联期次的记录只对本期书友开放；期次后来被取消关联时无法确认身份，也不放行
      const periodIds = note.periodId ? (await getCommunityAccessiblePeriodIds(viewerId)).map(String) : [];
      if (!note.periodId || !periodIds.includes(String(note.periodId))) {
        return res.status(403).json(errors.forbidden('这一页只对本期书友开放'));
      }
      canSeeSource = true;
    }

    let periodName = '';
    let sectionTitle = '';
    let day = null;
    if (canSeeSource && note.periodId) {
      const period = await Period.findById(note.periodId).select('name title').lean();
      periodName = period ? period.name || period.title || '' : '';
      if (note.sectionId) {
        const section = await Section.findOne({ _id: note.sectionId, periodId: note.periodId, isPublished: true })
          .select('title day')
          .lean();
        if (section) {
          sectionTitle = section.title || '';
          day = section.day === undefined ? null : section.day;
        }
      }
    }

    const isAwareness = note.kind === 'awareness';
    const awarenessView = isAwareness ? formatAwareness(note.awareness) : null;
    if (awarenessView && !isOwner) delete awarenessView.revisit;
    return res.json(success({
      code,
      isOwner,
      audience: share.audience,
      kind: isAwareness ? 'awareness' : 'joy',
      title: note.title || '',
      content: note.content,
      contentHtml: note.contentHtml || '',
      awareness: awarenessView,
      author: { nickname: author.nickname || '书友', avatarUrl: author.avatarUrl || '', avatar: author.avatar || '' },
      periodName,
      sectionTitle,
      day,
      createdAt: note.createdAt
    }));
  } catch (error) {
    return next(error);
  }
}

module.exports = { createShare, getShareStatus, revokeShare, createQrcode, resolveShare };
