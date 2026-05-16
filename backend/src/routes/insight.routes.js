const express = require('express');
const router = express.Router();
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const {
  userTenantContext,
  publicTenantContext,
  optionalUserOrPublicTenantContext
} = require('../middleware/tenantContext');
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
  likeInsight,
  unlikeInsight,
  postDanmaku,
  getDanmaku,
  adminGetInsightDetail,
  adminGetDanmaku,
  adminLikeForUser,
  adminPostDanmakuForUser,
  adminDeleteDanmaku,
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

// ===== 外部公开接口（无需认证） =====
router.post('/external/create', publicTenantContext, createInsightFromExternal);

// ===== 管理员路由 =====
router.get('/', adminAuthMiddleware, userTenantContext, getInsights);
router.get('/admin/:insightId/detail', adminAuthMiddleware, userTenantContext, adminGetInsightDetail);
router.get('/admin/:insightId/danmaku', adminAuthMiddleware, userTenantContext, adminGetDanmaku);
router.post('/admin/:insightId/like', adminAuthMiddleware, userTenantContext, adminLikeForUser);
router.post('/admin/:insightId/danmaku', adminAuthMiddleware, userTenantContext, adminPostDanmakuForUser);
router.delete('/admin/danmaku/:danmakuId', adminAuthMiddleware, userTenantContext, adminDeleteDanmaku);
router.put('/admin/:insightId', adminAuthMiddleware, userTenantContext, updateInsight);
router.post('/manual/create', adminAuthMiddleware, userTenantContext, createInsightManual);
router.delete('/manual/:insightId', adminAuthMiddleware, userTenantContext, deleteInsightManual);
router.get('/admin/requests', adminAuthMiddleware, userTenantContext, getInsightRequestsAdmin);
router.get('/admin/requests/stats', adminAuthMiddleware, userTenantContext, getInsightRequestsStats);
router.put('/admin/requests/:requestId/approve', adminAuthMiddleware, userTenantContext, adminApproveRequest);
router.put('/admin/requests/:requestId/reject', adminAuthMiddleware, userTenantContext, adminRejectRequest);
router.delete('/admin/requests/:requestId', adminAuthMiddleware, userTenantContext, deleteInsightRequest);
router.post('/admin/requests/batch-approve', adminAuthMiddleware, userTenantContext, batchApproveRequests);

// ===== 用户路由 =====
router.post('/', authMiddleware, userTenantContext, createInsightManual);
router.post('/generate', authMiddleware, userTenantContext, generateInsight);
router.post('/requests', authMiddleware, userTenantContext, createInsightRequest);
router.get('/requests/status/:userId', authMiddleware, userTenantContext, getRequestStatus);
router.get('/requests/received', authMiddleware, userTenantContext, getReceivedRequests);
router.get('/requests/sent', authMiddleware, userTenantContext, getSentRequests);
router.post('/requests/:requestId/approve', authMiddleware, userTenantContext, approveInsightRequest);
router.post('/requests/:requestId/reject', authMiddleware, userTenantContext, rejectInsightRequest);
router.put('/requests/:requestId/revoke', authMiddleware, userTenantContext, revokeInsightRequest);
router.get('/user/:userId?', authMiddleware, userTenantContext, getUserInsights);
router.get('/period/:periodId', authMiddleware, userTenantContext, getInsightsForPeriod);
router.put('/:insightId', authMiddleware, userTenantContext, updateInsight);
router.delete('/:insightId', authMiddleware, userTenantContext, deleteInsight);
router.post('/:insightId/like', authMiddleware, userTenantContext, likeInsight);
router.post('/:insightId/unlike', authMiddleware, userTenantContext, unlikeInsight);
router.get('/:insightId/danmaku', authMiddleware, userTenantContext, getDanmaku);
router.post('/:insightId/danmaku', authMiddleware, userTenantContext, postDanmaku);

// 公开详情页（可选登录）
router.get('/:insightId', optionalAuthMiddleware, optionalUserOrPublicTenantContext, getInsightDetail);

module.exports = router;
