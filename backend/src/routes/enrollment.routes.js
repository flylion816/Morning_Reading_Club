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
  getEnrollments,
  updateEnrollment,
  deleteEnrollment,
  debugCleanupEnrollments,
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
router.get('/external/active-periods', publicTenantContext, getActivePeriodsForExternal);
router.get('/external/users-by-period', publicTenantContext, getUsersByPeriodName);

// ===== 管理员路由（必须放在用户路由前面） =====
router.get('/', adminAuthMiddleware, adminTenantContext, getEnrollments);
router.post('/sync-nicknames', adminAuthMiddleware, adminTenantContext, syncNicknamesFromEnrollments);
router.put('/:id', adminAuthMiddleware, adminTenantContext, updateEnrollment);
router.delete('/:id', adminAuthMiddleware, adminTenantContext, deleteEnrollment);

// ===== 用户路由 =====
router.post('/', authMiddleware, userTenantContext, submitEnrollmentForm);
router.post('/submit', authMiddleware, userTenantContext, submitEnrollmentForm);
router.post('/simple', authMiddleware, userTenantContext, enrollPeriod);

// 调试路由（开发环境）
router.delete('/debug/cleanup/:userId/:keepPeriodId', debugCleanupEnrollments);
router.get('/debug/enrollments/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const Enrollment = require('../models/Enrollment');
    const enrollments = await Enrollment.find({ userId }).populate('periodId', 'name');
    res.json({
      code: 200,
      data: {
        total: enrollments.length,
        enrollments: enrollments.map(e => ({
          _id: e._id,
          periodId: e.periodId._id,
          periodName: e.periodId.name,
          status: e.status,
          paymentStatus: e.paymentStatus,
          createdAt: e.createdAt
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

router.get('/check/:periodId', authMiddleware, userTenantContext, checkEnrollment);
router.get('/period/:periodId', authMiddleware, userTenantContext, getPeriodMembers);
router.get('/user/:userId?', authMiddleware, userTenantContext, getUserEnrollments);
router.delete('/:enrollmentId', authMiddleware, userTenantContext, withdrawEnrollment);
router.put('/:enrollmentId/complete', adminAuthMiddleware, adminTenantContext, completeEnrollment);

module.exports = router;
