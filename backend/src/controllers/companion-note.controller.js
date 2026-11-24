const path = require('path');
const CompanionNote = require('../models/CompanionNote');
const CompanionNoteComment = require('../models/CompanionNoteComment');
const CompanionNoteLike = require('../models/CompanionNoteLike');
const CompanionNoteRead = require('../models/CompanionNoteRead');
const Period = require('../models/Period');
const Section = require('../models/Section');
const User = require('../models/User');
const { success, errors } = require('../utils/response');
const { getCurrentTenantId, withSystemContext } = require('../utils/tenantContext');
const { resolveTenantSlug } = require('../utils/tenantSlug');
const logger = require('../utils/logger');
const contentSecurity = require('../services/content-security.service');
const { dispatchNotificationWithSubscribe } = require('../services/user-notification.service');
const { getCommunityAccessiblePeriodIds } = require('../services/community-access.service');
const { getPeriodAccessState } = require('../services/period-access.service');
const {
  PUBLISHED_NOTE_FILTER,
  idString,
  isValidObjectId,
  hasPeriodCommunityAccess,
  loadAccessibleNote,
  buildAccessibleNoteFilter,
  getPublishedSections,
  sectionLabelsForNote,
  toPublicNote
} = require('../services/companion-note-access.service');
const {
  storeUpload,
  storePage,
  inspectUpload,
  removeUploadDirectory,
  resolvePdfPath,
  encodeTicket,
  decodeTicket,
  cleanupOrphanUploads,
  isSafeFileToken
} = require('../services/companion-note-files.service');
const {
  buildCompanionNoteTargetPage,
  formatNotificationTime,
  truncateText
} = require('../utils/notification-links');

const COMMENT_ADMIN_ROLES = ['admin', 'super_admin'];
const LINK_PATTERN = /https?:\/\/|www\.|[a-z0-9-]+\.(?:com|cn|net|org|top|cc|xyz|io|me|co)\b|[a-z0-9._-]+@[a-z0-9-]+\./i;
const CONTACT_PATTERN = /\d{6,}|(?:\d[ -]?){9,}|(?:微信|vx|v信|wx|weixin|加我|扫码|二维码|qq|扣扣)\s*[:：]?\s*[a-z0-9_-]{4,}/i;

function getRequestUserId(req) {
  return req.user?.userId || req.user?.id || req.user?._id;
}

function getAdminId(req) {
  return req.admin?.id || req.admin?._id || null;
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function parseJsonValue(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return value;
  }
}

function parseIdArray(value) {
  const parsed = parseJsonValue(value, []);
  if (Array.isArray(parsed)) return [...new Set(parsed.map(item => String(item).trim()).filter(Boolean))];
  if (typeof parsed === 'string') return [...new Set(parsed.split(',').map(item => item.trim()).filter(Boolean))];
  return [];
}

function parseInteger(value, fallback, min, max) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function parseBoolean(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return Boolean(value);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\p{Cf}/gu, '')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function normalizeCommentContent(value) {
  const content = normalizeText(value);
  if (!content) throw badRequest('回响内容不能为空');
  if (Array.from(content).length > 500) throw badRequest('回响内容不能超过500字');
  if (LINK_PATTERN.test(content) || CONTACT_PATTERN.test(content)) {
    throw badRequest('回响里不要放链接或联系方式');
  }
  return content;
}

function sameId(left, right) {
  return idString(left) === idString(right);
}

function serializeUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    nickname: user.nickname || '微信用户',
    avatar: user.avatar || '',
    avatarUrl: user.avatarUrl || null
  };
}

// 一篇手札可以写给多位书友：companionUserIds 是全集，companionUserId 是第一位（旧字段兼容）
function companionIdSet(note) {
  const ids = [note.companionUserId, ...(note.companionUserIds || [])].filter(Boolean);
  const seen = new Set();
  return ids.filter(id => {
    const key = idString(id);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function userIsCompanion(userId, note) {
  if (!userId || !note) return false;
  return companionIdSet(note).some(id => sameId(userId, id));
}

function serializeComment(comment, note, currentUserId, { includeHidden = false } = {}) {
  const source = comment?.toObject ? comment.toObject() : { ...(comment || {}) };
  const replies = (source.replies || [])
    .filter(reply => includeHidden || !reply.hidden)
    .map(reply => {
      const { likes, ...replyWithoutLikes } = reply;
      return {
        ...replyWithoutLikes,
        user: serializeUser(reply.userId),
        userId: reply.userId?._id || reply.userId,
        replyToUser: serializeUser(reply.replyToUserId),
        replyToUserId: reply.replyToUserId?._id || reply.replyToUserId || null,
        isLiked: (likes || []).some(like => sameId(like.userId?._id || like.userId, currentUserId)),
        isCompanion: userIsCompanion(reply.userId?._id || reply.userId, note)
      };
    });

  return {
    ...source,
    user: serializeUser(source.userId),
    userId: source.userId?._id || source.userId,
    isLiked: (source.likes || []).some(like => sameId(like.userId?._id || like.userId, currentUserId)),
    isCompanion: userIsCompanion(source.userId?._id || source.userId, note),
    likes: undefined,
    replies
  };
}

function publicDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(date);
}

function shanghaiDayRange(date = new Date()) {
  const dateKey = publicDateKey(date);
  const start = new Date(`${dateKey}T00:00:00+08:00`);
  const end = new Date(`${dateKey}T23:59:59.999+08:00`);
  return { dateKey, start, end };
}

async function decorateNotes(notes, userId) {
  if (!notes.length) return [];
  const noteIds = notes.map(note => note._id);
  const sectionIds = notes.flatMap(note => note.sectionIds || []);
  const [reads, likes, sections] = await Promise.all([
    CompanionNoteRead.find({ userId, noteId: { $in: noteIds } }).select('noteId').lean(),
    CompanionNoteLike.find({ userId, noteId: { $in: noteIds } }).select('noteId').lean(),
    getPublishedSections([...new Map(sectionIds.map(sectionId => [idString(sectionId), sectionId])).values()])
  ]);
  const readSet = new Set(reads.map(item => idString(item.noteId)));
  const likeSet = new Set(likes.map(item => idString(item.noteId)));
  const sectionMap = new Map();
  notes.forEach(note => {
    sectionMap.set(idString(note._id), sectionLabelsForNote(note, sections));
  });
  const newCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return notes.map(note => {
    const noteId = idString(note._id);
    const isRead = readSet.has(noteId);
    return toPublicNote(note, {
      sectionLabels: sectionMap.get(noteId) || [],
      isRead,
      isNew: !isRead && note.publishedAt && new Date(note.publishedAt).getTime() >= newCutoff,
      isLiked: likeSet.has(noteId)
    });
  });
}

async function findAdminNote(noteId) {
  if (!isValidObjectId(noteId)) return null;
  return CompanionNote.findById(noteId);
}

async function loadUserNoteForComment(req, userId) {
  if (req.params.id) return loadAccessibleNote(req.params.id, userId);
  if (!isValidObjectId(req.params.commentId)) return null;
  const comment = await CompanionNoteComment.findById(req.params.commentId).select('noteId').lean();
  return comment ? loadAccessibleNote(comment.noteId, userId) : null;
}

async function loadAdminNoteForComment(req) {
  if (req.params.id) return findAdminNote(req.params.id);
  if (!isValidObjectId(req.params.commentId)) return null;
  const comment = await CompanionNoteComment.findById(req.params.commentId).select('noteId').lean();
  return comment ? findAdminNote(comment.noteId) : null;
}

async function ensureCompanionUsers(companionUserIds = []) {
  if (!companionUserIds.length) return [];
  const invalid = companionUserIds.some(id => !isValidObjectId(id));
  if (invalid) throw badRequest('陪伴人账号不正确');
  const users = await User.find({ _id: { $in: companionUserIds } })
    .select('_id nickname avatar avatarUrl openid')
    .lean();
  if (users.length !== companionUserIds.length) throw notFound('陪伴人账号不存在');
  return users;
}

async function ensureCompanionUser(companionUserId) {
  if (!companionUserId) return null;
  if (!isValidObjectId(companionUserId)) throw badRequest('陪伴人账号不正确');
  const user = await User.findById(companionUserId).select('_id nickname avatar avatarUrl openid').lean();
  if (!user) throw notFound('陪伴人账号不存在');
  return user;
}

async function validateNoteBinding(periodId, sectionIds) {
  if (sectionIds.length && !periodId) throw badRequest('绑定课次时必须选择期次');
  if (!periodId) return null;
  if (!isValidObjectId(periodId)) {
    logger.warn('陪伴手札保存被拒：periodId 非法', { periodId, sectionIds });
    throw badRequest('期次参数不正确');
  }

  const period = await Period.findById(periodId).select('_id tenantId').lean();
  if (!period) throw notFound('期次不存在');
  if (!sectionIds.length) return period;
  if (sectionIds.some(sectionId => !isValidObjectId(sectionId))) {
    throw badRequest('课次参数不正确');
  }

  const sections = await Section.find({ _id: { $in: sectionIds }, periodId })
    .select('_id periodId tenantId')
    .lean();
  if (sections.length !== sectionIds.length) {
    throw badRequest('所选课次必须属于当前期次和租户');
  }
  if (sections.some(section => !sameId(section.periodId, period._id) || !sameId(section.tenantId, period.tenantId))) {
    throw badRequest('所选课次必须属于当前期次和租户');
  }
  return period;
}

function validateMetadata(body) {
  const title = normalizeText(body.title);
  const summary = normalizeText(body.summary);
  const periodId = body.periodId === undefined || body.periodId === '' || body.periodId === null
    ? null
    : String(body.periodId);
  const sectionIds = parseIdArray(body.sectionIds);
  // 支持一位或多位陪伴书友：companionUserIds 是全集，companionUserId 保持第一位兼容旧逻辑
  const companionUserIds = parseIdArray(body.companionUserIds);
  const companionUserId = body.companionUserId || companionUserIds[0] || null;
  // 手札里显示的陪伴人名字：选了书友就不必手填（saveAdminNote 会补第一位书友的昵称）
  const companionName = normalizeText(body.companionName);
  if (Array.from(title).length < 1 || Array.from(title).length > 40) throw badRequest('标题长度必须为1–40字');
  if (Array.from(summary).length > 200) throw badRequest('简介不能超过200字');
  if (!companionUserIds.length && (Array.from(companionName).length < 1 || Array.from(companionName).length > 20)) {
    throw badRequest('陪伴人名称长度必须为1–20字');
  }
  if (companionUserIds.length && Array.from(companionName).length > 20) {
    throw badRequest('陪伴人名称不能超过20字');
  }
  return {
    title,
    summary,
    companionName,
    companionUserId,
    companionUserIds: companionUserId ? [companionUserId, ...companionUserIds.filter(id => id !== companionUserId)] : [],
    periodId,
    sectionIds
  };
}


async function refreshNoteCommentCount(noteId) {
  const comments = await CompanionNoteComment.find({ noteId }).select('hidden replies').lean();
  const visibleComments = comments.filter(comment => !comment.hidden);
  await CompanionNote.updateOne(
    { _id: noteId },
    {
      $set: {
        commentCount: visibleComments.length
      }
    }
  );
  return visibleComments.length;
}

async function runContentCheck(userId, content) {
  const sender = await User.findById(userId).select('openid').lean();
  try {
    await contentSecurity.checkText({ openid: sender?.openid, content, scene: contentSecurity.SCENE_COMMENT });
  } catch (error) {
    if (error?.code === contentSecurity.CONTENT_RISKY) {
      const risky = badRequest('这句话没有通过检查，换个说法试试');
      risky.code = contentSecurity.CONTENT_RISKY;
      throw risky;
    }
    const unavailable = new Error('现在发不出去，稍后再试');
    unavailable.statusCode = 503;
    unavailable.code = contentSecurity.CONTENT_CHECK_UNAVAILABLE;
    throw unavailable;
  }
}

async function notifySafely(req, payload) {
  try {
    await dispatchNotificationWithSubscribe(req, payload);
  } catch (error) {
    logger.warn('陪伴手札通知发送失败', {
      message: error.message,
      sourceId: payload.sourceId,
      recipientUserId: payload.recipientUserId
    });
  }
}

async function notifyCompanionComment(req, note, actorUser, commentId, replyId, content) {
  const actorId = actorUser?._id || actorUser;
  // 所有陪伴书友都收到回响来信（不含触发人自己）
  const recipients = companionIdSet(note).filter(id => !sameId(id, actorId));
  if (!recipients.length) return;

  const { dateKey, start, end } = shanghaiDayRange();
  const count = await CompanionNoteComment.countDocuments({
    noteId: note._id,
    createdAt: { $gte: start, $lte: end },
    hidden: { $ne: true }
  });
  const title = `《${truncateText(note.title, 30)}》今天有 ${count} 条新回响`;
  await Promise.all(recipients.map(recipientUserId => notifySafely(req, {
    recipientUserId,
    notificationType: 'companion_note_comment',
    title,
    content: truncateText(content, 80),
    scene: null,
    targetPage: buildCompanionNoteTargetPage(note._id, { focus: 'comments', commentId, replyId }),
    senderId: actorId,
    data: {
      companionNoteId: note._id.toString(),
      companionNoteTitle: note.title,
      companionNoteDate: dateKey,
      commentCount: count,
      commentId: idString(commentId),
      replyId: replyId ? idString(replyId) : null
    },
    sourceType: 'companion_note_comment',
    sourceId: commentId,
    upsertExistingNotification: true
  })));
}

async function notifyReply(req, note, comment, reply, actorUser, recipientUserId) {
  const actorId = actorUser?._id || actorUser;
  if (!recipientUserId || sameId(recipientUserId, actorId)) return;
  await notifySafely(req, {
    recipientUserId,
    notificationType: 'companion_note_reply',
    title: '有书友回复了你的回响',
    content: `${actorUser?.nickname || '有人'} 回复了你的回响`,
    scene: 'comment_received',
    targetPage: buildCompanionNoteTargetPage(note._id, {
      focus: 'comments',
      commentId: comment._id,
      replyId: reply._id
    }),
    senderId: actorId,
    data: {
      companionNoteId: note._id.toString(),
      companionNoteTitle: note.title,
      commentId: comment._id.toString(),
      replyId: reply._id.toString()
    },
    subscribeFields: {
      replyUser: actorUser?.nickname || '用户',
      replyTopic: truncateText(comment.content, 32),
      replyContent: truncateText(reply.content, 32),
      replyTime: formatNotificationTime(reply.createdAt)
    },
    sourceType: 'companion_note_reply',
    sourceId: reply._id
  });
}

async function getList(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const filter = await buildAccessibleNoteFilter(userId, {
      periodId: req.query.periodId,
      scope: req.query.scope
    });
    if (!filter) {
      return res.json(success({
        list: [],
        pagination: { page, limit, total: 0, pages: 0 }
      }));
    }

    const [total, notes] = await Promise.all([
      CompanionNote.countDocuments(filter),
      CompanionNote.find(filter)
        .sort({ sortOrder: 1, publishedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ]);
    const list = await decorateNotes(notes, userId);
    const accessiblePeriodIds = await getCommunityAccessiblePeriodIds(userId);
    const [tabNotes, periods] = accessiblePeriodIds.length
      ? await Promise.all([
          CompanionNote.find({ ...PUBLISHED_NOTE_FILTER, periodId: { $in: accessiblePeriodIds } })
            .select('periodId')
            .lean(),
          Period.find({ _id: { $in: accessiblePeriodIds } })
            .select('_id name title startDate startTime createdAt')
            .sort({ startDate: -1, startTime: -1, createdAt: -1 })
            .lean()
        ])
      : [[], []];
    const tabPeriodIds = new Set(tabNotes.map(note => idString(note.periodId)));
    const periodTabs = periods
      .filter(period => tabPeriodIds.has(idString(period._id)))
      .map(period => ({
        id: period._id,
        name: period.name || period.title || '未命名期次'
      }));
    const response = {
      list,
      periods: periodTabs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
    if (req.query.scope === 'all') {
      const allNoteRows = await CompanionNote.find(filter).select('_id').lean();
      response.totalCount = allNoteRows.length;
      response.readCount = allNoteRows.length
        ? await CompanionNoteRead.countDocuments({
            userId,
            noteId: { $in: allNoteRows.map(note => note._id) }
          })
        : 0;
    }
    return res.json(success(response));
  } catch (error) {
    return next(error);
  }
}

async function getSectionNotes(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const { sectionId } = req.params;
    if (!isValidObjectId(sectionId)) return res.status(404).json(errors.notFound('课程不存在'));
    const section = await Section.findById(sectionId).select('_id periodId isPublished').lean();
    if (!section) return res.status(404).json(errors.notFound('课程不存在'));
    const period = await Period.findById(section.periodId).select('_id name title readingAccess isPublished visibilityType visibleUserIds').lean();
    if (!period) return res.status(404).json(errors.notFound('期次不存在'));

    const noteFilter = { ...PUBLISHED_NOTE_FILTER, sectionIds: sectionId };
    const count = await CompanionNote.countDocuments(noteFilter);
    if (!(await hasPeriodCommunityAccess(userId, period._id))) {
      const access = await getPeriodAccessState(period, userId);
      if (!access.canRead) {
        return res.status(403).json(errors.forbidden('请先报名后学习'));
      }
      return res.json(success({ locked: true, count }));
    }

    const notes = await CompanionNote.find(noteFilter)
      .sort({ sortOrder: 1, publishedAt: -1, createdAt: -1 })
      .lean();
    return res.json(success({ locked: false, count, list: await decorateNotes(notes, userId) }));
  } catch (error) {
    return next(error);
  }
}

async function getPeriodOverview(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const { periodId } = req.params;
    if (!isValidObjectId(periodId)) return res.status(404).json(errors.notFound('期次不存在'));
    if (!(await hasPeriodCommunityAccess(userId, periodId))) {
      return res.status(403).json(errors.forbidden('当前期次未支付，暂不可查看陪伴手札'));
    }

    // 「不绑定期次」的全营手札对本期学员同样可见：和专区列表的可见范围保持一致
    const notes = await CompanionNote.find({ ...PUBLISHED_NOTE_FILTER, $or: [{ periodId }, { periodId: null }] })
      .sort({ sortOrder: 1, publishedAt: -1, createdAt: -1 })
      .lean();
    const list = await decorateNotes(notes, userId);
    const [allSections, readRows] = await Promise.all([
      Section.find({ periodId, isPublished: true }).select('_id day title').sort({ day: 1 }).lean(),
      CompanionNoteRead.find({ userId, noteId: { $in: notes.map(note => note._id) } }).select('noteId').lean()
    ]);
    const readSet = new Set(readRows.map(row => idString(row.noteId)));
    const sectionOverview = allSections.map(section => {
      const sectionNotes = notes.filter(note => (note.sectionIds || []).some(id => sameId(id, section._id)));
      const sectionRead = sectionNotes.length > 0 && sectionNotes.every(note => readSet.has(idString(note._id)));
      return {
        sectionId: section._id,
        day: section.day,
        title: section.title,
        hasNote: sectionNotes.length > 0,
        isRead: sectionRead
      };
    });
    const readCount = list.filter(note => note.isRead).length;
    return res.json(success({
      periodId,
      totalCount: list.length,
      readCount,
      unreadCount: list.length - readCount,
      latest: list.slice(0, 1)[0] || null,
      latestUnread: list.find(note => !note.isRead) || null,
      list,
      sections: sectionOverview
    }));
  } catch (error) {
    return next(error);
  }
}

async function getDetail(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const note = await loadAccessibleNote(req.params.id, userId);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const sections = await getPublishedSections(note.sectionIds || []);
    const [read, like, recentLikes] = await Promise.all([
      CompanionNoteRead.findOne({ noteId: note._id, userId }).select('lastOpenedAt openCount').lean(),
      CompanionNoteLike.findOne({ noteId: note._id, userId }).select('_id').lean(),
      CompanionNoteLike.find({ noteId: note._id })
        .sort({ createdAt: -1 })
        .limit(6)
        .populate('userId', 'nickname avatar avatarUrl')
        .lean()
    ]);
    const likes = recentLikes.map(item => ({
      ...serializeUser(item.userId),
      userId: item.userId?._id || item.userId,
      createdAt: item.createdAt,
      isCompanion: userIsCompanion(item.userId?._id || item.userId, note)
    }));
    return res.json(success(toPublicNote(note, {
      sectionLabels: sectionLabelsForNote(note, sections),
      isRead: Boolean(read),
      isLiked: Boolean(like),
      recentLikes: likes
    })));
  } catch (error) {
    return next(error);
  }
}

async function issueFileTicket(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const note = await loadAccessibleNote(req.params.id, userId);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
      logger.warn('陪伴手札下载链接签发失败：缺少租户上下文', {
        noteId: req.params.id,
        hasUser: Boolean(req.user),
        path: req.path
      });
      return res.status(503).json(errors.serviceUnavailable('暂时无法签发下载链接'));
    }
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const token = encodeTicket({
      noteId: note._id.toString(),
      userId: idString(userId),
      tenantId: tenantId.toString(),
      exp: Math.floor(expiresAt / 1000)
    });
    const baseUrl = String(process.env.COMPANION_FILE_BASE_URL || process.env.API_BASE_URL || 'https://wx.shubai01.com').replace(/\/$/u, '');
    return res.json(success({
      url: `${baseUrl}/api/v1/companion-notes/${note._id}/file?t=${encodeURIComponent(token)}`,
      expiresAt: new Date(expiresAt).toISOString()
    }));
  } catch (error) {
    return next(error);
  }
}

async function downloadFile(req, res, next) {
  const payload = decodeTicket(req.query.t);
  if (!payload || !isValidObjectId(req.params.id) || !sameId(payload.noteId, req.params.id)) {
    return res.status(403).json(errors.forbidden('下载链接无效或已过期'));
  }
  try {
    return withSystemContext(payload.tenantId, async () => {
      const note = await CompanionNote.findOne({ _id: payload.noteId, ...PUBLISHED_NOTE_FILTER });
      if (!note || !sameId(note.tenantId, payload.tenantId)) {
        return res.status(403).json(errors.forbidden('下载链接无效或已过期'));
      }
      const allowed = note.periodId
        ? await hasPeriodCommunityAccess(payload.userId, note.periodId)
        : (await getCommunityAccessiblePeriodIds(payload.userId)).length > 0;
      if (!allowed) return res.status(403).json(errors.forbidden('当前没有阅读权限'));
      const pdfPath = await resolvePdfPath(payload.tenantId, note.file.dir);
      // 打开 PDF 时显示后台上传的原始文件名，而不是服务器上的随机令牌名
      const downloadName = (note.file && note.file.originalName
        ? path.basename(String(note.file.originalName))
        : `${note.title || 'companion-note'}.pdf`).replace(/["\r\n]/g, '').slice(0, 180) || 'companion-note.pdf';
      res.set({
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, max-age=600',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `inline; filename="companion-note.pdf"; filename*=UTF-8''${encodeURIComponent(downloadName)}`
      });
      return res.sendFile(pdfPath, { acceptRanges: true, cacheControl: false, dotfiles: 'deny' }, error => {
        if (error && !res.headersSent) next(error);
      });
    });
  } catch (error) {
    return next(error);
  }
}

async function markRead(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const note = await loadAccessibleNote(req.params.id, userId);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const now = new Date();
    let existing;
    try {
      existing = await CompanionNoteRead.findOneAndUpdate(
        { noteId: note._id, userId },
        [
          {
            $set: {
              lastOpenedAt: now,
              firstOpenedAt: { $ifNull: ['$firstOpenedAt', now] },
              openCount: { $add: [{ $ifNull: ['$openCount', 0] }, 1] }
            }
          }
        ],
        { upsert: true, new: false, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      existing = await CompanionNoteRead.findOneAndUpdate(
        { noteId: note._id, userId },
        [
          {
            $set: {
              lastOpenedAt: now,
              firstOpenedAt: { $ifNull: ['$firstOpenedAt', now] },
              openCount: { $add: [{ $ifNull: ['$openCount', 0] }, 1] }
            }
          }
        ],
        { new: false }
      );
    }
    if (!existing) await CompanionNote.updateOne({ _id: note._id }, { $inc: { readerCount: 1 } });
    return res.json(success({ noteId: note._id, isRead: true, firstRead: !existing }));
  } catch (error) {
    return next(error);
  }
}

async function likeNote(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const note = await loadAccessibleNote(req.params.id, userId);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    let created = false;
    try {
      const result = await CompanionNoteLike.updateOne(
        { noteId: note._id, userId },
        { $setOnInsert: { noteId: note._id, userId, createdAt: new Date() } },
        { upsert: true }
      );
      created = Number(result.upsertedCount || (result.upsertedId ? 1 : 0)) > 0;
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
    if (created) await CompanionNote.updateOne({ _id: note._id }, { $inc: { likeCount: 1 } });
    const latest = await CompanionNote.findById(note._id).select('likeCount').lean();
    return res.json(success({ liked: true, likeCount: latest?.likeCount ?? note.likeCount }));
  } catch (error) {
    return next(error);
  }
}

async function unlikeNote(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const note = await loadAccessibleNote(req.params.id, userId);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const result = await CompanionNoteLike.deleteOne({ noteId: note._id, userId });
    if (Number(result.deletedCount || result.n || 0) > 0) {
      await CompanionNote.updateOne({ _id: note._id, likeCount: { $gt: 0 } }, { $inc: { likeCount: -1 } });
    }
    const latest = await CompanionNote.findById(note._id).select('likeCount').lean();
    return res.json(success({ liked: false, likeCount: latest?.likeCount ?? note.likeCount }));
  } catch (error) {
    return next(error);
  }
}

async function listComments(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const note = await loadAccessibleNote(req.params.id, userId);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const filter = { noteId: note._id, hidden: { $ne: true } };
    const [total, comments] = await Promise.all([
      CompanionNoteComment.countDocuments(filter),
      CompanionNoteComment.find(filter)
        .sort({ isPinned: -1, pinnedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'nickname avatar avatarUrl')
        .populate('replies.userId', 'nickname avatar avatarUrl')
        .populate('replies.replyToUserId', 'nickname avatar avatarUrl')
        .lean()
    ]);
    return res.json(success({
      list: comments.map(comment => serializeComment(comment, note, userId)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    }));
  } catch (error) {
    return next(error);
  }
}

async function createComment(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const note = await loadAccessibleNote(req.params.id, userId);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const content = normalizeCommentContent(req.body.content);
    await runContentCheck(userId, content);
    const comment = await CompanionNoteComment.create({
      noteId: note._id,
      userId,
      content,
      tenantId: getCurrentTenantId()
    });
    await CompanionNote.updateOne({ _id: note._id }, { $inc: { commentCount: 1 } });
    const actor = await User.findById(userId).select('nickname avatar avatarUrl').lean();
    await notifyCompanionComment(req, note, actor, comment._id, null, content);
    return res.status(201).json(success(serializeComment({ ...comment.toObject(), userId: actor }, note, userId), '回响成功'));
  } catch (error) {
    return next(error);
  }
}

async function replyToComment(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const note = await loadUserNoteForComment(req, userId);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const comment = await CompanionNoteComment.findOne({
      _id: req.params.commentId,
      noteId: note._id,
      hidden: { $ne: true }
    });
    if (!comment) return res.status(404).json(errors.notFound('回响不存在'));
    const content = normalizeCommentContent(req.body.content);
    await runContentCheck(userId, content);
    const requestedReplyToUserId = req.body.replyToUserId && isValidObjectId(req.body.replyToUserId)
      ? req.body.replyToUserId
      : null;
    const participantIds = [comment.userId, ...(comment.replies || []).map(item => item.userId)];
    const replyToUserId = requestedReplyToUserId && participantIds.some(id => sameId(id, requestedReplyToUserId))
      ? requestedReplyToUserId
      : null;
    comment.replies.push({ userId, content, replyToUserId, createdAt: new Date() });
    comment.replyCount = comment.replies.filter(reply => !reply.hidden).length;
    await comment.save();
    const reply = comment.replies[comment.replies.length - 1];
    const actor = await User.findById(userId).select('nickname avatar avatarUrl').lean();
    const recipientUserId = replyToUserId || comment.userId;
    await notifyReply(req, note, comment, reply, actor, recipientUserId);
    const populated = await CompanionNoteComment.findById(comment._id)
      .populate('userId', 'nickname avatar avatarUrl')
      .populate('replies.userId', 'nickname avatar avatarUrl')
      .populate('replies.replyToUserId', 'nickname avatar avatarUrl')
      .lean();
    return res.json(success(serializeComment(populated, note, userId), '回复成功'));
  } catch (error) {
    return next(error);
  }
}

async function deleteComment(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const note = await loadUserNoteForComment(req, userId);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const comment = await CompanionNoteComment.findOne({ _id: req.params.commentId, noteId: note._id });
    if (!comment) return res.status(404).json(errors.notFound('回响不存在'));
    if (!sameId(comment.userId, userId) && !COMMENT_ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json(errors.forbidden('无权删除'));
    }
    await CompanionNoteComment.deleteOne({ _id: comment._id });
    await refreshNoteCommentCount(note._id);
    return res.json(success(null, '回响删除成功'));
  } catch (error) {
    return next(error);
  }
}

async function deleteReply(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const note = await loadUserNoteForComment(req, userId);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const comment = await CompanionNoteComment.findOne({ _id: req.params.commentId, noteId: note._id });
    if (!comment) return res.status(404).json(errors.notFound('回响不存在'));
    const reply = comment.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json(errors.notFound('回复不存在'));
    if (!sameId(reply.userId, userId) && !COMMENT_ADMIN_ROLES.includes(req.user?.role)) {
      return res.status(403).json(errors.forbidden('无权删除'));
    }
    reply.deleteOne();
    comment.replyCount = comment.replies.filter(item => !item.hidden).length;
    await comment.save();
    return res.json(success(null, '回复删除成功'));
  } catch (error) {
    return next(error);
  }
}

async function likeComment(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const note = await loadUserNoteForComment(req, userId);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const comment = await CompanionNoteComment.findOne({ _id: req.params.commentId, noteId: note._id, hidden: { $ne: true } });
    if (!comment) return res.status(404).json(errors.notFound('回响不存在'));
    if (!comment.likes.some(like => sameId(like.userId, userId))) {
      comment.likes.push({ userId, createdAt: new Date() });
      comment.likeCount = comment.likes.length;
      await comment.save();
    }
    return res.json(success(serializeComment(comment, note, userId), '点赞成功'));
  } catch (error) {
    return next(error);
  }
}

async function unlikeComment(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const note = await loadUserNoteForComment(req, userId);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const comment = await CompanionNoteComment.findOne({ _id: req.params.commentId, noteId: note._id, hidden: { $ne: true } });
    if (!comment) return res.status(404).json(errors.notFound('回响不存在'));
    comment.likes = comment.likes.filter(like => !sameId(like.userId, userId));
    comment.likeCount = comment.likes.length;
    await comment.save();
    return res.json(success(serializeComment(comment, note, userId), '取消点赞成功'));
  } catch (error) {
    return next(error);
  }
}

async function likeReply(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const note = await loadUserNoteForComment(req, userId);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const comment = await CompanionNoteComment.findOne({ _id: req.params.commentId, noteId: note._id, hidden: { $ne: true } });
    if (!comment) return res.status(404).json(errors.notFound('回响不存在'));
    const reply = comment.replies.id(req.params.replyId);
    if (!reply || reply.hidden) return res.status(404).json(errors.notFound('回复不存在'));
    if (!reply.likes.some(like => sameId(like.userId, userId))) {
      reply.likes.push({ userId, createdAt: new Date() });
      reply.likeCount = reply.likes.length;
      await comment.save();
    }
    return res.json(success(serializeComment(comment, note, userId), '点赞成功'));
  } catch (error) {
    return next(error);
  }
}

async function unlikeReply(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const note = await loadUserNoteForComment(req, userId);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const comment = await CompanionNoteComment.findOne({ _id: req.params.commentId, noteId: note._id, hidden: { $ne: true } });
    if (!comment) return res.status(404).json(errors.notFound('回响不存在'));
    const reply = comment.replies.id(req.params.replyId);
    if (!reply || reply.hidden) return res.status(404).json(errors.notFound('回复不存在'));
    reply.likes = reply.likes.filter(like => !sameId(like.userId, userId));
    reply.likeCount = reply.likes.length;
    await comment.save();
    return res.json(success(serializeComment(comment, note, userId), '取消点赞成功'));
  } catch (error) {
    return next(error);
  }
}

async function uploadFiles(req, res, next) {
  try {
    const tenantId = req.resolvedTenantId || getCurrentTenantId();
    if (!tenantId) return res.status(403).json(errors.forbidden('上传前必须选择具体租户'));
    const pdf = req.files?.file?.[0];
    const cover = req.files?.cover?.[0];
    const result = await storeUpload({ tenantId, pdf, cover });
    cleanupOrphanUploads().catch(error => logger.warn('陪伴手札临时目录清理失败', { message: error.message }));
    return res.status(201).json(success({
      fileToken: result.fileToken,
      file: result.file,
      coverUrl: result.coverUrl
    }, '文件上传成功'));
  } catch (error) {
    return next(error);
  }
}

async function uploadPage(req, res, next) {
  try {
    const tenantId = req.resolvedTenantId || getCurrentTenantId();
    if (!tenantId) return res.status(403).json(errors.forbidden('上传前必须选择具体租户'));
    if (!isSafeFileToken(req.params.fileToken)) return res.status(400).json(errors.badRequest('无效的文件令牌'));
    const page = req.file;
    const result = await storePage({
      tenantId,
      fileToken: req.params.fileToken,
      pageNo: req.body.pageNo,
      page
    });
    return res.json(success(result, '页图上传成功'));
  } catch (error) {
    return next(error);
  }
}

async function listAdmin(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const filter = { ...(req.query.includeDeleted === 'true' ? {} : { deletedAt: null }) };
    if (req.query.status && ['draft', 'published'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.periodId && isValidObjectId(req.query.periodId)) filter.periodId = req.query.periodId;
    if (req.query.sectionId && isValidObjectId(req.query.sectionId)) filter.sectionIds = req.query.sectionId;
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const pattern = new RegExp(escapeRegExp(req.query.q.trim().slice(0, 40)), 'i');
      filter.$or = [{ title: pattern }, { companionName: pattern }];
    }
    const [total, notes] = await Promise.all([
      CompanionNote.countDocuments(filter),
      CompanionNote.find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('companionUserId', 'nickname avatar avatarUrl')
        .populate('periodId', 'name title')
        .populate('sectionIds', 'day title isPublished')
        .lean()
    ]);
    const list = notes.map(note => {
      const source = { ...note };
      const file = source.file || {};
      delete source.tenantId;
      delete source.deletedAt;
      delete source.file;
      return {
        ...source,
        fileToken: file.dir ? path.basename(file.dir) : '',
        file: {
          originalName: file.originalName || '',
          size: file.size || 0,
          pageCount: file.pageCount || 0,
          pagesReady: Boolean(file.pagesReady),
          uploadedAt: file.uploadedAt || null
        }
      };
    });
    return res.json(success({ list, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }));
  } catch (error) {
    return next(error);
  }
}

async function getAdminDetail(req, res, next) {
  try {
    const note = await findAdminNote(req.params.id);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const sections = await getPublishedSections(note.sectionIds || []);
    return res.json(success(toPublicNote(note, {
      sectionLabels: sectionLabelsForNote(note, sections),
      fileToken: note.file?.dir ? path.basename(note.file.dir) : ''
    })));
  } catch (error) {
    return next(error);
  }
}

async function saveAdminNote(req, res, next) {
  try {
    let metadata = validateMetadata(req.body);
    // 先校验陪伴书友：选了书友时，缺省的手札显示名会在这里补上第一位书友的昵称
    const companions = await ensureCompanionUsers(metadata.companionUserIds);
    if (companions.length && !normalizeText(req.body.companionName)) {
      metadata = {
        ...metadata,
        companionName: String(companions[0].nickname || '').slice(0, 20) || metadata.companionName
      };
    }
    await validateNoteBinding(metadata.periodId, metadata.sectionIds);

    const note = req.params.id ? await findAdminNote(req.params.id) : null;
    if (req.params.id && !note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const tenantId = getCurrentTenantId();
    if (!tenantId) return res.status(403).json(errors.forbidden('保存前必须选择具体租户'));
    const fileToken = req.body.fileToken ? String(req.body.fileToken) : null;
    let nextFile = note?.file;
    let nextCoverUrl = note?.coverUrl;
    if (fileToken) {
      if (!isSafeFileToken(fileToken)) throw badRequest('无效的文件令牌');
      const upload = await inspectUpload(tenantId, fileToken);
      const pageCount = parseInteger(req.body.pageCount, null, 1, 120);
      if (!pageCount) throw badRequest('页数必须是1–120的整数');
      nextFile = {
        dir: upload.relativeDir,
        originalName: path.basename(req.body.originalName || upload.originalName || note?.file?.originalName || 'companion-note.pdf').slice(0, 255),
        size: upload.size,
        pageCount,
        pagesReady: upload.pageNos.length === pageCount && upload.pageNos.every((pageNo, index) => pageNo === index + 1),
        uploadedAt: new Date()
      };
      nextCoverUrl = String(req.body.coverUrl || '');
      if (!nextCoverUrl) throw badRequest('缺少封面图片');
      const slug = await resolveTenantSlug(tenantId);
      if (!nextCoverUrl.startsWith(`/uploads/tenants/${slug}/`) || nextCoverUrl.includes('..')) {
        throw badRequest('封面地址不属于当前租户');
      }
    }
    if (!nextFile) throw badRequest('缺少 PDF 文件，请先上传');
    if (!nextCoverUrl) throw badRequest('缺少封面图片');

    const updates = {
      ...metadata,
      file: nextFile,
      coverUrl: nextCoverUrl,
      updatedBy: getAdminId(req)
    };
    if (!note) {
      updates.createdBy = getAdminId(req);
      updates.tenantId = tenantId;
    }
    let saved;
    if (note) {
      const previousDir = note.file?.dir;
      Object.assign(note, updates);
      saved = await note.save();
      if (fileToken && previousDir && previousDir !== nextFile.dir) {
        await removeUploadDirectory(tenantId, previousDir).catch(error => logger.warn('旧陪伴手札文件清理失败', { message: error.message }));
      }
    } else {
      saved = await CompanionNote.create(updates);
    }
    return res.status(note ? 200 : 201).json(success(toPublicNote(saved), note ? '陪伴手札更新成功' : '陪伴手札创建成功'));
  } catch (error) {
    return next(error);
  }
}

async function deleteAdminNote(req, res, next) {
  try {
    const note = await findAdminNote(req.params.id);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    note.deletedAt = new Date();
    note.status = 'draft';
    note.updatedBy = getAdminId(req);
    await note.save();
    return res.json(success(null, '陪伴手札已删除'));
  } catch (error) {
    return next(error);
  }
}

async function publishAdminNote(req, res, next) {
  try {
    const note = await findAdminNote(req.params.id);
    if (!note || note.deletedAt) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    note.status = 'published';
    note.publishedAt = note.publishedAt || new Date();
    note.updatedBy = getAdminId(req);
    await note.save();
    return res.json(success(toPublicNote(note), '陪伴手札已发布'));
  } catch (error) {
    return next(error);
  }
}

async function unpublishAdminNote(req, res, next) {
  try {
    const note = await findAdminNote(req.params.id);
    if (!note || note.deletedAt) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    note.status = 'draft';
    note.updatedBy = getAdminId(req);
    await note.save();
    return res.json(success(toPublicNote(note), '陪伴手札已下线'));
  } catch (error) {
    return next(error);
  }
}

async function sortAdminNotes(req, res, next) {
  try {
    const items = parseJsonValue(req.body.items, req.body.items);
    if (!Array.isArray(items) || !items.length) return res.status(400).json(errors.badRequest('排序数据不能为空'));
    for (const item of items) {
      if (!isValidObjectId(item.id) || !Number.isFinite(Number(item.sortOrder))) {
        return res.status(400).json(errors.badRequest('排序数据不正确'));
      }
      await CompanionNote.updateOne({ _id: item.id }, { $set: { sortOrder: Number(item.sortOrder), updatedBy: getAdminId(req) } });
    }
    return res.json(success(null, '排序已保存'));
  } catch (error) {
    return next(error);
  }
}

async function previewAdminNote(req, res, next) {
  try {
    const note = await findAdminNote(req.params.id);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const tenantId = getCurrentTenantId();
    if (!tenantId) return res.status(403).json(errors.forbidden('预览前必须选择具体租户'));
    const pdfPath = await resolvePdfPath(tenantId, note.file.dir);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' });
    return res.sendFile(pdfPath, { acceptRanges: true, cacheControl: false }, error => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    return next(error);
  }
}

async function listAdminComments(req, res, next) {
  try {
    const note = await findAdminNote(req.params.id);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const comments = await CompanionNoteComment.find({ noteId: note._id })
      .sort({ isPinned: -1, pinnedAt: -1, createdAt: -1 })
      .populate('userId', 'nickname avatar avatarUrl')
      .populate('replies.userId', 'nickname avatar avatarUrl')
      .populate('replies.replyToUserId', 'nickname avatar avatarUrl')
      .lean();
    return res.json(success({ list: comments.map(comment => serializeComment(comment, note, null, { includeHidden: true })) }));
  } catch (error) {
    return next(error);
  }
}

async function moderateComment(req, res, next) {
  try {
    const note = await loadAdminNoteForComment(req);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const comment = await CompanionNoteComment.findOne({ _id: req.params.commentId, noteId: note._id });
    if (!comment) return res.status(404).json(errors.notFound('回响不存在'));
    if (req.body.isPinned !== undefined) {
      const shouldPin = parseBoolean(req.body.isPinned);
      if (shouldPin && !comment.isPinned) {
        const pinnedCount = await CompanionNoteComment.countDocuments({ noteId: note._id, isPinned: true, _id: { $ne: comment._id }, hidden: { $ne: true } });
        if (pinnedCount >= 3) return res.status(400).json(errors.badRequest('每篇手札最多精选3条回响'));
      }
      comment.isPinned = shouldPin;
      comment.pinnedAt = shouldPin ? new Date() : null;
    }
    if (req.body.hidden !== undefined) {
      comment.hidden = parseBoolean(req.body.hidden);
      if (comment.hidden) {
        comment.isPinned = false;
        comment.pinnedAt = null;
      }
    }
    comment.replyCount = comment.replies.filter(reply => !reply.hidden).length;
    await comment.save();
    await refreshNoteCommentCount(note._id);
    return res.json(success(serializeComment(comment, note, null, { includeHidden: true }), '回响状态已更新'));
  } catch (error) {
    return next(error);
  }
}

async function moderateReply(req, res, next) {
  try {
    const note = await loadAdminNoteForComment(req);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const comment = await CompanionNoteComment.findOne({ _id: req.params.commentId, noteId: note._id });
    if (!comment) return res.status(404).json(errors.notFound('回响不存在'));
    const reply = comment.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json(errors.notFound('回复不存在'));
    if (req.body.hidden !== undefined) reply.hidden = parseBoolean(req.body.hidden);
    comment.replyCount = comment.replies.filter(item => !item.hidden).length;
    await comment.save();
    return res.json(success(serializeComment(comment, note, null, { includeHidden: true }), '回复状态已更新'));
  } catch (error) {
    return next(error);
  }
}

async function deleteAdminComment(req, res, next) {
  try {
    const note = await loadAdminNoteForComment(req);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const comment = await CompanionNoteComment.findOne({ _id: req.params.commentId, noteId: note._id });
    if (!comment) return res.status(404).json(errors.notFound('回响不存在'));
    await CompanionNoteComment.deleteOne({ _id: comment._id });
    await refreshNoteCommentCount(note._id);
    return res.json(success(null, '回响已删除'));
  } catch (error) {
    return next(error);
  }
}

async function deleteAdminReply(req, res, next) {
  try {
    const note = await loadAdminNoteForComment(req);
    if (!note) return res.status(404).json(errors.notFound('陪伴手札不存在'));
    const comment = await CompanionNoteComment.findOne({ _id: req.params.commentId, noteId: note._id });
    if (!comment) return res.status(404).json(errors.notFound('回响不存在'));
    const reply = comment.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json(errors.notFound('回复不存在'));
    reply.deleteOne();
    comment.replyCount = comment.replies.filter(item => !item.hidden).length;
    await comment.save();
    return res.json(success(null, '回复已删除'));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getList,
  getSectionNotes,
  getPeriodOverview,
  getDetail,
  issueFileTicket,
  downloadFile,
  markRead,
  likeNote,
  unlikeNote,
  listComments,
  createComment,
  replyToComment,
  deleteComment,
  deleteReply,
  likeComment,
  unlikeComment,
  likeReply,
  unlikeReply,
  uploadFiles,
  uploadPage,
  listAdmin,
  getAdminDetail,
  saveAdminNote,
  deleteAdminNote,
  publishAdminNote,
  unpublishAdminNote,
  sortAdminNotes,
  previewAdminNote,
  listAdminComments,
  moderateComment,
  moderateReply,
  deleteAdminComment,
  deleteAdminReply
};
