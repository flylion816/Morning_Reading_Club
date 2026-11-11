const mongoose = require('mongoose');
const SeenCard = require('../models/SeenCard');
const Checkin = require('../models/Checkin');
const User = require('../models/User');
const Section = require('../models/Section');
const Period = require('../models/Period');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { dispatchNotificationWithSubscribe } = require('../services/user-notification.service');
const { ensurePeriodCommunityAccess } = require('../services/community-access.service');
const { buildCourseDetailTargetPage } = require('../utils/notification-links');
const { SEEN_PHRASES, SEEN_PHRASE_KEYS, isValidSeenPhrase } = require('../constants/seenPhrases');

const MAX_SUMMARY_IDS = 50;
const RECENT_LIMIT = 5;

function getRequestUserId(req) {
  const id = req.user?.id || req.user?.userId || req.user?._id;
  return id ? String(id) : '';
}

function isAdminUser(req) {
  return ['admin', 'super_admin', 'superadmin'].includes(req.user?.role);
}

function idOf(value) {
  if (!value) return '';
  return String(value._id || value);
}

// 找到打卡并校验：存在、期次社群权限、可见性。失败时已写入响应并返回 null。
async function loadVisibleCheckin(
  req,
  res,
  { requireAccessForOwner = true, adminSeesPrivate = true } = {}
) {
  const { checkinId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(checkinId)) {
    res.status(400).json(errors.badRequest('打卡记录 ID 无效'));
    return null;
  }

  const checkin = await Checkin.findById(checkinId);
  if (!checkin) {
    res.status(404).json(errors.notFound('打卡记录不存在'));
    return null;
  }

  const userId = getRequestUserId(req);
  const isOwner = idOf(checkin.userId) === userId;

  if (requireAccessForOwner || !isOwner) {
    const hasAccess = await ensurePeriodCommunityAccess(res, userId, checkin.periodId);
    if (!hasAccess) return null;
  }

  if (checkin.isPublic === false && !isOwner && !(adminSeesPrivate && isAdminUser(req))) {
    res.status(403).json(errors.forbidden('这篇打卡不对外公开'));
    return null;
  }

  return checkin;
}

async function loadUserMap(userIds) {
  const ids = [...new Set(userIds.map(idOf).filter(Boolean))];
  if (!ids.length) return new Map();
  const users = await User.find({ _id: { $in: ids } })
    .select('nickname avatar avatarUrl')
    .lean();
  return new Map(users.map(u => [idOf(u), u]));
}

// 新建或更新自己送的看见卡
async function sendSeen(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const phrase = req.body?.phrase;
    if (!isValidSeenPhrase(phrase)) {
      return res.status(400).json(errors.badRequest('请选择一句看见卡短句'));
    }

    const checkin = await loadVisibleCheckin(req, res, { adminSeesPrivate: false });
    if (!checkin) return;

    const ownerId = idOf(checkin.userId);
    if (ownerId === userId) {
      return res.status(400).json(errors.badRequest('不能给自己的打卡送看见卡'));
    }

    let card = await SeenCard.findOne({ checkinId: checkin._id, userId });
    let created = false;

    if (card) {
      // 已有记录（含已撤回）：更新短句并清掉撤回标记，不重复通知
      card.phrase = phrase;
      card.withdrawnAt = null;
      await card.save();
    } else {
      try {
        card = await SeenCard.create({
          checkinId: checkin._id,
          userId,
          receiverId: ownerId,
          periodId: checkin.periodId || null,
          sectionId: checkin.sectionId || null,
          phrase
        });
        created = true;
      } catch (error) {
        if (error && error.code === 11000) {
          // 并发重复提交：按更新处理
          card = await SeenCard.findOne({ checkinId: checkin._id, userId });
          if (card) {
            card.phrase = phrase;
            card.withdrawnAt = null;
            await card.save();
          }
        } else {
          throw error;
        }
      }
    }

    if (created) {
      try {
        const actor = await User.findById(userId).select('nickname avatar avatarUrl').lean();
        const nickname = actor?.nickname || '有人';
        await dispatchNotificationWithSubscribe(req, {
          recipientUserId: ownerId,
          notificationType: 'seen_received',
          title: '有书友看见了你',
          content: `${nickname}：${SEEN_PHRASES[phrase]}`,
          targetPage: buildCourseDetailTargetPage(checkin.sectionId, {
            focus: 'comments',
            checkinId: checkin._id
          }),
          senderId: userId,
          data: {
            senderName: actor?.nickname,
            senderAvatar: actor?.avatarUrl || '',
            sectionId: idOf(checkin.sectionId),
            checkinId: idOf(checkin._id),
            commentId: null,
            replyId: null,
            phrase
          },
          sourceType: 'seen_card',
          sourceId: card?._id
        });
      } catch (notifyError) {
        logger.warn('看见卡通知发送失败', {
          message: notifyError.message,
          checkinId: idOf(checkin._id)
        });
      }
    }

    res.json(success({ checkinId: idOf(checkin._id), phrase, created }, created ? '已送出' : '已更新'));
  } catch (error) {
    next(error);
  }
}

// 撤回自己送的看见卡（幂等）
async function withdrawSeen(req, res, next) {
  try {
    const { checkinId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(checkinId)) {
      return res.status(400).json(errors.badRequest('打卡记录 ID 无效'));
    }
    const userId = getRequestUserId(req);
    await SeenCard.findOneAndUpdate(
      { checkinId, userId, withdrawnAt: null },
      { $set: { withdrawnAt: new Date() } }
    );
    res.json(success({ checkinId, mine: null }, '已撤回'));
  } catch (error) {
    next(error);
  }
}

// 某篇打卡收到的看见卡汇总
async function getCheckinSeen(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const checkin = await loadVisibleCheckin(req, res, { requireAccessForOwner: false });
    if (!checkin) return;

    const cards = await SeenCard.find({ checkinId: checkin._id, withdrawnAt: null })
      .select('userId phrase createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const counts = {};
    SEEN_PHRASE_KEYS.forEach(key => {
      counts[key] = 0;
    });
    let mine = null;
    cards.forEach(card => {
      if (counts[card.phrase] !== undefined) counts[card.phrase] += 1;
      if (idOf(card.userId) === userId) mine = card.phrase;
    });

    const recentCards = cards.slice(0, RECENT_LIMIT);
    const userMap = await loadUserMap(recentCards.map(c => c.userId));
    const recent = recentCards.map(card => {
      const user = userMap.get(idOf(card.userId));
      return {
        userId: idOf(card.userId),
        nickname: user?.nickname || '书友',
        avatarUrl: user?.avatarUrl || '',
        phrase: card.phrase
      };
    });

    res.json(success({ total: cards.length, counts, mine, recent }));
  } catch (error) {
    next(error);
  }
}

// 批量汇总：供打卡列表使用
async function getSeenSummary(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const raw = req.body?.checkinIds;
    if (!Array.isArray(raw)) {
      return res.status(400).json(errors.badRequest('checkinIds 必须是数组'));
    }
    const checkinIds = [...new Set(raw.map(String))];
    if (checkinIds.length > MAX_SUMMARY_IDS) {
      return res.status(400).json(errors.badRequest(`一次最多查询 ${MAX_SUMMARY_IDS} 篇打卡`));
    }
    if (checkinIds.some(id => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json(errors.badRequest('checkinIds 含无效 ID'));
    }

    const result = {};
    checkinIds.forEach(id => {
      result[id] = { total: 0, mine: null };
    });

    if (checkinIds.length) {
      // 只对公开或本人的打卡返回真实数量，其余保持 0
      const checkins = await Checkin.find({ _id: { $in: checkinIds } })
        .select('userId isPublic')
        .lean();
      const visibleIds = checkins
        .filter(c => c.isPublic !== false || idOf(c.userId) === userId)
        .map(c => idOf(c._id));
      const cards = visibleIds.length
        ? await SeenCard.find({ checkinId: { $in: visibleIds }, withdrawnAt: null })
            .select('checkinId userId phrase')
            .lean()
        : [];
      cards.forEach(card => {
        const entry = result[idOf(card.checkinId)];
        if (!entry) return;
        entry.total += 1;
        if (idOf(card.userId) === userId) entry.mine = card.phrase;
      });
    }

    res.json(success(result));
  } catch (error) {
    next(error);
  }
}

// 本人收到的看见卡
async function getReceivedSeen(req, res, next) {
  try {
    const userId = getRequestUserId(req);
    const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 50);

    const [cards, total] = await Promise.all([
      SeenCard.find({ receiverId: userId, withdrawnAt: null })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SeenCard.countDocuments({ receiverId: userId, withdrawnAt: null })
    ]);

    const [userMap, sections, periods] = await Promise.all([
      loadUserMap(cards.map(c => c.userId)),
      cards.length
        ? Section.find({ _id: { $in: cards.map(c => c.sectionId).filter(Boolean) } })
            .select('title')
            .lean()
        : [],
      cards.length
        ? Period.find({ _id: { $in: cards.map(c => c.periodId).filter(Boolean) } })
            .select('name title')
            .lean()
        : []
    ]);
    const sectionMap = new Map(sections.map(s => [idOf(s), s]));
    const periodMap = new Map(periods.map(p => [idOf(p), p]));

    const list = cards.map(card => {
      const user = userMap.get(idOf(card.userId));
      const period = periodMap.get(idOf(card.periodId));
      return {
        id: idOf(card._id),
        checkinId: idOf(card.checkinId),
        sectionId: idOf(card.sectionId),
        periodId: idOf(card.periodId),
        userId: idOf(card.userId),
        nickname: user?.nickname || '书友',
        avatarUrl: user?.avatarUrl || '',
        phrase: card.phrase,
        courseTitle: sectionMap.get(idOf(card.sectionId))?.title || '',
        periodName: period?.name || period?.title || '',
        createdAt: card.createdAt
      };
    });

    res.json(success({ list, total, page, limit }));
  } catch (error) {
    next(error);
  }
}

module.exports = { sendSeen, withdrawSeen, getCheckinSeen, getSeenSummary, getReceivedSeen };
