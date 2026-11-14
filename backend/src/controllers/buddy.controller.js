const { success, errors } = require('../utils/response');
const logger = require('../utils/logger');
const buddyService = require('../services/buddy.service');
const { createNotification } = require('./notification.controller');

function getRequestUserId(req) {
  return req.user?.id || req.user?.userId || req.user?._id;
}

function sendError(res, error) {
  if (error && error.isBuddyError) {
    const factory = errors[error.kind] || errors.badRequest;
    return res.status(error.status).json(factory(error.message));
  }
  logger.error('读伴接口异常', { message: error && error.message });
  return res.status(500).json(errors.serverError('读伴暂时不可用，请稍后再试'));
}

function handler(run) {
  return async (req, res) => {
    try {
      const data = await run(req, getRequestUserId(req), req.params.periodId);
      return res.json(success(data));
    } catch (error) {
      return sendError(res, error);
    }
  };
}

const getBuddyState = handler((req, userId, periodId) => buddyService.getState(userId, periodId));
const getBuddyOverview = handler((req, userId, periodId) => buddyService.getOverview(userId, periodId));
const joinBuddy = handler((req, userId, periodId) => buddyService.join(userId, periodId));
const cancelBuddy = handler((req, userId, periodId) => buddyService.cancel(userId, periodId));
const leaveBuddy = handler((req, userId, periodId) => buddyService.leave(userId, periodId));

const nudgeBuddy = handler(async (req, userId, periodId) => {
  const { state, buddyUserId, senderName, nudgeText } = await buddyService.nudge(
    userId,
    periodId,
    new Date(),
    req.body?.messageKey
  );
  try {
    await createNotification(
      buddyUserId,
      'buddy_nudge',
      '你的读伴轻拍了你一下',
      `${senderName}${nudgeText || '在等你一起读'}`,
      {
        wsManager: req.wsManager,
        senderId: userId,
        data: { periodId: String(periodId), targetPage: `/pages/buddy/buddy?periodId=${periodId}` }
      }
    );
  } catch (error) {
    logger.warn('读伴轻拍通知发送失败', { message: error.message });
  }
  return state;
});

module.exports = { getBuddyState, getBuddyOverview, joinBuddy, cancelBuddy, nudgeBuddy, leaveBuddy };
