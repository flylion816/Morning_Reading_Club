const mongoose = require('mongoose');
const JoyNote = require('../models/JoyNote');
const JoyNoteShare = require('../models/JoyNoteShare');
const Period = require('../models/Period');
const Section = require('../models/Section');
const User = require('../models/User');
const { getCommunityAccessiblePeriodIds } = require('../services/community-access.service');
const { findEffectiveEnrollment, getPeriodAccessState } = require('../services/period-access.service');
const { success, errors } = require('../utils/response');
const awareness = require('../utils/awareness');
const logger = require('../utils/logger');

const MAX_CONTENT_LENGTH = 3000;
const MAX_SEARCH_LENGTH = 30;

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requestUserId(req) {
  return req.user?.userId || req.user?.id || req.user?._id;
}

function isId(value) {
  return typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value)
    && mongoose.Types.ObjectId.isValid(value);
}

function sameId(a, b) {
  return String(a || '') === String(b || '');
}

function validContent(value) {
  return typeof value === 'string' && value.trim().length > 0
    && value.trim().length <= MAX_CONTENT_LENGTH;
}

function periodName(period) {
  return period.name || period.title || '';
}

async function eligiblePeriods(userId) {
  const ids = await getCommunityAccessiblePeriodIds(userId);
  if (!ids.length) return [];
  const periods = await Period.find({ _id: { $in: ids } })
    .select('name title startDate readingAccess isPublished visibilityType visibleUserIds')
    .sort({ startDate: -1, _id: -1 })
    .lean();
  const checked = await Promise.all(periods.map(async period => ({
    period,
    access: await getPeriodAccessState(period, userId)
  })));
  return checked.filter(item => item.access.canRead).map(item => item.period);
}

async function canBindPeriod(userId, periodId) {
  const enrollment = await findEffectiveEnrollment(userId, periodId);
  if (!enrollment) return false;
  const period = await Period.findById(periodId)
    .select('readingAccess isPublished visibilityType visibleUserIds')
    .lean();
  if (!period) return false;
  const access = await getPeriodAccessState(period, userId);
  return Boolean(access.canRead);
}

async function validateAssociation(userId, periodId, sectionId) {
  if (!periodId) {
    return sectionId ? { status: 400, message: '请先选择期次' } : null;
  }
  if (!isId(periodId)) return { status: 400, message: '期次参数不正确' };
  if (!(await canBindPeriod(userId, periodId))) {
    return { status: 403, message: '只能关联已报名且有权限的期次' };
  }
  if (sectionId) {
    if (!isId(sectionId)) return { status: 400, message: '课程参数不正确' };
    const section = await Section.findOne({ _id: sectionId, periodId, isPublished: true })
      .select('_id')
      .lean();
    if (!section) return { status: 400, message: '课程不可用或不属于所选期次' };
  }
  return null;
}

function rejectAssociation(res, error) {
  return res.status(error.status).json(
    error.status === 403 ? errors.forbidden(error.message) : errors.badRequest(error.message)
  );
}

function formatAwareness(data) {
  if (!data) return null;
  const revisit = data.revisit || {};
  return {
    facts: data.facts || '',
    factsHtml: data.factsHtml || '',
    feelings: Array.from(data.feelings || []),
    bodyAreas: Array.from(data.bodyAreas || []),
    feelingNote: data.feelingNote || '',
    asks: Array.from(data.asks || []).map(ask => ({
      level: ask.level,
      question: ask.question,
      answer: ask.answer,
      answerHtml: ask.answerHtml || ''
    })),
    habitKey: data.habitKey || 'general',
    choice: data.choice || '',
    choiceHtml: data.choiceHtml || '',
    followUps: Array.from(data.followUps || []).map(item => ({ content: item.content, createdAt: item.createdAt })),
    revisit: {
      enabled: Boolean(revisit.enabled),
      status: revisit.status || 'none',
      dueAt: revisit.dueAt || null
    }
  };
}

function formatNote(note, periodMap = null, sectionMap = null) {
  const period = note.periodId && periodMap ? periodMap.get(String(note.periodId)) : null;
  const section = note.sectionId && sectionMap ? sectionMap.get(String(note.sectionId)) : null;
  const sectionVisible = section && period && sameId(section.periodId, period._id);
  return {
    id: note._id,
    _id: note._id,
    title: note.title || '',
    content: note.content,
    contentHtml: note.contentHtml || '',
    kind: note.kind === 'awareness' ? 'awareness' : 'joy',
    awareness: note.kind === 'awareness' ? formatAwareness(note.awareness) : null,
    periodId: note.periodId || null,
    sectionId: note.sectionId || null,
    periodName: period ? periodName(period) : '',
    sectionTitle: sectionVisible ? section.title : '',
    day: sectionVisible ? section.day : null,
    sourceUnavailable: Boolean(periodMap && note.periodId && !period),
    sectionUnavailable: Boolean(sectionMap && note.sectionId && period && !sectionVisible),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  };
}

async function getPeriods(req, res, next) {
  try {
    const periods = await eligiblePeriods(requestUserId(req));
    return res.json(success({
      list: periods.map(period => ({ id: period._id, name: periodName(period) }))
    }));
  } catch (error) {
    return next(error);
  }
}

async function getSections(req, res, next) {
  try {
    const { periodId } = req.params;
    if (!isId(periodId)) return res.status(400).json(errors.badRequest('期次参数不正确'));
    if (!(await canBindPeriod(requestUserId(req), periodId))) {
      return res.status(403).json(errors.forbidden('只能关联已报名且有权限的期次'));
    }
    const sections = await Section.find({ periodId, isPublished: true })
      .select('day title')
      .sort({ day: 1, sortOrder: 1, _id: 1 })
      .lean();
    return res.json(success({
      list: sections.map(section => ({ id: section._id, day: section.day, title: section.title }))
    }));
  } catch (error) {
    return next(error);
  }
}

// 这一批记录里没有任何关联了期次时，不用再去查有权限的期次（少几次查询）
async function loadAssociations(userId, rows) {
  const periods = rows.some(row => row.periodId) ? await eligiblePeriods(userId) : [];
  const periodMap = new Map(periods.map(period => [String(period._id), period]));
  const sectionIds = rows
    .filter(row => row.sectionId && periodMap.has(String(row.periodId)))
    .map(row => row.sectionId);
  const sections = sectionIds.length
    ? await Section.find({ _id: { $in: sectionIds }, isPublished: true })
      .select('periodId day title')
      .lean()
    : [];
  const sectionMap = new Map(sections.map(section => [String(section._id), section]));
  return { periodMap, sectionMap };
}

async function getMine(req, res, next) {
  try {
    const userId = requestUserId(req);
    const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 50);
    const periodId = req.query?.periodId;
    if (periodId && !isId(periodId)) return res.status(400).json(errors.badRequest('期次参数不正确'));
    const filter = { userId };
    if (periodId) filter.periodId = periodId;
    // kind：joy 随喜（含缺少该字段的历史记录）/ awareness 觉察 / 空或 all 全部
    const kind = req.query?.kind;
    if (kind && !['joy', 'awareness', 'all'].includes(kind)) {
      return res.status(400).json(errors.badRequest('类型参数不正确'));
    }
    if (kind === 'awareness') filter.kind = 'awareness';
    if (kind === 'joy') filter.kind = { $ne: 'awareness' };
    // 按关键词搜自己的记录（搜标题和内容，不区分大小写）
    const keyword = typeof req.query?.q === 'string' ? req.query.q.trim().slice(0, MAX_SEARCH_LENGTH) : '';
    if (keyword) {
      const pattern = { $regex: escapeRegExp(keyword), $options: 'i' };
      filter.$or = [{ content: pattern }, { title: pattern }];
    }
    const [total, rows] = await Promise.all([
      JoyNote.countDocuments(filter),
      JoyNote.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean()
    ]);
    const { periodMap, sectionMap } = await loadAssociations(userId, rows);
    return res.json(success({
      list: rows.map(row => formatNote(row, periodMap, sectionMap)),
      total,
      page,
      limit
    }));
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const userId = requestUserId(req);
    const body = req.body || {};
    const { content, periodId: rawPeriodId, sectionId: rawSectionId } = body;
    if (body.kind !== undefined && !['joy', 'awareness'].includes(body.kind)) {
      return res.status(400).json(errors.badRequest('类型参数不正确'));
    }
    const isAwareness = body.kind === 'awareness';
    const titleResult = awareness.cleanTitle(body.title);
    if (!titleResult.ok) return res.status(400).json(errors.badRequest(titleResult.message));
    let record;
    if (isAwareness) {
      // 觉察：content 由结构化内容拼出，不信任客户端传来的 content
      const cleaned = awareness.sanitizeAwareness(body.awareness);
      if (!cleaned.ok) return res.status(400).json(errors.badRequest(cleaned.message));
      const composed = awareness.composeContent(cleaned.value);
      if (!validContent(composed)) {
        return res.status(400).json(errors.badRequest(`请填写不超过 ${MAX_CONTENT_LENGTH} 字的内容`));
      }
      // 回访默认开启；没有写「择」就没有可以回头问的事，不回访
      const wantsRevisit = body.revisit !== false && Boolean(cleaned.value.choice);
      record = {
        kind: 'awareness',
        title: titleResult.value,
        content: composed,
        awareness: {
          ...cleaned.value,
          revisit: wantsRevisit
            ? { enabled: true, status: 'pending', dueAt: awareness.computeRevisitDueAt(new Date()), deliveredAt: null }
            : { enabled: false, status: 'none', dueAt: null, deliveredAt: null }
        }
      };
    } else {
      // 随喜：有 HTML 时，纯文本由清洗后的 HTML 推出；没有任何格式就只存纯文本
      const rich = awareness.cleanRichField(body.contentHtml, content, '内容', awareness.MAX_RICH_HTML_LENGTH);
      if (!rich.ok) return res.status(400).json(errors.badRequest(rich.message));
      if (!validContent(rich.text)) {
        return res.status(400).json(errors.badRequest(`请填写不超过 ${MAX_CONTENT_LENGTH} 字的内容`));
      }
      record = { title: titleResult.value, content: rich.text, contentHtml: rich.html };
    }
    const periodId = rawPeriodId || null;
    const sectionId = rawSectionId || null;
    const associationError = await validateAssociation(userId, periodId, sectionId);
    if (associationError) return rejectAssociation(res, associationError);
    const note = await JoyNote.create({ userId, ...record, periodId, sectionId });
    return res.status(201).json(success(formatNote(note), isAwareness ? '收进日记了' : '记下来了'));
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const userId = requestUserId(req);
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json(errors.badRequest('记录参数不正确'));
    const note = await JoyNote.findOne({ _id: id, userId });
    if (!note) return res.status(404).json(errors.notFound('记录不存在'));
    const body = req.body || {};
    const titleResult = awareness.cleanTitle(body.title);
    if (!titleResult.ok) return res.status(400).json(errors.badRequest(titleResult.message));
    if (note.kind === 'awareness') {
      // 觉察保存后只能改标题，其余内容保持不变；可以继续追加「后来」
      const otherKeys = Object.keys(body).filter(key => key !== 'title');
      if (!titleResult.provided || otherKeys.length) {
        return res.status(400).json(errors.badRequest('觉察记录只能修改标题，可以追加「后来」'));
      }
      note.title = titleResult.value;
      await note.save();
      return res.json(success(formatNote(note), '已保存'));
    }
    const rich = awareness.cleanRichField(body.contentHtml, body.content, '内容', awareness.MAX_RICH_HTML_LENGTH);
    if (!rich.ok) return res.status(400).json(errors.badRequest(rich.message));
    if (!validContent(rich.text)) {
      return res.status(400).json(errors.badRequest(`请填写不超过 ${MAX_CONTENT_LENGTH} 字的内容`));
    }
    const currentPeriodId = note.periodId ? String(note.periodId) : null;
    const currentSectionId = note.sectionId ? String(note.sectionId) : null;
    const periodId = Object.prototype.hasOwnProperty.call(body, 'periodId')
      ? (body.periodId || null) : currentPeriodId;
    const sectionId = Object.prototype.hasOwnProperty.call(body, 'sectionId')
      ? (body.sectionId || null) : currentSectionId;
    if (!sameId(periodId, note.periodId) || !sameId(sectionId, note.sectionId)) {
      const associationError = await validateAssociation(userId, periodId, sectionId);
      if (associationError) return rejectAssociation(res, associationError);
    }
    note.content = rich.text;
    note.contentHtml = rich.html;
    // 没带 title 就保持原标题；带了（包括空字符串清掉标题）就更新
    if (titleResult.provided) note.title = titleResult.value;
    note.periodId = periodId;
    note.sectionId = sectionId;
    await note.save();
    return res.json(success(formatNote(note), '已保存'));
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json(errors.badRequest('记录参数不正确'));
    const note = await JoyNote.findOneAndDelete({ _id: id, userId: requestUserId(req) });
    if (!note) return res.status(404).json(errors.notFound('记录不存在'));
    // 记录删了，它的分享链接和二维码也一起失效
    await JoyNoteShare.deleteMany({ noteId: id });
    return res.json(success({ id }, '已删除'));
  } catch (error) {
    return next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const userId = requestUserId(req);
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json(errors.badRequest('记录参数不正确'));
    const note = await JoyNote.findOne({ _id: id, userId }).lean();
    if (!note) return res.status(404).json(errors.notFound('记录不存在'));
    const { periodMap, sectionMap } = await loadAssociations(userId, [note]);
    return res.json(success(formatNote(note, periodMap, sectionMap)));
  } catch (error) {
    return next(error);
  }
}

// 追加一句「后来」：可写多次；写了就不用再回访
async function addFollowUp(req, res, next) {
  try {
    const userId = requestUserId(req);
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json(errors.badRequest('记录参数不正确'));
    const cleaned = awareness.cleanFollowUp(req.body && req.body.content);
    if (!cleaned.ok) return res.status(400).json(errors.badRequest(cleaned.message));
    const max = awareness.LIMITS.followUps;
    const updated = await JoyNote.findOneAndUpdate(
      // 只认「待投递」：正在投递中的那一刻写后来，投递会把状态留在 answered，不再盖成 delivered
      { _id: id, userId, kind: 'awareness', [`awareness.followUps.${max - 1}`]: { $exists: false } },
      { $push: { 'awareness.followUps': { content: cleaned.value, createdAt: new Date() } } },
      { new: true }
    );
    if (!updated) {
      const exists = await JoyNote.findOne({ _id: id, userId, kind: 'awareness' }).select('_id').lean();
      if (!exists) return res.status(404).json(errors.notFound('记录不存在'));
      return res.status(400).json(errors.badRequest('「后来」已经写满了'));
    }
    await JoyNote.updateOne(
      // delivered 之外：来信送到后再写「后来」，状态标成已回应；投递中的那一刻写的，由投递侧保持 answered
      { _id: id, userId, 'awareness.revisit.status': { $in: ['pending', 'delivering', 'delivered'] } },
      { $set: { 'awareness.revisit.status': 'answered' } }
    );
    const latest = await JoyNote.findOne({ _id: id, userId }).lean();
    return res.status(201).json(success(formatNote(latest), '记下了'));
  } catch (error) {
    return next(error);
  }
}

// 来信里点「先不写」：这条觉察不再回访
async function skipRevisit(req, res, next) {
  try {
    const userId = requestUserId(req);
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json(errors.badRequest('记录参数不正确'));
    const note = await JoyNote.findOne({ _id: id, userId, kind: 'awareness' })
      .select('awareness.revisit')
      .lean();
    if (!note) return res.status(404).json(errors.notFound('记录不存在'));
    const previous = (note.awareness && note.awareness.revisit && note.awareness.revisit.status) || 'none';
    const canSkip = awareness.ACTIVE_REVISIT_STATUSES.includes(previous);
    if (canSkip) {
      await JoyNote.updateOne(
        { _id: id, userId, 'awareness.revisit.status': { $in: awareness.ACTIVE_REVISIT_STATUSES } },
        { $set: { 'awareness.revisit.status': 'skipped' } }
      );
    }
    return res.json(success({ id, status: canSkip ? 'skipped' : previous }));
  } catch (error) {
    return next(error);
  }
}

// 来信页一次读取回访卡片：只返回「择」和回访状态，通知本身不带笔记文字
async function getRevisitCards(req, res, next) {
  try {
    const userId = requestUserId(req);
    const ids = String(req.query?.ids || '').split(',').map(item => item.trim()).filter(Boolean);
    if (!ids.length || ids.length > 10 || !ids.every(isId)) {
      return res.status(400).json(errors.badRequest('记录参数不正确'));
    }
    const notes = await JoyNote.find({ _id: { $in: ids }, userId, kind: 'awareness' })
      .select('createdAt awareness.choice awareness.followUps awareness.revisit')
      .lean();
    return res.json(success({
      list: notes.map(note => {
        const followUps = (note.awareness && note.awareness.followUps) || [];
        const revisit = (note.awareness && note.awareness.revisit) || {};
        return {
          id: note._id,
          createdAt: note.createdAt,
          choice: (note.awareness && note.awareness.choice) || '',
          status: revisit.status || 'none',
          followUpCount: followUps.length,
          lastFollowUp: followUps.length ? followUps[followUps.length - 1].content : ''
        };
      })
    }));
  } catch (error) {
    return next(error);
  }
}

// ============ 管理后台：查看所有书友的随手记与觉察日记 ============

// 管理员列表：跨用户分页查看，支持期次 / 类型 / 用户昵称 / 关键词 / 日期范围筛选
async function adminListJoyNotes(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 50);
    const filter = {};

    const kind = req.query?.kind;
    if (kind && !['joy', 'awareness', 'all'].includes(kind)) {
      return res.status(400).json(errors.badRequest('类型参数不正确'));
    }
    if (kind === 'awareness') filter.kind = 'awareness';
    if (kind === 'joy') filter.kind = { $ne: 'awareness' };

    const periodId = req.query?.periodId;
    if (periodId) {
      if (!isId(periodId)) return res.status(400).json(errors.badRequest('期次参数不正确'));
      filter.periodId = periodId;
    }

    const userId = req.query?.userId;
    if (userId) {
      if (!isId(userId)) return res.status(400).json(errors.badRequest('用户参数不正确'));
      filter.userId = userId;
    }

    // 按用户昵称或 openid 搜索
    const userSearch = typeof req.query?.userSearch === 'string' ? req.query.userSearch.trim().slice(0, MAX_SEARCH_LENGTH) : '';
    if (userSearch) {
      const pattern = { $regex: escapeRegExp(userSearch), $options: 'i' };
      const users = await User.find({ $or: [{ nickname: pattern }, { openid: pattern }] }).select('_id').lean();
      const userIds = users.map(u => u._id);
      if (!userIds.length) {
        return res.json(success({ list: [], total: 0, page, limit }));
      }
      filter.userId = filter.userId ? filter.userId : { $in: userIds };
    }

    // 按内容关键词搜索（标题 + 正文 + 觉察的事实 / 感受备注 / 选择）
    const keyword = typeof req.query?.q === 'string' ? req.query.q.trim().slice(0, MAX_SEARCH_LENGTH) : '';
    if (keyword) {
      const pattern = { $regex: escapeRegExp(keyword), $options: 'i' };
      filter.$or = [
        { title: pattern },
        { content: pattern },
        { 'awareness.facts': pattern },
        { 'awareness.feelingNote': pattern },
        { 'awareness.choice': pattern }
      ];
    }

    // 日期范围
    const dateFrom = req.query?.dateFrom;
    const dateTo = req.query?.dateTo;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (Number.isNaN(from.getTime())) return res.status(400).json(errors.badRequest('开始日期不正确'));
        from.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        if (Number.isNaN(to.getTime())) return res.status(400).json(errors.badRequest('结束日期不正确'));
        to.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = to;
      }
    }

    const [total, rows] = await Promise.all([
      JoyNote.countDocuments(filter),
      JoyNote.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'nickname avatarUrl openid _id')
        .populate('periodId', 'name title startDate _id')
        .populate('sectionId', 'title day _id')
        .lean()
    ]);

    const list = rows.map(row => {
      const formatted = formatNote(row, null, null);
      const user = row.userId && typeof row.userId === 'object' ? row.userId : null;
      const period = row.periodId && typeof row.periodId === 'object' ? row.periodId : null;
      const section = row.sectionId && typeof row.sectionId === 'object' ? row.sectionId : null;
      return {
        ...formatted,
        user: user
          ? { id: String(user._id), nickname: user.nickname || '', avatarUrl: user.avatarUrl || '', openid: user.openid || '' }
          : null,
        period: period ? { id: String(period._id), name: period.name || period.title || '' } : null,
        section: section ? { id: String(section._id), title: section.title || '', day: section.day || null } : null,
        periodName: period ? (period.name || period.title || '') : formatted.periodName,
        sectionTitle: section ? (section.title || '') : formatted.sectionTitle,
        day: section ? (section.day || null) : formatted.day
      };
    });

    return res.json(success({ list, total, page, limit }));
  } catch (error) {
    return next(error);
  }
}

// 管理员删除一条记录：删掉之后书友那边也看不到
async function adminDeleteJoyNote(req, res, next) {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json(errors.badRequest('记录参数不正确'));
    const note = await JoyNote.findById(id).select('_id userId kind').lean();
    if (!note) return res.status(404).json(errors.notFound('这条记录不存在'));
    await JoyNote.deleteOne({ _id: note._id });
    logger.info('[joyNote.adminDelete] 管理员删除随手记/觉察日记', {
      noteId: String(note._id),
      userId: String(note.userId),
      kind: note.kind,
      adminId: req.admin && (req.admin.id || req.admin._id) ? String(req.admin.id || req.admin._id) : null
    });
    return res.json(success({ id: String(note._id), deleted: true }));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getPeriods, getSections, getMine, getOne, create, update, remove, addFollowUp, skipRevisit, getRevisitCards,
  formatAwareness,
  adminListJoyNotes, adminDeleteJoyNote
};
