const express = require('express');
const router = express.Router();
const {
  submitEnrollmentForm,
  enrollPeriod,
  getPeriodMembers,
  getUserEnrollments,
  checkEnrollment,
  withdrawEnrollment,
  completeEnrollment
} = require('../controllers/enrollment.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// 提交报名表单（包含完整信息）
router.post('/', authMiddleware, submitEnrollmentForm);

// 简化报名（仅periodId）
router.post('/simple', authMiddleware, enrollPeriod);

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
