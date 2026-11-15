const mongoose = require('mongoose');
const JoyNote = require('../models/JoyNote');
const Period = require('../models/Period');
const Section = require('../models/Section');
const { getCommunityAccessiblePeriodIds } = require('../services/community-access.service');
const { findEffectiveEnrollment, getPeriodAccessState } = require('../services/period-access.service');
const { success, errors } = require('../utils/response');

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

function formatNote(note, periodMap = null, sectionMap = null) {
  const period = note.periodId && periodMap ? periodMap.get(String(note.periodId)) : null;
  const section = note.sectionId && sectionMap ? sectionMap.get(String(note.sectionId)) : null;
  const sectionVisible = section && period && sameId(section.periodId, period._id);
  return {
    id: note._id,
    _id: note._id,
    content: note.content,
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

async function getMine(req, res, next) {
  try {
    const userId = requestUserId(req);
    const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 50);
    const periodId = req.query?.periodId;
    if (periodId && !isId(periodId)) return res.status(400).json(errors.badRequest('期次参数不正确'));
    const filter = { userId };
    if (periodId) filter.periodId = periodId;
    // 按关键词搜自己的记录（只搜内容，不区分大小写）
    const keyword = typeof req.query?.q === 'string' ? req.query.q.trim().slice(0, MAX_SEARCH_LENGTH) : '';
    if (keyword) filter.content = { $regex: escapeRegExp(keyword), $options: 'i' };
    const [total, rows] = await Promise.all([
      JoyNote.countDocuments(filter),
      JoyNote.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean()
    ]);
    // 这一页里没有任何记录关联了期次时，不用再去查有权限的期次（少几次查询）
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
    const { content, periodId: rawPeriodId, sectionId: rawSectionId } = req.body || {};
    if (!validContent(content)) {
      return res.status(400).json(errors.badRequest(`请填写不超过 ${MAX_CONTENT_LENGTH} 字的内容`));
    }
    const periodId = rawPeriodId || null;
    const sectionId = rawSectionId || null;
    const associationError = await validateAssociation(userId, periodId, sectionId);
    if (associationError) return rejectAssociation(res, associationError);
    const note = await JoyNote.create({ userId, content: content.trim(), periodId, sectionId });
    return res.status(201).json(success(formatNote(note), '记下来了'));
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
    if (!validContent(body.content)) {
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
    note.content = body.content.trim();
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
    return res.json(success({ id }, '已删除'));
  } catch (error) {
    return next(error);
  }
}

module.exports = { getPeriods, getSections, getMine, create, update, remove };
