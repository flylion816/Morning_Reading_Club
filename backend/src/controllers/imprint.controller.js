const Imprint = require('../models/Imprint');
const ImprintReaction = require('../models/ImprintReaction');
const ImprintComment = require('../models/ImprintComment');
const ImprintActivityType = require('../models/ImprintActivityType');
const User = require('../models/User');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { dispatchNotificationWithSubscribe } = require('../services/user-notification.service');
const { formatNotificationTime, truncateText } = require('../utils/notification-links');

const FALLBACK_ACTIVITY_TYPES = ['reading', 'cooking', 'tea', 'walk', 'create', 'other'];

const REACTION_LABELS = { gonming: '共鸣', ran: '燃', xiangqu: '想去' };

async function notifyReactionReceived(req, { imprintId, imprintTitle, authorId, senderId, senderName, reactionType }) {
  if (authorId.toString() === senderId.toString()) return;
  const label = REACTION_LABELS[reactionType] || reactionType;
  try {
    await dispatchNotificationWithSubscribe(req, {
      recipientUserId: authorId,
      notificationType: 'like_received',
      title: '有人对你的印记共鸣',
      content: `${senderName} 对你的印记「${truncateText(imprintTitle, 20)}」点了${label}`,
      scene: 'like_received',
      targetPage: `pages/zaichang/detail/detail?id=${imprintId}`,
      senderId,
      data: { senderName },
      subscribeFields: { likeUser: senderName, likeTime: formatNotificationTime() },
      sourceType: 'imprint',
      sourceId: imprintId.toString()
    });
  } catch (e) {
    logger.warn('[imprint.notifyReaction]', { message: e.message });
  }
}

async function notifyCommentReceived(req, { imprintId, imprintTitle, authorId, senderId, senderName, content }) {
  if (authorId.toString() === senderId.toString()) return;
  try {
    await dispatchNotificationWithSubscribe(req, {
      recipientUserId: authorId,
      notificationType: 'comment_received',
      title: '有人评论了你的印记',
      content: `${senderName} 评论了你的印记「${truncateText(imprintTitle, 20)}」：${truncateText(content, 30)}`,
      scene: 'comment_received',
      targetPage: `pages/zaichang/detail/detail?id=${imprintId}`,
      senderId,
      data: { senderName },
      subscribeFields: {
        replyUser: senderName,
        replyTopic: truncateText(imprintTitle, 20),
        replyContent: truncateText(content, 30),
        replyTime: formatNotificationTime()
      },
      sourceType: 'imprint',
      sourceId: imprintId.toString()
    });
  } catch (e) {
    logger.warn('[imprint.notifyComment]', { message: e.message });
  }
}

async function notifyAttendeeMentioned(req, { imprintId, imprintTitle, recipientUserId, senderId, senderName }) {
  if (recipientUserId.toString() === senderId.toString()) return;
  try {
    await dispatchNotificationWithSubscribe(req, {
      recipientUserId,
      notificationType: 'imprint_mentioned',
      title: '你被提及在一条印记里',
      content: `${senderName} 在印记「${truncateText(imprintTitle, 20)}」里提到了你`,
      scene: 'comment_received',
      targetPage: `pages/zaichang/detail/detail?id=${imprintId}`,
      senderId,
      data: { senderName },
      subscribeFields: {
        replyUser: senderName,
        replyTopic: truncateText(imprintTitle, 20),
        replyContent: '你在场了这次聚会',
        replyTime: formatNotificationTime()
      },
      sourceType: 'imprint',
      sourceId: imprintId.toString()
    });
  } catch (e) {
    logger.warn('[imprint.notifyMentioned]', { message: e.message });
  }
}

async function isValidActivityType(key) {
  const count = await ImprintActivityType.countDocuments({ key, isActive: true });
  if (count > 0) return true;
  return FALLBACK_ACTIVITY_TYPES.includes(key);
}

function getUserId(req) {
  return req.user._id || req.user.userId || req.user.id;
}

async function list(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(20, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const { activityType, periodId, startDate, endDate } = req.query;

    const filter = {};
    if (activityType) filter.activityType = activityType;
    if (periodId) filter.periodId = periodId;
    if (startDate || endDate) {
      filter.happenedAt = {};
      if (startDate) filter.happenedAt.$gte = new Date(startDate);
      if (endDate) filter.happenedAt.$lte = new Date(endDate);
    }

    const [list, total] = await Promise.all([
      Imprint.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate('authorId', 'nickname avatarUrl _id')
        .populate('attendees.userId', 'nickname avatarUrl _id')
        .lean(),
      Imprint.countDocuments(filter)
    ]);

    const userId = getUserId(req);
    const imprintIds = list.map((i) => i._id);
    const reactions = await ImprintReaction.find({
      imprintId: { $in: imprintIds },
      userId
    }).lean();

    const myReactions = {};
    for (const r of reactions) {
      myReactions[r.imprintId.toString()] = r.type;
    }

    const normalized = list.map(item => ({
      ...item,
      author: item.authorId,
      authorId: item.authorId?._id,
      attendees: (item.attendees || []).map(a => ({
        ...a,
        avatarUrl: (a.userId && a.userId.avatarUrl) || a.avatarUrl || '',
        name: a.name || (a.userId && a.userId.nickname) || '',
        userId: a.userId?._id || a.userId
      }))
    }));

    res.json(success({ list: normalized, total, page, pageSize, myReactions }));
  } catch (err) {
    logger.error('[imprint.list]', { error: err.message });
    res.status(500).json(errors.serverError());
  }
}

async function create(req, res) {
  try {
    const { title, activityType, mediaList, description, location, attendees, periodId, happenedAt } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json(errors.badRequest('标题不能为空'));
    }
    if (title.length > 30) {
      return res.status(400).json(errors.badRequest('标题不能超过30字'));
    }
    if (!activityType || !(await isValidActivityType(activityType))) {
      return res.status(400).json(errors.badRequest('活动类型无效'));
    }
    if (!Array.isArray(mediaList) || mediaList.length === 0) {
      return res.status(400).json(errors.badRequest('至少需要一张图片'));
    }

    const authorId = getUserId(req);
    const imprint = await Imprint.create({
      authorId,
      title: title.trim(),
      activityType,
      mediaList,
      description: description || '',
      location: location || '',
      attendees: attendees || [],
      periodId: periodId || null,
      happenedAt: happenedAt ? new Date(happenedAt) : new Date()
    });

    res.status(201).json(success(imprint));

    const senderName = req.user.nickname || req.user.name || '书友';
    const registeredAttendees = (attendees || []).filter(
      a => a.userId && a.userId.toString() !== authorId.toString()
    );
    for (const att of registeredAttendees) {
      notifyAttendeeMentioned(req, {
        imprintId: imprint._id,
        imprintTitle: imprint.title,
        recipientUserId: att.userId,
        senderId: authorId,
        senderName
      });
    }
  } catch (err) {
    logger.error('[imprint.create]', { error: err.message });
    res.status(500).json(errors.serverError());
  }
}

async function detail(req, res) {
  try {
    const { id } = req.params;
    const imprint = await Imprint.findById(id)
      .populate('authorId', 'nickname avatarUrl _id')
      .populate('attendees.userId', 'nickname avatarUrl _id')
      .lean();

    if (!imprint) {
      return res.status(404).json(errors.notFound('印记不存在'));
    }

    const userId = getUserId(req);
    const myReaction = await ImprintReaction.findOne({ imprintId: id, userId }).lean();

    const normalized = {
      ...imprint,
      author: imprint.authorId,
      authorId: imprint.authorId?._id,
      attendees: (imprint.attendees || []).map(a => ({
        ...a,
        avatarUrl: (a.userId && a.userId.avatarUrl) || a.avatarUrl || '',
        name: a.name || (a.userId && a.userId.nickname) || '',
        userId: a.userId?._id || a.userId
      }))
    };

    res.json(success({ imprint: normalized, myReaction: myReaction ? myReaction.type : null }));
  } catch (err) {
    logger.error('[imprint.detail]', { error: err.message });
    res.status(500).json(errors.serverError());
  }
}

async function update(req, res) {
  try {
    const { id } = req.params;
    const imprint = await Imprint.findById(id).lean();

    if (!imprint) {
      return res.status(404).json(errors.notFound('印记不存在'));
    }

    const userId = getUserId(req);
    if (imprint.authorId.toString() !== userId.toString()) {
      return res.status(403).json(errors.forbidden('无权修改此印记'));
    }

    const { title, description, activityType, location, attendees, periodId, mediaList } = req.body;
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (activityType !== undefined) updateData.activityType = activityType;
    if (location !== undefined) updateData.location = location;
    if (attendees !== undefined) updateData.attendees = attendees;
    if (periodId !== undefined) updateData.periodId = periodId;
    if (mediaList !== undefined) updateData.mediaList = mediaList;

    const updated = await Imprint.findByIdAndUpdate(id, updateData, { new: true }).lean();
    res.json(success(updated));
  } catch (err) {
    logger.error('[imprint.update]', { error: err.message });
    res.status(500).json(errors.serverError());
  }
}

async function remove(req, res) {
  try {
    const { id } = req.params;
    const imprint = await Imprint.findById(id).lean();

    if (!imprint) {
      return res.status(404).json(errors.notFound('印记不存在'));
    }

    const userId = getUserId(req);
    if (imprint.authorId.toString() !== userId.toString()) {
      return res.status(403).json(errors.forbidden('无权删除此印记'));
    }

    await Imprint.findByIdAndDelete(id);
    res.json(success({ message: '删除成功' }));
  } catch (err) {
    logger.error('[imprint.remove]', { error: err.message });
    res.status(500).json(errors.serverError());
  }
}

async function attend(req, res) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const imprint = await Imprint.findById(id).lean();
    if (!imprint) {
      return res.status(404).json(errors.notFound('印记不存在'));
    }

    const alreadyAttending = imprint.attendees.some(
      (a) => a.userId && a.userId.toString() === userId.toString()
    );
    if (alreadyAttending) {
      return res.status(400).json(errors.badRequest('已在场'));
    }

    // 从数据库实时查 nickname，避免 token 里的用户信息过期导致存入 '用户'
    const freshUser = await User.findById(userId).select('nickname name').lean();
    const attendeeName = (freshUser && (freshUser.nickname || freshUser.name))
      || req.user.nickname || req.user.name || '';

    const updated = await Imprint.findByIdAndUpdate(
      id,
      {
        $push: {
          attendees: {
            userId,
            name: attendeeName,
            isRegistered: true,
            addedBy: 'self'
          }
        }
      },
      { new: true }
    ).lean();

    res.json(success(updated));
  } catch (err) {
    logger.error('[imprint.attend]', { error: err.message });
    res.status(500).json(errors.serverError());
  }
}

async function cancelAttend(req, res) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    await Imprint.findByIdAndUpdate(id, {
      $pull: { attendees: { userId } }
    });

    res.json(success({ message: '已取消在场' }));
  } catch (err) {
    logger.error('[imprint.cancelAttend]', { error: err.message });
    res.status(500).json(errors.serverError());
  }
}

async function react(req, res) {
  try {
    const { id } = req.params;
    const { type } = req.body;
    const userId = getUserId(req);

    if (!['gonming', 'ran', 'xiangqu'].includes(type)) {
      return res.status(400).json(errors.badRequest('无效的共鸣类型'));
    }

    const imprint = await Imprint.findById(id).lean();
    if (!imprint) {
      return res.status(404).json(errors.notFound('印记不存在'));
    }

    const existing = await ImprintReaction.findOne({ imprintId: id, userId });
    let isNewReaction = false;
    if (!existing) {
      try {
        await ImprintReaction.create({ imprintId: id, userId, type });
        await Imprint.findByIdAndUpdate(id, { $inc: { [`reactionCounts.${type}`]: 1 } });
        isNewReaction = true;
      } catch (err) {
        if (err.code === 11000) {
          return res.json(success({ message: '已共鸣' }));
        }
        throw err;
      }
    } else if (existing.type === type) {
      return res.json(success({ message: '已共鸣' }));
    } else {
      const oldType = existing.type;
      existing.type = type;
      await existing.save();
      await Imprint.findByIdAndUpdate(id, {
        $inc: { [`reactionCounts.${oldType}`]: -1, [`reactionCounts.${type}`]: 1 }
      });
    }

    res.json(success({ message: '共鸣成功' }));

    if (isNewReaction) {
      const senderName = req.user.nickname || req.user.name || '书友';
      notifyReactionReceived(req, {
        imprintId: id,
        imprintTitle: imprint.title,
        authorId: imprint.authorId,
        senderId: userId,
        senderName,
        reactionType: type
      });
    }
  } catch (err) {
    logger.error('[imprint.react]', { error: err.message });
    res.status(500).json(errors.serverError());
  }
}

async function cancelReaction(req, res) {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    const reaction = await ImprintReaction.findOneAndDelete({ imprintId: id, userId });
    if (reaction) {
      const imprint = await Imprint.findById(id).lean();
      if (imprint) {
        const currentCount = (imprint.reactionCounts && imprint.reactionCounts[reaction.type]) || 0;
        const newCount = Math.max(0, currentCount - 1);
        await Imprint.findByIdAndUpdate(id, {
          $set: { [`reactionCounts.${reaction.type}`]: newCount }
        });
      }
    }

    res.json(success({ message: '已取消共鸣' }));
  } catch (err) {
    logger.error('[imprint.cancelReaction]', { error: err.message });
    res.status(500).json(errors.serverError());
  }
}

async function listComments(req, res) {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));

    const [list, total] = await Promise.all([
      ImprintComment.find({ imprintId: id })
        .sort({ createdAt: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate('authorId', 'nickname avatarUrl _id')
        .populate('replyToUserId', 'nickname _id')
        .lean(),
      ImprintComment.countDocuments({ imprintId: id })
    ]);

    const normalized = list.map(c => ({
      ...c,
      author: c.authorId,
      authorId: c.authorId?._id,
      replyToUser: c.replyToUserId,
      replyToUserId: c.replyToUserId?._id
    }));

    res.json(success({ list: normalized, total, page, pageSize }));
  } catch (err) {
    logger.error('[imprint.listComments]', { error: err.message });
    res.status(500).json(errors.serverError());
  }
}

async function createComment(req, res) {
  try {
    const { id } = req.params;
    const { content, parentId, replyToUserId } = req.body;
    const authorId = getUserId(req);

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json(errors.badRequest('评论内容不能为空'));
    }
    if (content.length > 500) {
      return res.status(400).json(errors.badRequest('评论内容不能超过500字'));
    }

    const imprint = await Imprint.findById(id).lean();
    if (!imprint) {
      return res.status(404).json(errors.notFound('印记不存在'));
    }

    if (parentId) {
      const parent = await ImprintComment.findById(parentId).lean();
      if (!parent) {
        return res.status(400).json(errors.badRequest('父评论不存在'));
      }
    }

    const comment = await ImprintComment.create({
      imprintId: id,
      authorId,
      content: content.trim(),
      parentId: parentId || null,
      replyToUserId: replyToUserId || null
    });

    await Imprint.findByIdAndUpdate(id, { $inc: { commentCount: 1 } });

    res.status(201).json(success(comment));

    const senderName = req.user.nickname || req.user.name || '书友';
    notifyCommentReceived(req, {
      imprintId: id,
      imprintTitle: imprint.title,
      authorId: imprint.authorId,
      senderId: authorId,
      senderName,
      content: content.trim()
    });
  } catch (err) {
    logger.error('[imprint.createComment]', { error: err.message });
    res.status(500).json(errors.serverError());
  }
}

async function deleteComment(req, res) {
  try {
    const { id, cid } = req.params;
    const userId = getUserId(req);

    const comment = await ImprintComment.findById(cid).lean();
    if (!comment) {
      return res.status(404).json(errors.notFound('评论不存在'));
    }

    const imprint = await Imprint.findById(id).lean();
    const isCommentAuthor = comment.authorId.toString() === userId.toString();
    const isImprintAuthor = imprint && imprint.authorId.toString() === userId.toString();

    if (!isCommentAuthor && !isImprintAuthor) {
      return res.status(403).json(errors.forbidden('无权删除此评论'));
    }

    await ImprintComment.findByIdAndDelete(cid);

    if (imprint) {
      const newCount = Math.max(0, (imprint.commentCount || 0) - 1);
      await Imprint.findByIdAndUpdate(id, { $set: { commentCount: newCount } });
    }

    res.json(success({ message: '删除成功' }));
  } catch (err) {
    logger.error('[imprint.deleteComment]', { error: err.message });
    res.status(500).json(errors.serverError());
  }
}

async function adminList(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 15));
    const { activityType, keyword } = req.query;

    const filter = {};
    if (activityType) filter.activityType = activityType;
    if (keyword) {
      const re = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: re }, { description: re }];
    }

    const [list, total] = await Promise.all([
      Imprint.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate('authorId', 'nickname avatarUrl _id')
        .lean(),
      Imprint.countDocuments(filter)
    ]);

    const normalized = list.map(item => ({
      ...item,
      author: item.authorId,
      authorId: item.authorId?._id
    }));

    res.json(success({ list: normalized, total, page, pageSize }));
  } catch (err) {
    logger.error('[imprint.adminList]', { error: err.message });
    res.status(500).json(errors.serverError());
  }
}

async function adminUpdate(req, res) {
  try {
    const { id } = req.params;
    const imprint = await Imprint.findById(id).lean();
    if (!imprint) return res.status(404).json(errors.notFound('印记不存在'));

    const { title, description, activityType, location, attendees, mediaList } = req.body;
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (activityType !== undefined) updateData.activityType = activityType;
    if (location !== undefined) updateData.location = location;
    if (attendees !== undefined) updateData.attendees = attendees;
    if (mediaList !== undefined) updateData.mediaList = mediaList;

    const updated = await Imprint.findByIdAndUpdate(id, updateData, { new: true }).lean();
    res.json(success(updated));
  } catch (err) {
    logger.error('[imprint.adminUpdate]', { error: err.message });
    res.status(500).json(errors.serverError());
  }
}

async function adminRemove(req, res) {
  try {
    const { id } = req.params;
    const imprint = await Imprint.findById(id);
    if (!imprint) return res.status(404).json(errors.notFound('印记不存在'));

    await Promise.all([
      Imprint.findByIdAndDelete(id),
      ImprintReaction.deleteMany({ imprintId: id }),
      ImprintComment.deleteMany({ imprintId: id })
    ]);

    res.json(success({ message: '删除成功' }));
  } catch (err) {
    logger.error('[imprint.adminRemove]', { error: err.message });
    res.status(500).json(errors.serverError());
  }
}

module.exports = {
  list,
  create,
  detail,
  update,
  remove,
  attend,
  cancelAttend,
  react,
  cancelReaction,
  listComments,
  createComment,
  deleteComment,
  adminList,
  adminUpdate,
  adminRemove
};
