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
  approveEnrollment,
  rejectEnrollment,
  updateEnrollment,
  deleteEnrollment,
  debugCleanupEnrollments
} = require('../controllers/enrollment.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// ===== 管理员路由（必须放在最前面，以避免被参数路由覆盖） =====

// 获取报名列表（管理员）
router.get('/', adminMiddleware, getEnrollments);

// 批准报名（管理员）
router.post('/:id/approve', adminMiddleware, approveEnrollment);

// 拒绝报名（管理员）
router.post('/:id/reject', adminMiddleware, rejectEnrollment);

// 更新报名记录（管理员）
router.put('/:id', adminMiddleware, updateEnrollment);

// 删除报名记录（管理员）
router.delete('/:id', adminMiddleware, deleteEnrollment);

// ===== 用户路由 =====

// 提交报名表单（包含完整信息）
router.post('/submit', authMiddleware, submitEnrollmentForm);

// 简化报名（仅periodId）
router.post('/simple', authMiddleware, enrollPeriod);

// 调试：清理报名记录（仅开发环境，必须放在其他路由之前）
router.delete('/debug/cleanup/:userId/:keepPeriodId', debugCleanupEnrollments);

// 调试：查看用户的所有报名记录
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

// 获取期次的成员列表
router.get('/period/:periodId', authMiddleware, getPeriodMembers);

// 获取用户的报名列表
router.get('/user/:userId?', authMiddleware, getUserEnrollments);

// 检查用户是否已报名
router.get('/check/:periodId', authMiddleware, checkEnrollment);

// 退出期次
router.delete('/:enrollmentId', authMiddleware, withdrawEnrollment);

// 完成期次（管理员）
router.put('/:enrollmentId/complete', authMiddleware, adminMiddleware, completeEnrollment);

module.exports = router;
