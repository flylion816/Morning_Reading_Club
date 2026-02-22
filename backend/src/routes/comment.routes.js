const express = require('express');

const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const {
  createComment,
  getCommentsByCheckin,
  replyToComment,
  deleteComment,
  deleteReply
} = require('../controllers/comment.controller');

/**
 * @route   POST /api/v1/comments/:commentId/replies
 * @desc    回复评论
 * @access  Private
 */
router.post('/:commentId/replies', authMiddleware, replyToComment);

/**
 * @route   DELETE /api/v1/comments/:commentId/replies/:replyId
 * @desc    删除回复
 * @access  Private
 */
router.delete('/:commentId/replies/:replyId', authMiddleware, deleteReply);

/**
 * @route   GET /api/v1/comments/checkin/:checkinId
 * @desc    获取打卡的评论列表（注意顺序，/:commentId 路由之后）
 * @access  Private
 */
router.get('/checkin/:checkinId', authMiddleware, getCommentsByCheckin);

/**
 * @route   DELETE /api/v1/comments/:commentId/replies/:replyId
 * @desc    删除回复
 * @access  Private
 */
router.delete('/:commentId/replies/:replyId', authMiddleware, deleteReply);

/**
 * @route   POST /api/v1/comments
 * @desc    创建评论
 * @access  Private
 */
router.post('/', authMiddleware, createComment);

/**
 * @route   DELETE /api/v1/comments/:commentId
 * @desc    删除评论
 * @access  Private
 */
router.delete('/:commentId', authMiddleware, deleteComment);

module.exports = router;
