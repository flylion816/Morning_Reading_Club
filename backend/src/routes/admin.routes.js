const express = require('express');
const adminController = require('../controllers/admin.controller');
const adminSubscriptionController = require('../controllers/admin-subscription.controller');
const checkinController = require('../controllers/checkin.controller');
const periodController = require('../controllers/period.controller');
const sectionController = require('../controllers/section.controller');
const tenantController = require('../controllers/tenant.controller');
const { adminAuthMiddleware, requireRole } = require('../middleware/adminAuth');
const { adminTenantContext } = require('../middleware/tenantContext');

const router = express.Router();

// 公开路由（不需要认证）
router.post('/auth/admin/login', adminController.login);
router.post('/auth/admin/init', adminController.initSuperAdmin);

// 受保护路由（认证 + 租户上下文）
router.use(adminAuthMiddleware);
router.use(adminTenantContext);

// 管理员个人路由
router.get('/auth/admin/profile', adminController.getProfile);
router.put('/auth/admin/profile', adminController.updateProfile);
router.post('/auth/admin/logout', adminController.logout);
router.post('/auth/admin/refresh-token', adminController.refreshToken);
router.post('/auth/admin/change-password', adminController.changePassword);
router.post('/auth/admin/change-db-access-password', adminController.changeDbAccessPassword);
router.post('/auth/admin/verify-db-access', adminController.verifyDbAccess);

// 租户管理（仅 platform_superadmin）
router.get('/admin/tenants', tenantController.listTenants);
router.post('/admin/tenants', tenantController.createTenant);
router.put('/admin/tenants/:tenantId', tenantController.updateTenant);
router.get('/admin/current-tenant', tenantController.getCurrentTenant);

// 超级管理员路由
router.get('/admins', requireRole('platform_superadmin', 'superadmin'), adminController.getAdmins);
router.post('/admins', requireRole('platform_superadmin', 'superadmin'), adminController.createAdmin);
router.put(
  '/admins/:id',
  requireRole('platform_superadmin', 'superadmin'),
  adminController.updateAdmin
);
router.delete(
  '/admins/:id',
  requireRole('platform_superadmin', 'superadmin'),
  adminController.deleteAdmin
);
router.get(
  '/admins/:id',
  requireRole('platform_superadmin', 'superadmin'),
  adminController.getAdminDetail
);
router.patch(
  '/admins/:id/password',
  requireRole('platform_superadmin', 'superadmin'),
  adminController.resetAdminPassword
);
router.patch(
  '/admins/:id/status',
  requireRole('platform_superadmin', 'superadmin'),
  adminController.updateAdminStatus
);

// 打卡管理路由（管理员）
router.get('/admin/checkins', checkinController.getAdminCheckins);
router.get('/admin/checkins/stats', checkinController.getCheckinStats);
router.put(
  '/admin/checkins/:checkinId',
  checkinController.updateAdminCheckin
);
router.delete(
  '/admin/checkins/:checkinId',
  checkinController.deleteAdminCheckin
);

// 订阅消息排查路由（管理员，只读）
router.get(
  '/admin/subscription-grants',
  adminSubscriptionController.getSubscriptionGrantList
);
router.get(
  '/admin/subscription-grants/:userId',
  adminSubscriptionController.getSubscriptionGrantDetail
);

// 期次管理路由（管理员）
router.post('/admin/periods', periodController.createPeriod);
router.put('/admin/periods/:periodId', periodController.updatePeriod);
router.delete('/admin/periods/:periodId', periodController.deletePeriod);

// 课节管理路由（管理员）
router.post('/admin/sections', sectionController.createSection);
router.put('/admin/sections/:sectionId', sectionController.updateSection);
router.delete('/admin/sections/:sectionId', sectionController.deleteSection);

module.exports = router;
