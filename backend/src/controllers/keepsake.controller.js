const mongoose = require('mongoose');
const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const { ensurePeriodCommunityAccess } = require('../services/community-access.service');
const keepsakeService = require('../services/keepsake.service');

function getRequestUserId(req) {
  return req.user?.id || req.user?.userId || req.user?._id;
}

async function getPeriodKeepsake(req, res) {
  try {
    const userId = getRequestUserId(req);
    const { periodId } = req.params;
    if (!userId) {
      return res.status(401).json(errors.unauthorized('请先登录'));
    }

    if (!mongoose.Types.ObjectId.isValid(periodId)) {
      return res.status(400).json(errors.badRequest('期次参数不正确'));
    }

    if (!(await ensurePeriodCommunityAccess(res, userId, periodId))) return;

    const data = await keepsakeService.getPeriodKeepsake(userId, periodId);
    if (!data) {
      return res.status(404).json(errors.notFound('期次不存在'));
    }
    return res.json(success(data));
  } catch (error) {
    logger.error('获取结营纪念册失败:', error);
    return res.status(500).json(errors.serverError('获取结营纪念册失败'));
  }
}

module.exports = { getPeriodKeepsake };
