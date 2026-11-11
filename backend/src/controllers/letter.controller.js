const Letter = require('../models/Letter');
const Period = require('../models/Period');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { ensurePeriodCommunityAccess } = require('../services/community-access.service');
const { computeWriteWindow, computeDeliverAt, daysBetweenKeys } = require('../services/letter-delivery.service');

const MAX_CONTENT = 2000;
const MAX_REPLY = 200;
const STAMPS = ['dawn', 'leaf', 'book'];
const DAY_MS = 24 * 60 * 60 * 1000;

function getRequestUserId(req) {
  return req.user?.id || req.user?.userId || req.user?._id;
}

function isValidId(id) {
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
}

function inWindow(window, now) {
  return !!window && now >= window.from && now <= window.to;
}

function daysUntil(deliverAt, now) {
  if (!deliverAt) return 0;
  return Math.max(0, Math.ceil((deliverAt.getTime() - now.getTime()) / DAY_MS));
}

function buildLetterView(letter, period, now = new Date()) {
  const window = computeWriteWindow(period);
  const deliverAt = computeDeliverAt(period);
  const status = letter ? letter.status : 'none';
  const canWrite = (status === 'none' || status === 'draft') && inWindow(window, now);
  const view = {
    id: letter ? String(letter._id) : null,
    status,
    canWrite,
    writeWindow: window ? { from: window.from, to: window.to } : null,
    deliverAt,
    periodDays: period && period.startDate && period.endDate ? daysBetweenKeys(period.startDate, period.endDate) + 1 : 0,
    daysToDeliver: status === 'sealed' || status === 'draft' || status === 'none' ? daysUntil(deliverAt, now) : 0,
    stamp: letter ? letter.stamp : 'dawn',
    writtenAt: letter ? letter.writtenAt : null,
    openedAt: letter ? letter.openedAt : null,
    reply: letter && letter.reply ? letter.reply : '',
    repliedAt: letter ? letter.repliedAt : null
  };
  if (status === 'draft' || status === 'opened') {
    view.content = letter.content || '';
  }
  return view;
}

async function loadPeriodForUser(req, res, periodId) {
  if (!isValidId(periodId)) {
    res.status(400).json(errors.badRequest('期次参数不正确'));
    return null;
  }
  const userId = getRequestUserId(req);
  if (!(await ensurePeriodCommunityAccess(res, userId, periodId))) return null;
  const period = await Period.findById(periodId).select('_id name startDate endDate').lean();
  if (!period) {
    res.status(404).json(errors.notFound('期次不存在'));
    return null;
  }
  return period;
}

async function getPeriodLetter(req, res, next) {
  try {
    const period = await loadPeriodForUser(req, res, req.params.periodId);
    if (!period) return;
    const letter = await Letter.findOne({ userId: getRequestUserId(req), periodId: period._id });
    return res.json(success(buildLetterView(letter, period)));
  } catch (error) {
    logger.error('getPeriodLetter failed', error);
    return next(error);
  }
}

async function saveDraft(req, res, next) {
  try {
    const period = await loadPeriodForUser(req, res, req.params.periodId);
    if (!period) return;
    const { content, stamp } = req.body || {};
    if (typeof content !== 'string') return res.status(400).json(errors.badRequest('信的内容不能为空'));
    if (content.length > MAX_CONTENT) return res.status(400).json(errors.badRequest(`信最多 ${MAX_CONTENT} 字`));
    const nextStamp = stamp === undefined ? 'dawn' : stamp;
    if (!STAMPS.includes(nextStamp)) return res.status(400).json(errors.badRequest('邮戳样式不正确'));

    const now = new Date();
    if (!inWindow(computeWriteWindow(period), now)) {
      return res.status(400).json(errors.badRequest('这一期的信箱已经关了，下一期开营时再来'));
    }
    const userId = getRequestUserId(req);
    const applyDraft = target => {
      target.content = content;
      target.stamp = nextStamp;
      target.writtenAt = now;
      return target.save();
    };
    let letter = await Letter.findOne({ userId, periodId: period._id });
    if (!letter) {
      try {
        letter = new Letter({ userId, periodId: period._id });
        await applyDraft(letter);
      } catch (error) {
        if (error && error.code !== 11000) throw error;
        // 并发的另一个请求先建好了：重读后按更新处理
        letter = await Letter.findOne({ userId, periodId: period._id });
        if (!letter) throw error;
      }
    }
    if (letter.status !== 'draft') {
      return res.status(400).json(errors.badRequest('信已经投递，不能再修改'));
    }
    if (letter.content !== content || letter.stamp !== nextStamp || !letter.writtenAt) {
      // 条件更新：若期间已被封存则不会覆盖
      const result = await Letter.updateOne(
        { _id: letter._id, status: 'draft' },
        { $set: { content, stamp: nextStamp, writtenAt: now } }
      );
      const matched = result.matchedCount !== undefined ? result.matchedCount : result.n;
      if (!matched) return res.status(400).json(errors.badRequest('信已经投递，不能再修改'));
      letter.content = content;
      letter.stamp = nextStamp;
      letter.writtenAt = now;
    }
    return res.json(success(buildLetterView(letter, period, now), '草稿已保存'));
  } catch (error) {
    logger.error('saveDraft failed', error);
    return next(error);
  }
}

async function sealLetter(req, res, next) {
  try {
    const period = await loadPeriodForUser(req, res, req.params.periodId);
    if (!period) return;
    const now = new Date();
    if (!inWindow(computeWriteWindow(period), now)) {
      return res.status(400).json(errors.badRequest('这一期的信箱已经关了，下一期开营时再来'));
    }
    const letter = await Letter.findOne({ userId: getRequestUserId(req), periodId: period._id });
    if (!letter) return res.status(400).json(errors.badRequest('先写点什么再投递'));
    if (letter.status !== 'draft') return res.status(400).json(errors.badRequest('信已经投递过了'));
    if (!letter.content || !letter.content.trim()) {
      return res.status(400).json(errors.badRequest('先写点什么再投递'));
    }
    letter.status = 'sealed';
    letter.sealedAt = now;
    await letter.save();
    return res.json(success(buildLetterView(letter, period, now), '信已投递'));
  } catch (error) {
    logger.error('sealLetter failed', error);
    return next(error);
  }
}

async function findOwnLetter(req, res) {
  if (!isValidId(req.params.id)) {
    res.status(400).json(errors.badRequest('参数不正确'));
    return null;
  }
  const letter = await Letter.findOne({ _id: req.params.id, userId: getRequestUserId(req) });
  if (!letter) {
    res.status(404).json(errors.notFound('信不存在'));
    return null;
  }
  return letter;
}

async function openLetter(req, res, next) {
  try {
    const letter = await findOwnLetter(req, res);
    if (!letter) return;
    if (letter.status === 'draft' || letter.status === 'sealed') {
      return res.status(403).json(errors.forbidden('信还在路上，到结营那天才能打开'));
    }
    if (letter.status === 'delivered') {
      letter.status = 'opened';
      letter.openedAt = new Date();
      await letter.save();
    }
    const period = await Period.findById(letter.periodId).select('_id startDate endDate').lean();
    return res.json(success(buildLetterView(letter, period)));
  } catch (error) {
    logger.error('openLetter failed', error);
    return next(error);
  }
}

async function replyLetter(req, res, next) {
  try {
    const letter = await findOwnLetter(req, res);
    if (!letter) return;
    if (letter.status !== 'opened') return res.status(400).json(errors.badRequest('拆开信之后才能回一句话'));
    if (letter.repliedAt) return res.status(400).json(errors.badRequest('已经回过了'));
    const reply = typeof req.body?.reply === 'string' ? req.body.reply.trim() : '';
    if (!reply) return res.status(400).json(errors.badRequest('回信不能为空'));
    if (reply.length > MAX_REPLY) return res.status(400).json(errors.badRequest(`回信最多 ${MAX_REPLY} 字`));
    letter.reply = reply;
    letter.repliedAt = new Date();
    await letter.save();
    const period = await Period.findById(letter.periodId).select('_id startDate endDate').lean();
    return res.json(success(buildLetterView(letter, period), '回信已收好'));
  } catch (error) {
    logger.error('replyLetter failed', error);
    return next(error);
  }
}

async function getMyLetters(req, res, next) {
  try {
    const letters = await Letter.find({ userId: getRequestUserId(req) }).sort({ createdAt: -1 }).lean();
    const periods = await Period.find({ _id: { $in: letters.map(l => l.periodId) } })
      .select('_id name startDate endDate')
      .lean();
    const periodMap = new Map(periods.map(p => [String(p._id), p]));
    const list = letters.map(letter => {
      const period = periodMap.get(String(letter.periodId));
      const item = {
        id: String(letter._id),
        periodId: String(letter.periodId),
        periodName: period ? period.name : '',
        status: letter.status,
        stamp: letter.stamp,
        writtenAt: letter.writtenAt,
        deliverAt: computeDeliverAt(period),
        openedAt: letter.openedAt,
        reply: letter.status === 'opened' ? letter.reply || '' : ''
      };
      if (letter.status === 'opened') item.content = letter.content;
      return item;
    });
    return res.json(success({ list }));
  } catch (error) {
    logger.error('getMyLetters failed', error);
    return next(error);
  }
}

module.exports = {
  getPeriodLetter,
  saveDraft,
  sealLetter,
  openLetter,
  replyLetter,
  getMyLetters,
  buildLetterView
};
