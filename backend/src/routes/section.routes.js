const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const {
  getSectionsByPeriod,
  getSectionDetail,
  createSection,
  updateSection,
  deleteSection,
  getTodayTask
} = require('../controllers/section.controller');

/**
 * @route   GET /api/v1/sections/today/task
 * @desc    获取今日任务（根据当前日期动态计算）
 * @access  Public
 */
router.get('/today/task', getTodayTask);

/**
 * @route   GET /api/v1/sections/period/:periodId
 * @desc    获取期次的课程列表
 * @access  Public
 */
router.get('/period/:periodId', getSectionsByPeriod);

/**
 * @route   GET /api/v1/sections/:sectionId
 * @desc    获取课程详情
 * @access  Public
 */
router.get('/:sectionId', getSectionDetail);

/**
 * @route   POST /api/v1/sections
 * @desc    创建课程（管理员）
 * @access  Admin
 */
router.post('/', authMiddleware, adminMiddleware, createSection);

/**
 * @route   PUT /api/v1/sections/:sectionId
 * @desc    更新课程（管理员）
 * @access  Admin
 */
router.put('/:sectionId', authMiddleware, adminMiddleware, updateSection);

/**
 * @route   DELETE /api/v1/sections/:sectionId
 * @desc    删除课程（管理员）
 * @access  Admin
 */
router.delete('/:sectionId', authMiddleware, adminMiddleware, deleteSection);

module.exports = router;
