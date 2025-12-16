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
  createInsightFromExternal,
  getInsights,
  getInsightsForPeriod,
  updateInsight,
  deleteInsightManual,
  createInsightRequest,
  getReceivedRequests,
  getSentRequests,
  getRequestStatus,
  approveInsightRequest,
  rejectInsightRequest,
  revokeInsightRequest,
  getInsightRequestsAdmin,
  getInsightRequestsStats,
  adminApproveRequest,
  adminRejectRequest,
  deleteInsightRequest,
  batchApproveRequests
} = require('../controllers/insight.controller');

/**
 * @route   GET /api/v1/insights
 * @desc    获取小凡看见列表（管理后台）
 * @access  Private (Admin)
 */
router.get('/', adminAuthMiddleware, getInsights);

/**
 * @route   POST /api/v1/insights
 * @desc    创建小凡看见（通用接口）
 * @access  Private
 */
router.post('/', authMiddleware, createInsightManual);

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
 * @route   GET /api/v1/insights/requests/status/:userId
 * @desc    检查与某个用户的小凡看见查看申请状态
 * @access  Private
 */
router.get('/requests/status/:userId', authMiddleware, getRequestStatus);

/**
 * @route   GET /api/v1/insights/requests/received
 * @desc    获取收到的查看申请列表
 * @access  Private
 */
router.get('/requests/received', authMiddleware, getReceivedRequests);

/**
 * @route   GET /api/v1/insights/requests/sent
 * @desc    获取发起的查看申请列表
 * @access  Private
 */
router.get('/requests/sent', authMiddleware, getSentRequests);

/**
 * @route   PUT /api/v1/insights/requests/:requestId/approve
 * @desc    同意查看申请
 * @access  Private
 */
router.put('/requests/:requestId/approve', authMiddleware, approveInsightRequest);

/**
 * @route   PUT /api/v1/insights/requests/:requestId/reject
 * @desc    拒绝查看申请
 * @access  Private
 */
router.put('/requests/:requestId/reject', authMiddleware, rejectInsightRequest);

/**
 * @route   PUT /api/v1/insights/requests/:requestId/revoke
 * @desc    撤销已批准的权限（用户操作）
 * @access  Private
 */
router.put('/requests/:requestId/revoke', authMiddleware, revokeInsightRequest);

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
 * @route   PUT /api/v1/insights/:insightId
 * @desc    更新反馈（用户编辑自己的）
 * @access  Private
 */
router.put('/:insightId', authMiddleware, updateInsight);

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

// ==================== 管理员查看申请管理接口 ====================

/**
 * @route   GET /api/v1/admin/insights/requests
 * @desc    获取所有查看申请列表（管理员视图）
 * @access  Private (Admin)
 */
router.get('/admin/requests', adminAuthMiddleware, getInsightRequestsAdmin);

/**
 * @route   GET /api/v1/admin/insights/requests/stats
 * @desc    获取申请统计信息
 * @access  Private (Admin)
 */
router.get('/admin/requests/stats', adminAuthMiddleware, getInsightRequestsStats);

/**
 * @route   PUT /api/v1/admin/insights/requests/:requestId/approve
 * @desc    管理员同意查看申请
 * @access  Private (Admin)
 */
router.put('/admin/requests/:requestId/approve', adminAuthMiddleware, adminApproveRequest);

/**
 * @route   PUT /api/v1/admin/insights/requests/:requestId/reject
 * @desc    管理员拒绝查看申请
 * @access  Private (Admin)
 */
router.put('/admin/requests/:requestId/reject', adminAuthMiddleware, adminRejectRequest);

/**
 * @route   DELETE /api/v1/admin/insights/requests/:requestId
 * @desc    管理员删除查看申请
 * @access  Private (Admin)
 */
router.delete('/admin/requests/:requestId', adminAuthMiddleware, deleteInsightRequest);

/**
 * @route   POST /api/v1/admin/insights/requests/batch-approve
 * @desc    管理员批量同意查看申请
 * @access  Private (Admin)
 */
router.post('/admin/requests/batch-approve', adminAuthMiddleware, batchApproveRequests);

// ==================== 外部接口 ====================

/**
 * @route   POST /api/v1/insights/external/create
 * @desc    外部系统创建小凡看见（无需认证）
 * @param   userId {string} - 用户ID（必填）
 * @param   periodName {string} - 期次名称（必填）
 * @param   day {number} - 第几天（可选）
 * @param   content {string} - 文字内容（与imageUrl二选一）
 * @param   imageUrl {string} - 图片地址（与content二选一）
 * @access  Public
 */
router.post('/external/create', createInsightFromExternal);

module.exports = router;
