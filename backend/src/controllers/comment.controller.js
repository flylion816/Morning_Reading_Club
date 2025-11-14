const Comment = require('../models/Comment');
const Checkin = require('../models/Checkin');
const { success, errors } = require('../utils/response');

// 创建评论
async function createComment(req, res, next) {
  try {
    const { checkinId, content } = req.body;
    const userId = req.user.userId;

    // 验证打卡存在
    const checkin = await Checkin.findById(checkinId);
    if (!checkin) {
      return res.status(404).json(errors.notFound('打卡记录不存在'));
    }

    const comment = await Comment.create({
      checkinId,
      userId,
      content,
      replyCount: 0,
      replies: []
    });

    // 填充用户信息
    await comment.populate('userId', 'nickname avatar avatarUrl');

    res.status(201).json(success(comment, '评论成功'));
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
      .limit(parseInt(limit))
      .select('-__v');

    res.json(success({
      list: comments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error) {
    next(error);
  }
}

// 回复评论
async function replyToComment(req, res, next) {
  try {
    const { commentId } = req.params;
    const { content, replyToUserId } = req.body;
    const userId = req.user.userId;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json(errors.notFound('评论不存在'));
    }

    // 添加回复
    comment.replies.push({
      userId,
      content,
      replyToUserId: replyToUserId || null,
      createdAt: new Date()
    });
    comment.replyCount = comment.replies.length;

    await comment.save();

    // 填充用户信息
    await comment.populate('userId', 'nickname avatar avatarUrl');
    await comment.populate('replies.userId', 'nickname avatar avatarUrl');
    await comment.populate('replies.replyToUserId', 'nickname');

    res.json(success(comment, '回复成功'));
  } catch (error) {
    next(error);
  }
}

// 删除评论
async function deleteComment(req, res, next) {
  try {
    const { commentId } = req.params;
    const userId = req.user.userId;

    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json(errors.notFound('评论不存在'));
    }

    // 只能删除自己的评论
    if (comment.userId.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json(errors.forbidden('无权删除'));
    }

    await Comment.findByIdAndDelete(commentId);

    res.json(success(null, '评论删除成功'));
  } catch (error) {
    next(error);
  }
}

// 删除回复
async function deleteReply(req, res, next) {
  try {
    const { commentId, replyId } = req.params;
    const userId = req.user.userId;

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

    res.json(success(null, '回复删除成功'));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createComment,
  getCommentsByCheckin,
  replyToComment,
  deleteComment,
  deleteReply
};
