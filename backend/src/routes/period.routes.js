const express = require('express');
const router = express.Router();
const { authMiddleware, optionalAuthMiddleware, adminMiddleware } = require('../middleware/auth');
const { adminAuthMiddleware, optionalAdminAuthMiddleware } = require('../middleware/adminAuth');
const {
  getPeriodList,
  getPeriodListForUser,
  getPeriodDetail,
  getInviteInfo,
  createPeriod,
  updatePeriod,
  deletePeriod,
  copyPeriod,
  syncAllPeriodsStatus
} = require('../controllers/period.controller');
const {
  getSectionsByPeriod,
  getAllSectionsByPeriod,
  createSection,
  getSectionDetail,
  updateSection,
  deleteSection
} = require('../controllers/section.controller');
const {
  userTenantContext,
  adminTenantContext,
  publicTenantContext,
  optionalUserOrPublicTenantContext,
  optionalAdminOrPublicTenantContext
} = require('../middleware/tenantContext');

/**
 * @route   GET /api/v1/periods
 * @desc    获取期次列表（已登录时返回用户个人数据）
 * @access  Public
 */
router.get('/', optionalAuthMiddleware, optionalAdminAuthMiddleware, optionalAdminOrPublicTenantContext, (req, res, next) => {
  if (req.admin) {
    // 管理员请求：不过滤可见范围，返回全部期次
    getPeriodList(req, res, next);
  } else if (req.user) {
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
router.get('/user', authMiddleware, userTenantContext, getPeriodListForUser);

/**
 * @route   POST /api/v1/periods/sync-status
 * @desc    根据当前日期批量同步所有期次的 status 字段（管理员）
 * @access  Admin
 */
router.post('/sync-status', adminAuthMiddleware, adminTenantContext, syncAllPeriodsStatus);

/**
 * @route   GET /api/v1/periods/:periodId/invite-info
 * @desc    获取邀请落地页信息（期次信息+邀请人信息）
 * @access  Public
 */
router.get('/:periodId/invite-info', optionalAdminOrPublicTenantContext, getInviteInfo);

/**
 * @route   GET /api/v1/periods/:periodId
 * @desc    获取期次详情
 * @access  Public
 */
router.get('/:periodId', optionalAdminAuthMiddleware, optionalAdminOrPublicTenantContext, getPeriodDetail);

/**
 * @route   POST /api/v1/periods
 * @desc    创建期次（管理员）
 * @access  Admin
 */
router.post('/', adminAuthMiddleware, adminTenantContext, createPeriod);

/**
 * @route   PUT /api/v1/periods/:periodId
 * @desc    更新期次（管理员）
 * @access  Admin
 */
router.put('/:periodId', adminAuthMiddleware, adminTenantContext, updatePeriod);

/**
 * @route   DELETE /api/v1/periods/:periodId
 * @desc    删除期次（管理员）
 * @access  Admin
 */
router.delete('/:periodId', adminAuthMiddleware, adminTenantContext, deletePeriod);

/**
 * @route   POST /api/v1/periods/:id/copy
 * @desc    复制期次（包括其下的所有课节）（管理员）
 * @access  Admin
 */
router.post('/:id/copy', adminAuthMiddleware, adminTenantContext, copyPeriod);

// ===== 课节相关路由 =====

/**
 * @route   GET /api/v1/periods/:periodId/sections
 * @desc    获取某期次的所有课节（用户 - 仅已发布）
 * @access  Public
 */
router.get('/:periodId/sections', optionalAdminAuthMiddleware, optionalAdminOrPublicTenantContext, getSectionsByPeriod);

/**
 * @route   GET /api/v1/periods/:periodId/sections/admin/all
 * @desc    获取某期次的所有课节（管理员 - 包括草稿）
 * @access  Admin
 */
router.get(
  '/:periodId/sections/admin/all',
  adminAuthMiddleware,
  adminTenantContext,
  getAllSectionsByPeriod
);

/**
 * @route   POST /api/v1/periods/:periodId/sections
 * @desc    在某期次下创建课节（管理员）
 * @access  Admin
 */
router.post('/:periodId/sections', adminAuthMiddleware, adminTenantContext, createSection);

// ===== 用户相关路由 =====

module.exports = router;
