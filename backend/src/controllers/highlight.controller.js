const mongoose = require('mongoose');
const Highlight = require('../models/Highlight');
const Section = require('../models/Section');
const Period = require('../models/Period');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { ensurePeriodCommunityAccess } = require('../services/community-access.service');
const { normalizeText, hashText } = require('../utils/text-hash');

const MAX_TEXT_LENGTH = 500;
const MAX_NOTE_LENGTH = 200;
const POPULAR_MIN_READERS = 3;

function getRequestUserId(req) {
  return req.user?.id || req.user?.userId || req.user?._id;
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizeNote(note) {
  return typeof note === 'string' ? note.trim() : '';
}

function formatHighlight(doc) {
  return {
    _id: doc._id,
    id: doc._id,
    periodId: doc.periodId,
    sectionId: doc.sectionId,
    text: doc.text,
    textHash: doc.textHash,
    note: doc.note || '',
    createdAt: doc.createdAt
  };
}

async function createHighlight(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const { sectionId } = req.body || {};
    const text = normalizeText(req.body?.text);
    const note = normalizeNote(req.body?.note);

    if (!isValidId(sectionId)) return res.status(400).json(errors.badRequest('课程参数不正确'));
    if (!text) return res.status(400).json(errors.badRequest('请选择要摘下的句子'));
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json(errors.badRequest(`一次最多摘 ${MAX_TEXT_LENGTH} 个字`));
    }
    if (note.length > MAX_NOTE_LENGTH) {
      return res.status(400).json(errors.badRequest(`感想最多 ${MAX_NOTE_LENGTH} 个字`));
    }

    const section = await Section.findById(sectionId).select('periodId').lean();
    if (!section) return res.status(404).json(errors.notFound('课程不存在'));

    const hasAccess = await ensurePeriodCommunityAccess(res, userId, section.periodId);
    if (!hasAccess) return undefined;

    const textHash = hashText(text);
    const existing = await Highlight.findOne({ userId, sectionId, textHash }).lean();
    if (existing) return res.json(success(formatHighlight(existing), '已在你的摘抄本里'));

    try {
      const created = await Highlight.create({
        userId,
        periodId: section.periodId,
        sectionId,
        text,
        textHash,
        note
      });
      return res.json(success(formatHighlight(created), '已摘下'));
    } catch (error) {
      if (error && error.code === 11000) {
        const duplicated = await Highlight.findOne({ userId, sectionId, textHash }).lean();
        if (duplicated) return res.json(success(formatHighlight(duplicated), '已在你的摘抄本里'));
      }
      throw error;
    }
  } catch (error) {
    logger.error('createHighlight failed:', error);
    return next(error);
  }
}

async function updateHighlightNote(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json(errors.badRequest('摘抄参数不正确'));

    const note = normalizeNote(req.body?.note);
    if (note.length > MAX_NOTE_LENGTH) {
      return res.status(400).json(errors.badRequest(`感想最多 ${MAX_NOTE_LENGTH} 个字`));
    }

    const highlight = await Highlight.findOne({ _id: id, userId });
    if (!highlight) return res.status(404).json(errors.notFound('摘抄不存在'));

    highlight.note = note;
    await highlight.save();
    return res.json(success(formatHighlight(highlight), '已保存'));
  } catch (error) {
    logger.error('updateHighlightNote failed:', error);
    return next(error);
  }
}

async function deleteHighlight(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json(errors.badRequest('摘抄参数不正确'));

    const highlight = await Highlight.findOne({ _id: id, userId }).select('_id').lean();
    if (!highlight) return res.status(404).json(errors.notFound('摘抄不存在'));

    await Highlight.deleteOne({ _id: id, userId });
    return res.json(success({ id }, '已删除'));
  } catch (error) {
    logger.error('deleteHighlight failed:', error);
    return next(error);
  }
}

async function getMyHighlights(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 50);
    const periodId = req.query?.periodId;
    if (periodId && !isValidId(periodId)) {
      return res.status(400).json(errors.badRequest('期次参数不正确'));
    }

    // 期次筛选需要本人全部摘抄的期次分布，这里只取 periodId 在内存里计数
    const allPeriodRows = await Highlight.find({ userId }).select('periodId').lean();
    const countByPeriod = new Map();
    allPeriodRows.forEach(row => {
      const key = String(row.periodId);
      countByPeriod.set(key, (countByPeriod.get(key) || 0) + 1);
    });

    const filter = { userId };
    if (periodId) filter.periodId = periodId;

    const total = periodId
      ? countByPeriod.get(String(periodId)) || 0
      : allPeriodRows.length;

    const rows = await Highlight.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const sectionIds = [...new Set(rows.map(row => String(row.sectionId)))];
    const periodIds = [...countByPeriod.keys()];
    const [sections, periods] = await Promise.all([
      sectionIds.length ? Section.find({ _id: { $in: sectionIds } }).select('title day').lean() : [],
      periodIds.length ? Period.find({ _id: { $in: periodIds } }).select('name title').lean() : []
    ]);
    const sectionMap = new Map(sections.map(item => [String(item._id), item]));
    const periodMap = new Map(periods.map(item => [String(item._id), item]));

    const list = rows.map(row => {
      const section = sectionMap.get(String(row.sectionId)) || {};
      const period = periodMap.get(String(row.periodId)) || {};
      return {
        ...formatHighlight(row),
        sectionTitle: section.title || '',
        day: section.day || null,
        periodName: period.name || period.title || ''
      };
    });

    const periodList = periodIds.map(id => {
      const period = periodMap.get(id) || {};
      return { id, name: period.name || period.title || '', count: countByPeriod.get(id) };
    });

    return res.json(success({ list, total, page, limit, periods: periodList }));
  } catch (error) {
    logger.error('getMyHighlights failed:', error);
    return next(error);
  }
}

async function getSectionPopular(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const { sectionId } = req.params;
    if (!isValidId(sectionId)) return res.status(400).json(errors.badRequest('课程参数不正确'));

    const section = await Section.findById(sectionId).select('periodId').lean();
    if (!section) return res.status(404).json(errors.notFound('课程不存在'));

    const hasAccess = await ensurePeriodCommunityAccess(res, userId, section.periodId);
    if (!hasAccess) return undefined;

    const rows = await Highlight.find({ sectionId }).select('userId textHash').lean();
    const readersByHash = new Map();
    const mine = new Set();
    rows.forEach(row => {
      if (!readersByHash.has(row.textHash)) readersByHash.set(row.textHash, new Set());
      readersByHash.get(row.textHash).add(String(row.userId));
      if (String(row.userId) === String(userId)) mine.add(row.textHash);
    });

    const popular = [];
    readersByHash.forEach((readers, textHash) => {
      if (readers.size >= POPULAR_MIN_READERS) popular.push({ textHash, count: readers.size });
    });
    popular.sort((a, b) => b.count - a.count);

    return res.json(success({ popular, mine: [...mine] }));
  } catch (error) {
    logger.error('getSectionPopular failed:', error);
    return next(error);
  }
}

module.exports = {
  createHighlight,
  updateHighlightNote,
  deleteHighlight,
  getMyHighlights,
  getSectionPopular
};
