const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const {
  generateInsight,
  getUserInsights,
  getInsightDetail,
  deleteInsight
} = require('../controllers/insight.controller');

/**
 * @route   POST /api/v1/insights/generate
 * @desc    生成AI反馈
 * @access  Private
 */
router.post('/generate', authMiddleware, generateInsight);

/**
 * @route   GET /api/v1/insights/user/:userId?
 * @desc    获取用户的反馈列表
 * @access  Private
 */
router.get('/user/:userId?', authMiddleware, getUserInsights);

/**
 * @route   GET /api/v1/insights/:insightId
 * @desc    获取反馈详情
 * @access  Private
 */
router.get('/:insightId', authMiddleware, getInsightDetail);

/**
 * @route   DELETE /api/v1/insights/:insightId
 * @desc    删除反馈
 * @access  Private
 */
router.delete('/:insightId', authMiddleware, deleteInsight);

module.exports = router;
