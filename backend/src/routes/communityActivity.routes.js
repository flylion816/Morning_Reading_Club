const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/communityActivity.controller');
const { authMiddleware } = require('../middleware/auth');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const { userTenantContext, adminTenantContext, publicTenantContext } = require('../middleware/tenantContext');

// ===== 用户端路由（挂载到 /api/v1/community-activities） =====

// 静态路由必须在参数化路由之前
router.get('/popup', publicTenantContext, ctrl.getPopupActivity);
router.get('/my', authMiddleware, userTenantContext, ctrl.myActivities);
router.get('/', publicTenantContext, ctrl.listActivities);
router.get('/:id', publicTenantContext, ctrl.getActivity);
router.post('/:id/register', authMiddleware, userTenantContext, ctrl.registerActivity);
router.delete('/:id/register', authMiddleware, userTenantContext, ctrl.cancelRegistration);

// ===== 管理端路由（挂载到 /api/v1/admin/community-activities） =====
const adminRouter = express.Router();

adminRouter.use(adminAuthMiddleware, adminTenantContext);
adminRouter.get('/', ctrl.adminListActivities);
adminRouter.post('/', ctrl.adminCreateActivity);
adminRouter.put('/:id', ctrl.adminUpdateActivity);
adminRouter.delete('/:id', ctrl.adminDeleteActivity);
adminRouter.get('/:id/registrations', ctrl.adminGetRegistrations);

module.exports = { router, adminRouter };
