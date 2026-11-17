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
// 结束读伴：给对方一条很轻的来信，不写是谁主动结束的
const leaveBuddy = handler(async (req, userId, periodId) => {
  let buddyId = null;
  try {
    buddyId = await buddyService.getActiveBuddyId(userId, periodId);
  } catch (error) {
    buddyId = null;
  }
  const state = await buddyService.leave(userId, periodId);
  if (buddyId) {
    await notifyBuddy(req, userId, periodId, buddyId, 'buddy_ended', '你们的这段读伴结束了', '这段同行到这里了，想的话可以再认识一位', state);
  }
  return state;
});

const getBuddySouvenir = handler((req, userId, periodId) => buddyService.getSouvenir(userId, periodId));
const rematchBuddy = handler((req, userId, periodId) => buddyService.rematch(userId, periodId));

// 通知失败不影响主流程；标题带上期次名，两期各有读伴时不会混
async function notifyBuddy(req, userId, periodId, buddyUserId, type, title, content, state, extra = {}) {
  try {
    const periodName = state && state.periodName;
    await createNotification(buddyUserId, type, periodName ? `${title} · ${periodName}` : title, content, {
      wsManager: req.wsManager,
      senderId: userId,
      data: { periodId: String(periodId), targetPage: `/pages/buddy/buddy?periodId=${periodId}`, ...extra }
    });
  } catch (error) {
    logger.warn('读伴通知发送失败', { type, message: error.message });
  }
}

const nudgeBuddy = handler(async (req, userId, periodId) => {
  const { state, buddyUserId, senderName, nudgeText } = await buddyService.nudge(
    userId,
    periodId,
    new Date(),
    req.body?.messageKey
  );
  await notifyBuddy(req, userId, periodId, buddyUserId, 'buddy_nudge', '你的读伴轻拍了你一下', `${senderName}${nudgeText || '在等你一起读'}`, state);
  return state;
});

const highFiveBuddy = handler(async (req, userId, periodId) => {
  const { state, buddyUserId, senderName } = await buddyService.highFive(userId, periodId);
  await notifyBuddy(req, userId, periodId, buddyUserId, 'buddy_highfive', '你的读伴和你击了个掌', `${senderName}说：今天我们都读完了`, state);
  return state;
});

const giftBuddy = handler(async (req, userId, periodId) => {
  // messageKey（预设短句）和 text（自己写的话）二选一，由服务层校验
  const { state, buddyUserId, senderName, giftText } = await buddyService.gift(userId, periodId, {
    messageKey: req.body?.messageKey,
    text: req.body?.text
  });
  await notifyBuddy(req, userId, periodId, buddyUserId, 'buddy_gift', '你的读伴送了你一句话', `${senderName}：「${giftText}」`, state);
  return state;
});

const reactBuddy = handler(async (req, userId, periodId) => {
  const { state, buddyUserId, senderName, reactionText, checkinId, sectionId } = await buddyService.react(
    userId,
    periodId,
    req.body?.checkinId,
    req.body?.messageKey
  );
  await notifyBuddy(
    req,
    userId,
    periodId,
    buddyUserId,
    'buddy_reaction',
    '你的读伴回应了你的打卡',
    `${senderName}：「${reactionText}」`,
    state,
    {
      checkinId: String(checkinId),
      sectionId: String(sectionId),
      targetPage: `/pages/course-detail/course-detail?id=${sectionId}&periodId=${periodId}&checkinId=${checkinId}&focus=comments`
    }
  );
  return state;
});

const listBuddyCandidates = async (req, res) => {
  try {
    const result = await buddyService.listCandidates(getRequestUserId(req), req.params.periodId, {
      q: req.query?.q,
      page: req.query?.page
    });
    return res.json(success(result));
  } catch (error) {
    return sendError(res, error);
  }
};

const inviteBuddy = handler(async (req, userId, periodId) => {
  const result = await buddyService.invite(userId, periodId, req.body?.targetUserId);
  if (result.autoAccepted) {
    await notifyBuddy(req, userId, periodId, result.buddyUserId, 'buddy_invite_accepted', '你的读伴邀请被同意了', `${result.senderName}同意了你的邀请，你们成为读伴了`, result.state);
  } else {
    await notifyBuddy(req, userId, periodId, result.targetUserId, 'buddy_invite', '有书友邀请你做读伴', `${result.senderName}邀请你做读伴`, result.state, {
      inviteId: result.inviteId
    });
  }
  return result.state;
});

const respondBuddyInvite = handler(async (req, userId, periodId) => {
  const accept = req.body?.accept === true;
  const result = await buddyService.respondInvite(userId, periodId, req.params.inviteId, accept);
  if (result.accepted) {
    await notifyBuddy(req, userId, periodId, result.buddyUserId, 'buddy_invite_accepted', '你的读伴邀请被同意了', `${result.senderName}同意了你的邀请，你们成为读伴了`, result.state);
  }
  return result.state;
});

const setBuddyDiscoverable = async (req, res) => {
  try {
    const data = await buddyService.setDiscoverable(getRequestUserId(req), req.body?.discoverable !== false);
    return res.json(success(data));
  } catch (error) {
    return sendError(res, error);
  }
};

const cancelBuddyInvite = handler((req, userId, periodId) => buddyService.cancelInvite(userId, periodId, req.params.inviteId));

module.exports = {
  getBuddyState,
  getBuddyOverview,
  getBuddySouvenir,
  joinBuddy,
  cancelBuddy,
  nudgeBuddy,
  leaveBuddy,
  rematchBuddy,
  highFiveBuddy,
  giftBuddy,
  reactBuddy,
  listBuddyCandidates,
  inviteBuddy,
  respondBuddyInvite,
  cancelBuddyInvite,
  setBuddyDiscoverable
};
