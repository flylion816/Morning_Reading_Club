const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const {
  getSectionsByPeriod,
  getSectionDetail,
  createSection,
  updateSection,
  deleteSection
} = require('../controllers/section.controller');

/**
 * @route   GET /api/v1/sections/period/:periodId
 * @desc    获取期次的课程列表
 * @access  Private
 */
router.get('/period/:periodId', authMiddleware, getSectionsByPeriod);

/**
 * @route   GET /api/v1/sections/:sectionId
 * @desc    获取课程详情
 * @access  Private
 */
router.get('/:sectionId', authMiddleware, getSectionDetail);

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
