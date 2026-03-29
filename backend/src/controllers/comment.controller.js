const Comment = require('../models/Comment');
const Checkin = require('../models/Checkin');
const User = require('../models/User');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const mysqlBackupService = require('../services/mysql-backup.service');
const { publishSyncEvent } = require('../services/sync.service');
const { dispatchNotificationWithSubscribe } = require('../services/user-notification.service');
const { ensurePeriodCommunityAccess } = require('../services/community-access.service');
const {
  buildCourseDetailTargetPage,
  formatNotificationTime,
  truncateText
} = require('../utils/notification-links');

function getRequestUserId(req) {
  return req.user.userId || req.user.id || req.user._id;
}

async function loadCheckinWithRelations(checkinId) {
  const checkin = await Checkin.findById(checkinId);
  if (checkin && typeof checkin.populate === 'function') {
    await checkin.populate('userId', 'nickname avatar avatarUrl');
    await checkin.populate('sectionId', 'title');
  }
  return checkin;
}

async function loadCommentWithUser(commentId) {
  const comment = await Comment.findById(commentId);
  if (comment && typeof comment.populate === 'function') {
    await comment.populate('userId', 'nickname avatar avatarUrl');
  }
  return comment;
}

async function getActorUser(userId) {
  return User.findById(userId).select('nickname avatar avatarUrl').lean();
}

function getCheckinPeriodId(checkin) {
  return checkin?.periodId?._id?.toString?.() || checkin?.periodId?.toString?.();
}

async function loadCommentCheckin(comment) {
  if (!comment?.checkinId) {
    return null;
  }

  const checkin = await Checkin.findById(comment.checkinId);
  if (checkin && typeof checkin.populate === 'function') {
    await checkin.populate('sectionId', 'title');
  }
  return checkin;
}

async function notifyCommentReceived(req, payload) {
  try {
    await dispatchNotificationWithSubscribe(req, payload);
  } catch (error) {
    logger.warn('评论类通知发送失败', {
      message: error.message,
      sourceId: payload.sourceId,
      recipientUserId: payload.recipientUserId
    });
  }
}

async function notifyLikeReceived(req, payload) {
  try {
    await dispatchNotificationWithSubscribe(req, payload);
  } catch (error) {
    logger.warn('点赞类通知发送失败', {
      message: error.message,
      sourceId: payload.sourceId,
      recipientUserId: payload.recipientUserId
    });
  }
}

// 创建评论
async function createComment(req, res, next) {
  try {
    const { checkinId, content } = req.body;
    const userId = getRequestUserId(req);

    // 验证打卡存在
    const checkin = await loadCheckinWithRelations(checkinId);
    if (!checkin) {
      return res.status(404).json(errors.notFound('打卡记录不存在'));
    }

    const hasCommunityAccess = await ensurePeriodCommunityAccess(
      res,
      userId,
      getCheckinPeriodId(checkin)
    );
    if (!hasCommunityAccess) {
      return;
    }

    const comment = await Comment.create({
      checkinId,
      userId,
      content,
      replyCount: 0,
      replies: []
    });

    // 异步备份到MySQL
    mysqlBackupService
      .syncComment(comment)
      .catch(err =>
        logger.warn('MySQL backup failed for comment', { id: comment._id, error: err.message })
      );

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'create',
      collection: 'comments',
      documentId: comment._id.toString(),
      data: comment.toObject()
    });

    // 填充用户信息（重新查询以获取populate后的数据）
    const populatedComment = await Comment.findById(comment._id).populate(
      'userId',
      'nickname avatar avatarUrl'
    );

    const checkinOwnerId = checkin.userId?._id?.toString?.() || checkin.userId?.toString?.();
    if (checkinOwnerId && checkinOwnerId !== userId) {
      const actorUser = await getActorUser(userId);
      const sectionId = checkin.sectionId?._id?.toString?.() || checkin.sectionId?.toString?.();
      const targetPage = buildCourseDetailTargetPage(sectionId, {
        focus: 'comments',
        checkinId: checkin._id,
        commentId: comment._id
      });

      await notifyCommentReceived(req, {
        recipientUserId: checkinOwnerId,
        notificationType: 'comment_received',
        title: '收到新的评论',
        content: `${actorUser?.nickname || '有人'} 评论了你的打卡`,
        scene: 'comment_received',
        targetPage,
        senderId: userId,
        data: {
          senderName: actorUser?.nickname,
          senderAvatar: actorUser?.avatarUrl || '',
          sectionId,
          checkinId: checkin._id.toString(),
          commentId: comment._id.toString()
        },
        subscribeFields: {
          replyUser: actorUser?.nickname || '用户',
          replyTopic: truncateText(
            checkin.note || checkin.content || checkin.sectionId?.title || '打卡内容'
          ),
          replyContent: truncateText(content, 32),
          replyTime: formatNotificationTime(comment.createdAt)
        },
        sourceType: 'comment',
        sourceId: comment._id
      });
    }

    res.status(201).json(success(populatedComment, '评论成功'));
  } catch (error) {
    next(error);
  }
}

// 获取打卡的评论列表
async function getCommentsByCheckin(req, res, next) {
  try {
    const { checkinId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const total = await Comment.countDocuments({ checkinId });
    const comments = await Comment.find({ checkinId })
      .populate('userId', 'nickname avatar avatarUrl')
      .populate('replies.userId', 'nickname avatar avatarUrl')
      .populate('replies.replyToUserId', 'nickname')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10))
      .select('-__v');

    res.json(
      success({
        list: comments,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: Math.ceil(total / limit)
        }
      })
    );
  } catch (error) {
    next(error);
  }
}

// 回复评论
async function replyToComment(req, res, next) {
  try {
    const { commentId } = req.params;
    const { content, replyToUserId } = req.body;
    const userId = getRequestUserId(req);

    const comment = await loadCommentWithUser(commentId);

    if (!comment) {
      return res.status(404).json(errors.notFound('评论不存在'));
    }

    const checkin = await loadCommentCheckin(comment);
    const hasCommunityAccess = await ensurePeriodCommunityAccess(
      res,
      userId,
      getCheckinPeriodId(checkin)
    );
    if (!hasCommunityAccess) {
      return;
    }

    const targetRecipientId =
      replyToUserId || comment.userId?._id?.toString?.() || comment.userId?.toString?.();

    // 添加回复
    comment.replies.push({
      userId,
      content,
      replyToUserId: replyToUserId || null,
      createdAt: new Date()
    });
    comment.replyCount = comment.replies.length;

    await comment.save();

    // 异步备份到MySQL
    mysqlBackupService
      .syncComment(comment)
      .catch(err =>
        logger.warn('MySQL backup failed for comment', { id: comment._id, error: err.message })
      );

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'update',
      collection: 'comments',
      documentId: comment._id.toString(),
      data: comment.toObject()
    });

    const createdReply = comment.replies[comment.replies.length - 1];

    // 填充用户信息（重新查询以获取populate后的数据）
    const populatedComment = await Comment.findById(comment._id)
      .populate('userId', 'nickname avatar avatarUrl')
      .populate('replies.userId', 'nickname avatar avatarUrl')
      .populate('replies.replyToUserId', 'nickname');

    if (targetRecipientId && targetRecipientId !== userId) {
      const [actorUser, relatedCheckin] = await Promise.all([
        getActorUser(userId),
        checkin ? Promise.resolve(checkin) : loadCheckinWithRelations(comment.checkinId)
      ]);
      const sectionId =
        relatedCheckin?.sectionId?._id?.toString?.() || relatedCheckin?.sectionId?.toString?.();
      const targetPage = buildCourseDetailTargetPage(sectionId, {
        focus: 'comments',
        checkinId: comment.checkinId,
        commentId: comment._id,
        replyId: createdReply?._id
      });

      await notifyCommentReceived(req, {
        recipientUserId: targetRecipientId,
        notificationType: 'comment_received',
        title: '收到新的回复',
        content: `${actorUser?.nickname || '有人'} 回复了你的评论`,
        scene: 'comment_received',
        targetPage,
        senderId: userId,
        data: {
          senderName: actorUser?.nickname,
          senderAvatar: actorUser?.avatarUrl || '',
          sectionId,
          checkinId: comment.checkinId.toString(),
          commentId: comment._id.toString(),
          replyId: createdReply?._id?.toString?.() || null
        },
        subscribeFields: {
          replyUser: actorUser?.nickname || '用户',
          replyTopic: truncateText(
            comment.content || relatedCheckin?.note || relatedCheckin?.sectionId?.title || '评论内容'
          ),
          replyContent: truncateText(content, 32),
          replyTime: formatNotificationTime(createdReply?.createdAt || new Date())
        },
        sourceType: 'comment_reply',
        sourceId: createdReply?._id || comment._id
      });
    }

    res.json(success(populatedComment, '回复成功'));
  } catch (error) {
    next(error);
  }
}

// 删除评论
async function deleteComment(req, res, next) {
  try {
    const { commentId } = req.params;
    const { userId } = req.user;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json(errors.notFound('评论不存在'));
    }

    // 只能删除自己的评论
    if (comment.userId.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json(errors.forbidden('无权删除'));
    }

    // 保存评论信息用于同步
    const commentData = comment.toObject();

    await Comment.findByIdAndDelete(commentId);

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'delete',
      collection: 'comments',
      documentId: commentId,
      data: commentData
    });

    res.json(success(null, '评论删除成功'));
  } catch (error) {
    next(error);
  }
}

// 删除回复
async function deleteReply(req, res, next) {
  try {
    const { commentId, replyId } = req.params;
    const { userId } = req.user;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json(errors.notFound('评论不存在'));
    }

    const reply = comment.replies.id(replyId);

    if (!reply) {
      return res.status(404).json(errors.notFound('回复不存在'));
    }

    // 只能删除自己的回复
    if (reply.userId.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json(errors.forbidden('无权删除'));
    }

    reply.deleteOne();
    comment.replyCount = comment.replies.length;

    await comment.save();

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'update',
      collection: 'comments',
      documentId: comment._id.toString(),
      data: comment.toObject()
    });

    res.json(success(null, '回复删除成功'));
  } catch (error) {
    next(error);
  }
}

// 点赞评论
async function likeComment(req, res, next) {
  try {
    const { commentId } = req.params;
    const userId = getRequestUserId(req);

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json(errors.notFound('评论不存在'));
    }

    const checkin = await loadCommentCheckin(comment);
    const hasCommunityAccess = await ensurePeriodCommunityAccess(
      res,
      userId,
      getCheckinPeriodId(checkin)
    );
    if (!hasCommunityAccess) {
      return;
    }

    // 检查是否已点赞
    const alreadyLiked = comment.likes.some(like => like.userId.toString() === userId);
    if (alreadyLiked) {
      return res.status(400).json(errors.badRequest('已经点过赞了'));
    }

    // 添加点赞
    comment.likes.push({ userId, createdAt: new Date() });
    comment.likeCount = comment.likes.length;
    await comment.save();

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'update',
      collection: 'comments',
      documentId: comment._id.toString(),
      data: comment.toObject()
    });

    const commentOwnerId = comment.userId?.toString?.() || String(comment.userId);
    if (commentOwnerId !== userId) {
      const actorUser = await getActorUser(userId);
      const sectionId = checkin?.sectionId?._id?.toString?.() || checkin?.sectionId?.toString?.();
      const targetPage = buildCourseDetailTargetPage(sectionId, {
        focus: 'comments',
        checkinId: comment.checkinId,
        commentId: comment._id
      });

      await notifyLikeReceived(req, {
        recipientUserId: commentOwnerId,
        notificationType: 'like_received',
        title: '收到新的点赞',
        content: `${actorUser?.nickname || '有人'} 点赞了你的评论`,
        scene: 'like_received',
        targetPage,
        senderId: userId,
        data: {
          senderName: actorUser?.nickname,
          senderAvatar: actorUser?.avatarUrl || '',
          sectionId,
          checkinId: comment.checkinId.toString(),
          commentId: comment._id.toString()
        },
        subscribeFields: {
          likeUser: actorUser?.nickname || '用户',
          likeTime: formatNotificationTime(new Date())
        },
        sourceType: 'comment_like',
        sourceId: comment._id
      });
    }

    res.json(success(comment, '点赞成功'));
  } catch (error) {
    next(error);
  }
}

// 取消点赞评论
async function unlikeComment(req, res, next) {
  try {
    const { commentId } = req.params;
    const userId = getRequestUserId(req);

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json(errors.notFound('评论不存在'));
    }

    const checkin = await loadCommentCheckin(comment);
    const hasCommunityAccess = await ensurePeriodCommunityAccess(
      res,
      userId,
      getCheckinPeriodId(checkin)
    );
    if (!hasCommunityAccess) {
      return;
    }

    // 检查是否已点赞
    const likeIndex = comment.likes.findIndex(like => like.userId.toString() === userId);
    if (likeIndex === -1) {
      return res.status(400).json(errors.badRequest('未点过赞'));
    }

    // 移除点赞
    comment.likes.splice(likeIndex, 1);
    comment.likeCount = comment.likes.length;
    await comment.save();

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'update',
      collection: 'comments',
      documentId: comment._id.toString(),
      data: comment.toObject()
    });

    res.json(success(comment, '取消点赞成功'));
  } catch (error) {
    next(error);
  }
}

// 点赞回复
async function likeReply(req, res, next) {
  try {
    const { commentId, replyId } = req.params;
    const userId = getRequestUserId(req);

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json(errors.notFound('评论不存在'));
    }

    const checkin = await loadCommentCheckin(comment);
    const hasCommunityAccess = await ensurePeriodCommunityAccess(
      res,
      userId,
      getCheckinPeriodId(checkin)
    );
    if (!hasCommunityAccess) {
      return;
    }

    const reply = comment.replies.id(replyId);
    if (!reply) {
      return res.status(404).json(errors.notFound('回复不存在'));
    }

    // 检查是否已点赞
    const alreadyLiked = reply.likes.some(like => like.userId.toString() === userId);
    if (alreadyLiked) {
      return res.status(400).json(errors.badRequest('已经点过赞了'));
    }

    // 添加点赞
    reply.likes.push({ userId, createdAt: new Date() });
    reply.likeCount = reply.likes.length;
    await comment.save();

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'update',
      collection: 'comments',
      documentId: comment._id.toString(),
      data: comment.toObject()
    });

    const replyOwnerId = reply.userId?.toString?.() || String(reply.userId);
    if (replyOwnerId !== userId) {
      const actorUser = await getActorUser(userId);
      const sectionId = checkin?.sectionId?._id?.toString?.() || checkin?.sectionId?.toString?.();
      const targetPage = buildCourseDetailTargetPage(sectionId, {
        focus: 'comments',
        checkinId: comment.checkinId,
        commentId: comment._id,
        replyId: reply._id
      });

      await notifyLikeReceived(req, {
        recipientUserId: replyOwnerId,
        notificationType: 'like_received',
        title: '收到新的点赞',
        content: `${actorUser?.nickname || '有人'} 点赞了你的回复`,
        scene: 'like_received',
        targetPage,
        senderId: userId,
        data: {
          senderName: actorUser?.nickname,
          senderAvatar: actorUser?.avatarUrl || '',
          sectionId,
          checkinId: comment.checkinId.toString(),
          commentId: comment._id.toString(),
          replyId: reply._id.toString()
        },
        subscribeFields: {
          likeUser: actorUser?.nickname || '用户',
          likeTime: formatNotificationTime(new Date())
        },
        sourceType: 'reply_like',
        sourceId: reply._id
      });
    }

    res.json(success(comment, '点赞成功'));
  } catch (error) {
    next(error);
  }
}

// 取消点赞回复
async function unlikeReply(req, res, next) {
  try {
    const { commentId, replyId } = req.params;
    const userId = getRequestUserId(req);

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json(errors.notFound('评论不存在'));
    }

    const checkin = await loadCommentCheckin(comment);
    const hasCommunityAccess = await ensurePeriodCommunityAccess(
      res,
      userId,
      getCheckinPeriodId(checkin)
    );
    if (!hasCommunityAccess) {
      return;
    }

    const reply = comment.replies.id(replyId);
    if (!reply) {
      return res.status(404).json(errors.notFound('回复不存在'));
    }

    // 检查是否已点赞
    const likeIndex = reply.likes.findIndex(like => like.userId.toString() === userId);
    if (likeIndex === -1) {
      return res.status(400).json(errors.badRequest('未点过赞'));
    }

    // 移除点赞
    reply.likes.splice(likeIndex, 1);
    reply.likeCount = reply.likes.length;
    await comment.save();

    // 异步同步到 MySQL
    publishSyncEvent({
      type: 'update',
      collection: 'comments',
      documentId: comment._id.toString(),
      data: comment.toObject()
    });

    res.json(success(comment, '取消点赞成功'));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createComment,
  getCommentsByCheckin,
  replyToComment,
  deleteComment,
  deleteReply,
  likeComment,
  unlikeComment,
  likeReply,
  unlikeReply
};
