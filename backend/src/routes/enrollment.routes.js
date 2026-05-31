const express = require('express');
const router = express.Router();
const {
  submitEnrollmentForm,
  enrollPeriod,
  getPeriodMembers,
  getUserEnrollments,
  checkEnrollment,
  withdrawEnrollment,
  completeEnrollment,
  getCompletionReportEnrollments,
  updateCompletionReport,
  deleteCompletionReport,
  getMyCompletionReports,
  getMyCompletionReportByPeriod,
  getEnrollments,
  updateEnrollment,
  deleteEnrollment,
  getActivePeriodsForExternal,
  getUsersByPeriodName,
  syncNicknamesFromEnrollments
} = require('../controllers/enrollment.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const {
  userTenantContext,
  adminTenantContext,
  publicTenantContext
} = require('../middleware/tenantContext');

// ===== 外部公开接口（无需认证，必须在参数化路由之前） =====
router.get('/external/active-periods', getActivePeriodsForExternal);
router.get('/external/users-by-period', publicTenantContext, getUsersByPeriodName);

// ===== 管理员路由（必须放在用户路由前面） =====
router.get('/reports', adminAuthMiddleware, adminTenantContext, getCompletionReportEnrollments);
router.put('/:id/completion-report', adminAuthMiddleware, adminTenantContext, updateCompletionReport);
router.delete('/:id/completion-report', adminAuthMiddleware, adminTenantContext, deleteCompletionReport);
router.get('/', adminAuthMiddleware, adminTenantContext, getEnrollments);
router.post('/sync-nicknames', adminAuthMiddleware, adminTenantContext, syncNicknamesFromEnrollments);
router.put('/:id', adminAuthMiddleware, adminTenantContext, updateEnrollment);
router.delete('/:id', adminAuthMiddleware, adminTenantContext, deleteEnrollment);

// ===== 用户路由 =====
router.post('/', authMiddleware, userTenantContext, submitEnrollmentForm);
router.post('/submit', authMiddleware, userTenantContext, submitEnrollmentForm);
router.post('/simple', authMiddleware, userTenantContext, enrollPeriod);


router.get('/my-completion-reports', authMiddleware, userTenantContext, getMyCompletionReports);
router.get('/my-completion-reports/:periodId', authMiddleware, userTenantContext, getMyCompletionReportByPeriod);
router.get('/check/:periodId', authMiddleware, userTenantContext, checkEnrollment);
router.get('/period/:periodId', authMiddleware, userTenantContext, getPeriodMembers);
router.get('/user/:userId?', authMiddleware, userTenantContext, getUserEnrollments);
router.delete('/:enrollmentId', authMiddleware, userTenantContext, withdrawEnrollment);
router.put('/:enrollmentId/complete', adminAuthMiddleware, adminTenantContext, completeEnrollment);

module.exports = router;
