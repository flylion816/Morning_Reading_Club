const express = require('express');
const adminController = require('../controllers/admin.controller');
const checkinController = require('../controllers/checkin.controller');
const periodController = require('../controllers/period.controller');
const sectionController = require('../controllers/section.controller');
const { adminAuthMiddleware, requireRole } = require('../middleware/adminAuth');

const router = express.Router();

// 公开路由（不需要认证）
router.post('/auth/admin/login', adminController.login);
router.post('/auth/admin/init', adminController.initSuperAdmin);

// 受保护的路由（需要认证）
router.get('/auth/admin/profile', adminAuthMiddleware, adminController.getProfile);
router.post('/auth/admin/logout', adminAuthMiddleware, adminController.logout);
router.post('/auth/admin/refresh-token', adminAuthMiddleware, adminController.refreshToken);
router.post('/auth/admin/change-password', adminAuthMiddleware, adminController.changePassword);

// 超级管理员路由
router.get('/admins', adminAuthMiddleware, requireRole('superadmin'), adminController.getAdmins);
router.post('/admins', adminAuthMiddleware, requireRole('superadmin'), adminController.createAdmin);
router.put(
  '/admins/:id',
  adminAuthMiddleware,
  requireRole('superadmin'),
  adminController.updateAdmin
);
router.delete(
  '/admins/:id',
  adminAuthMiddleware,
  requireRole('superadmin'),
  adminController.deleteAdmin
);

// 打卡管理路由（管理员）
router.get('/admin/checkins', adminAuthMiddleware, checkinController.getAdminCheckins);
router.get('/admin/checkins/stats', adminAuthMiddleware, checkinController.getCheckinStats);
router.delete(
  '/admin/checkins/:checkinId',
  adminAuthMiddleware,
  checkinController.deleteAdminCheckin
);

// 期次管理路由（管理员）
router.post('/admin/periods', adminAuthMiddleware, periodController.createPeriod);
router.put('/admin/periods/:periodId', adminAuthMiddleware, periodController.updatePeriod);
router.delete('/admin/periods/:periodId', adminAuthMiddleware, periodController.deletePeriod);

// 课节管理路由（管理员）
router.post('/admin/sections', adminAuthMiddleware, sectionController.createSection);
router.put('/admin/sections/:sectionId', adminAuthMiddleware, sectionController.updateSection);
router.delete('/admin/sections/:sectionId', adminAuthMiddleware, sectionController.deleteSection);

module.exports = router;
