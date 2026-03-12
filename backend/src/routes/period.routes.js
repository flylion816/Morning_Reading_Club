const express = require('express');
const router = express.Router();
const { authMiddleware, optionalAuthMiddleware, adminMiddleware } = require('../middleware/auth');
const {
  getPeriodList,
  getPeriodListForUser,
  getPeriodDetail,
  createPeriod,
  updatePeriod,
  deletePeriod,
  copyPeriod
} = require('../controllers/period.controller');
const {
  getSectionsByPeriod,
  getAllSectionsByPeriod,
  createSection,
  getSectionDetail,
  updateSection,
  deleteSection
} = require('../controllers/section.controller');

/**
 * @route   GET /api/v1/periods
 * @desc    获取期次列表（已登录时返回用户个人数据）
 * @access  Public
 */
router.get('/', optionalAuthMiddleware, (req, res, next) => {
  // 如果成功通过认证，使用认证版本；否则使用公开版本
  if (req.user) {
    getPeriodListForUser(req, res, next);
  } else {
    getPeriodList(req, res, next);
  }
});

/**
 * @route   GET /api/v1/periods/user
 * @desc    获取用户的期次列表（包含用户个人的打卡统计）
 * @access  Private
 */
router.get('/user', authMiddleware, getPeriodListForUser);

/**
 * @route   GET /api/v1/periods/:periodId
 * @desc    获取期次详情
 * @access  Public
 */
router.get('/:periodId', getPeriodDetail);

/**
 * @route   POST /api/v1/periods
 * @desc    创建期次（管理员）
 * @access  Admin
 */
router.post('/', authMiddleware, adminMiddleware, createPeriod);

/**
 * @route   PUT /api/v1/periods/:periodId
 * @desc    更新期次（管理员）
 * @access  Admin
 */
router.put('/:periodId', authMiddleware, adminMiddleware, updatePeriod);

/**
 * @route   DELETE /api/v1/periods/:periodId
 * @desc    删除期次（管理员）
 * @access  Admin
 */
router.delete('/:periodId', authMiddleware, adminMiddleware, deletePeriod);

/**
 * @route   POST /api/v1/periods/:id/copy
 * @desc    复制期次（包括其下的所有课节）（管理员）
 * @access  Admin
 */
router.post('/:id/copy', authMiddleware, adminMiddleware, copyPeriod);

// ===== 课节相关路由 =====

/**
 * @route   GET /api/v1/periods/:periodId/sections
 * @desc    获取某期次的所有课节（用户 - 仅已发布）
 * @access  Public
 */
router.get('/:periodId/sections', getSectionsByPeriod);

/**
 * @route   GET /api/v1/periods/:periodId/sections/admin/all
 * @desc    获取某期次的所有课节（管理员 - 包括草稿）
 * @access  Admin
 */
router.get(
  '/:periodId/sections/admin/all',
  authMiddleware,
  adminMiddleware,
  getAllSectionsByPeriod
);

/**
 * @route   POST /api/v1/periods/:periodId/sections
 * @desc    在某期次下创建课节（管理员）
 * @access  Admin
 */
router.post('/:periodId/sections', authMiddleware, adminMiddleware, createSection);

// ===== 用户相关路由 =====

module.exports = router;
