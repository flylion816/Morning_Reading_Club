const { createNotification } = require('../controllers/notification.controller');
const subscribeMessageService = require('./subscribe-message.service');

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
    sourceId = null
  }
) {
  await createNotification(recipientUserId, notificationType, title, content, {
    wsManager: req.wsManager,
    senderId,
    data: {
      ...data,
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
