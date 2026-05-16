const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { userTenantContext } = require('../middleware/tenantContext');
const {
  createCheckin,
  getUserCheckins,
  getUserCheckinSummary,
  getPeriodCheckins,
  getCheckinDetail,
  updateCheckin,
  deleteCheckin,
  getCheckins,
  likeCheckin,
  unlikeCheckin
} = require('../controllers/checkin.controller');

// 所有 checkin 路由都需要登录 + 租户上下文
router.use(authMiddleware, userTenantContext);

/**
 * @route   POST /api/v1/checkins
 * @desc    创建打卡记录
 * @access  Private
 */
router.post('/', createCheckin);

/**
 * @route   GET /api/v1/checkins
 * @desc    获取打卡列表（支持按periodId过滤）
 * @access  Private
 */
router.get('/', getCheckins);

/**
 * @route   GET /api/v1/checkins/user/summary
 * @desc    获取当前用户的打卡日记聚合信息
 * @access  Private
 */
router.get('/user/summary', getUserCheckinSummary);

/**
 * @route   GET /api/v1/checkins/user/:userId/summary
 * @desc    获取指定用户的打卡日记聚合信息
 * @access  Private
 */
router.get('/user/:userId/summary', getUserCheckinSummary);

/**
 * @route   GET /api/v1/checkins/user/:userId?
 * @desc    获取用户的打卡列表
 * @access  Private
 */
router.get('/user/:userId?', getUserCheckins);

/**
 * @route   GET /api/v1/checkins/period/:periodId
 * @desc    获取期次的打卡列表（广场）
 * @access  Private
 */
router.get('/period/:periodId', getPeriodCheckins);

/**
 * @route   POST /api/v1/checkins/:checkinId/like
 * @desc    点赞打卡记录
 * @access  Private
 */
router.post('/:checkinId/like', likeCheckin);

/**
 * @route   DELETE /api/v1/checkins/:checkinId/like
 * @desc    取消点赞打卡记录
 * @access  Private
 */
router.delete('/:checkinId/like', unlikeCheckin);

/**
 * @route   GET /api/v1/checkins/:checkinId
 * @desc    获取打卡详情
 * @access  Private
 */
router.get('/:checkinId', getCheckinDetail);

/**
 * @route   PUT /api/v1/checkins/:checkinId
 * @desc    更新打卡记录
 * @access  Private
 */
router.put('/:checkinId', updateCheckin);

/**
 * @route   DELETE /api/v1/checkins/:checkinId
 * @desc    删除打卡记录
 * @access  Private
 */
router.delete('/:checkinId', deleteCheckin);

module.exports = router;
