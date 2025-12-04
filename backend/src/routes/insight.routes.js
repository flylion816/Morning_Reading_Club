const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const {
  generateInsight,
  getUserInsights,
  getInsightDetail,
  deleteInsight,
  createInsightManual,
  getInsights,
  getInsightsForPeriod,
  updateInsight,
  deleteInsightManual,
  createInsightRequest
} = require('../controllers/insight.controller');

/**
 * @route   GET /api/v1/insights
 * @desc    获取小凡看见列表（管理后台）
 * @access  Private (Admin)
 */
router.get('/', adminAuthMiddleware, getInsights);

/**
 * @route   POST /api/v1/insights/generate
 * @desc    生成AI反馈
 * @access  Private
 */
router.post('/generate', authMiddleware, generateInsight);

/**
 * @route   POST /api/v1/insights/requests
 * @desc    创建小凡看见查看申请
 * @access  Private
 */
router.post('/requests', authMiddleware, createInsightRequest);

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

// ==================== 小凡看见(Insight) 相关路由 ====================

/**
 * @route   POST /api/v1/insights/manual/create
 * @desc    创建小凡看见（手动导入）
 * @access  Private (Admin)
 */
router.post('/manual/create', adminAuthMiddleware, createInsightManual);

/**
 * @route   GET /api/v1/insights/period/:periodId
 * @desc    获取某期次的小凡看见列表
 * @access  Public (with optional auth for personalized results)
 */
router.get('/period/:periodId', authMiddleware, getInsightsForPeriod);

/**
 * @route   PUT /api/v1/insights/:insightId
 * @desc    更新小凡看见（编辑文案）
 * @access  Private (Admin)
 */
router.put('/:insightId', adminAuthMiddleware, updateInsight);

/**
 * @route   DELETE /api/v1/insights/manual/:insightId
 * @desc    删除小凡看见
 * @access  Private (Admin)
 */
router.delete('/manual/:insightId', adminAuthMiddleware, deleteInsightManual);

module.exports = router;
