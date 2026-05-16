const express = require('express');

const router = express.Router();
const {
  authMiddleware,
  optionalAuthMiddleware,
  adminMiddleware
} = require('../middleware/auth');
const {
  userTenantContext,
  publicTenantContext,
  optionalUserOrPublicTenantContext
} = require('../middleware/tenantContext');
const {
  getSectionsByPeriod,
  getSectionDetail,
  markReadingCompletion,
  createSection,
  updateSection,
  deleteSection,
  getTodayTask
} = require('../controllers/section.controller');

/**
 * @route   GET /api/v1/sections/today/task
 * @desc    获取今日任务（根据当前日期动态计算）
 * @access  Protected
 */
router.get('/today/task', authMiddleware, userTenantContext, getTodayTask);

/**
 * @route   GET /api/v1/sections/period/:periodId
 * @desc    获取期次的课程列表
 * @access  Public / Optional Auth
 */
router.get('/period/:periodId', optionalAuthMiddleware, optionalUserOrPublicTenantContext, getSectionsByPeriod);

/**
 * @route   POST /api/v1/sections/:sectionId/reading-completion
 * @desc    标记当前用户完成课节沉浸阅读
 * @access  Protected
 */
router.post('/:sectionId/reading-completion', authMiddleware, userTenantContext, markReadingCompletion);

/**
 * @route   GET /api/v1/sections/:sectionId
 * @desc    获取课程详情
 * @access  Public / Optional Auth
 */
router.get('/:sectionId', optionalAuthMiddleware, optionalUserOrPublicTenantContext, getSectionDetail);

/**
 * @route   POST /api/v1/sections
 * @desc    创建课程（管理员）
 * @access  Admin
 */
router.post('/', authMiddleware, userTenantContext, adminMiddleware, createSection);

/**
 * @route   PUT /api/v1/sections/:sectionId
 * @desc    更新课程（管理员）
 * @access  Admin
 */
router.put('/:sectionId', authMiddleware, userTenantContext, adminMiddleware, updateSection);

/**
 * @route   DELETE /api/v1/sections/:sectionId
 * @desc    删除课程（管理员）
 * @access  Admin
 */
router.delete('/:sectionId', authMiddleware, userTenantContext, adminMiddleware, deleteSection);

module.exports = router;
