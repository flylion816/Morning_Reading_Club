const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const {
  getPeriodList,
  getPeriodDetail,
  createPeriod,
  updatePeriod,
  deletePeriod
} = require('../controllers/period.controller');

/**
 * @route   GET /api/v1/periods
 * @desc    获取期次列表
 * @access  Private
 */
router.get('/', authMiddleware, getPeriodList);

/**
 * @route   GET /api/v1/periods/:periodId
 * @desc    获取期次详情
 * @access  Private
 */
router.get('/:periodId', authMiddleware, getPeriodDetail);

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

module.exports = router;
