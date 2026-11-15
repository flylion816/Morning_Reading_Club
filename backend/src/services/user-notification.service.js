const { createNotification } = require('../controllers/notification.controller');
const subscribeMessageService = require('./subscribe-message.service');
const buddyService = require('./buddy.service');
const logger = require('../utils/logger');

// 发送人是不是收件人的读伴：来信里用暖色卡片和「读伴」标记。查不到就当不是，不影响通知发送
async function resolveFromBuddy(senderId, recipientUserId) {
  try {
    return !!(await buddyService.areBuddies(senderId, recipientUserId));
  } catch (error) {
    logger.warn('读伴标记查询失败', { message: error && error.message });
    return false;
  }
}

async function dispatchNotificationWithSubscribe(
  req,
  {
    recipientUserId,
    notificationType,
    title,
    content,
    scene = null,
    targetPage = null,
    senderId = null,
    data = {},
    subscribeFields = {},
    sourceType = null,
    sourceId = null,
    requestId = null,
    upsertExistingNotification = false
  }
) {
  const fromBuddy = senderId ? await resolveFromBuddy(senderId, recipientUserId) : false;
  await createNotification(recipientUserId, notificationType, title, content, {
    wsManager: req.wsManager,
    requestId,
    senderId,
    upsertExisting: upsertExistingNotification,
    data: {
      ...data,
      ...(fromBuddy ? { fromBuddy: true } : {}),
      scene,
      targetPage
    }
  });

  if (scene) {
    await subscribeMessageService.sendSceneMessage({
      scene,
      recipientUserId,
      fields: subscribeFields,
      page: targetPage,
      sourceType,
      sourceId
    });
  }
}

module.exports = {
  dispatchNotificationWithSubscribe
};
