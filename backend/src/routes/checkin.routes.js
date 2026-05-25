const express = require('express');
const router = express.Router();
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const { userTenantContext, optionalUserOrPublicTenantContext } = require('../middleware/tenantContext');
const {
  createCheckin,
  getUserCheckins,
  getUserCheckinSummary,
  getPeriodCheckins,
  searchCheckins,
  getCheckinDetail,
  updateCheckin,
  deleteCheckin,
  getCheckins,
  likeCheckin,
  unlikeCheckin
} = require('../controllers/checkin.controller');

// 其余 checkin 路由都需要登录 + 租户上下文
router.post('/', authMiddleware, userTenantContext, createCheckin);
router.get('/', authMiddleware, userTenantContext, getCheckins);
router.get('/user/summary', authMiddleware, userTenantContext, getUserCheckinSummary);
router.get('/user/:userId/summary', authMiddleware, userTenantContext, getUserCheckinSummary);
router.get('/user/:userId?', authMiddleware, userTenantContext, getUserCheckins);
router.get('/search', authMiddleware, userTenantContext, searchCheckins);
router.get('/period/:periodId', authMiddleware, userTenantContext, getPeriodCheckins);
router.post('/:checkinId/like', authMiddleware, userTenantContext, likeCheckin);
router.delete('/:checkinId/like', authMiddleware, userTenantContext, unlikeCheckin);
router.put('/:checkinId', authMiddleware, userTenantContext, updateCheckin);
router.delete('/:checkinId', authMiddleware, userTenantContext, deleteCheckin);

// 打卡详情：可选认证，未登录只能看公开打卡（放最后避免拦截具名路由）
router.get('/:checkinId', optionalAuthMiddleware, optionalUserOrPublicTenantContext, getCheckinDetail);

module.exports = router;
