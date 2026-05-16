const express = require('express');

const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const {
  createComment,
  getCommentsByCheckin,
  replyToComment,
  deleteComment,
  deleteReply,
  likeComment,
  unlikeComment,
  likeReply,
  unlikeReply
} = require('../controllers/comment.controller');

// 所有 comment 路由都需要登录 + 租户上下文
router.use(authMiddleware, userTenantContext);

/**
 * @route   POST /api/v1/comments/:commentId/like
 * @desc    点赞评论
 * @access  Private
 */
router.post('/:commentId/like', likeComment);

/**
 * @route   DELETE /api/v1/comments/:commentId/like
 * @desc    取消点赞评论
 * @access  Private
 */
router.delete('/:commentId/like', unlikeComment);

/**
 * @route   POST /api/v1/comments/:commentId/replies/:replyId/like
 * @desc    点赞回复
 * @access  Private
 */
router.post('/:commentId/replies/:replyId/like', likeReply);

/**
 * @route   DELETE /api/v1/comments/:commentId/replies/:replyId/like
 * @desc    取消点赞回复
 * @access  Private
 */
router.delete('/:commentId/replies/:replyId/like', unlikeReply);

/**
 * @route   POST /api/v1/comments/:commentId/replies
 * @desc    回复评论
 * @access  Private
 */
router.post('/:commentId/replies', replyToComment);

/**
 * @route   DELETE /api/v1/comments/:commentId/replies/:replyId
 * @desc    删除回复
 * @access  Private
 */
router.delete('/:commentId/replies/:replyId', deleteReply);

/**
 * @route   GET /api/v1/comments/checkin/:checkinId
 * @desc    获取打卡的评论列表（注意顺序，/:commentId 路由之后）
 * @access  Private
 */
router.get('/checkin/:checkinId', getCommentsByCheckin);

/**
 * @route   POST /api/v1/comments
 * @desc    创建评论
 * @access  Private
 */
router.post('/', createComment);

/**
 * @route   DELETE /api/v1/comments/:commentId
 * @desc    删除评论
 * @access  Private
 */
router.delete('/:commentId', deleteComment);

module.exports = router;
