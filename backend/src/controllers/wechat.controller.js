const { success, errors } = require('../utils/response');
const wechatJssdkService = require('../services/wechat-jssdk.service');
const logger = require('../utils/logger');

async function getJssdkSignature(req, res, next) {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json(errors.badRequest('缺少 url 参数'));
    }

    const signature = await wechatJssdkService.createJssdkSignature(url);
    return res.json(success(signature));
  } catch (error) {
    if (error.message && error.message.includes('配置')) {
      logger.error('微信 JSSDK 配置缺失', error);
      return res.status(503).json(errors.serviceUnavailable('微信分享配置不可用'));
    }

    if (error.message && error.message.includes('页面地址')) {
      return res.status(400).json(errors.badRequest(error.message));
    }

    return next(error);
  }
}

function reportJssdkEvent(req, res) {
  const event = String(req.query.event || '').slice(0, 80);
  const detail = String(req.query.detail || '').slice(0, 800);

  logger.info('微信 JSSDK 页面诊断', {
    event,
    detail,
    url: req.query.url || null,
    userAgent: req.get('user-agent'),
    ip: req.ip
  });

  return res.json(success({ received: true }));
}

module.exports = {
  getJssdkSignature,
  reportJssdkEvent
};
