const mongoose = require('mongoose');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const subscriptionDebugService = require('../services/admin-subscription-debug.service');

async function getSubscriptionGrantList(req, res) {
  try {
    const result = await subscriptionDebugService.buildSubscriptionDebugDataset(req.query || {});
    return res.json(success(result, '获取成功'));
  } catch (error) {
    logger.error('Get admin subscription grant list error', error);
    return res.status(500).json(errors.serverError('获取订阅消息排查列表失败'));
  }
}

async function getSubscriptionGrantDetail(req, res) {
  try {
    const { userId } = req.params;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json(errors.badRequest('无效的用户ID'));
    }

    const result = await subscriptionDebugService.getSubscriptionDebugUserDetail(
      userId,
      req.query || {}
    );

    if (!result) {
      return res.status(404).json(errors.notFound('用户不存在'));
    }

    return res.json(success(result, '获取成功'));
  } catch (error) {
    logger.error('Get admin subscription grant detail error', error);
    return res.status(500).json(errors.serverError('获取订阅消息排查详情失败'));
  }
}

module.exports = {
  getSubscriptionGrantList,
  getSubscriptionGrantDetail
};
