/**
 * 生成小程序码（getwxacodeunlimit）。阅读分享、随喜/觉察分享共用。
 * scene 最长 32 个字符；check_path 关闭，页面还没发布正式版时用 envVersion 指定体验版或开发版。
 */
const QR_ENV_VERSIONS = { develop: 'develop', trial: 'trial', release: 'release' };

function normalizeEnvVersion(value) {
  return QR_ENV_VERSIONS[value] || 'release';
}

async function requestWxacode({ scene, page, envVersion = 'release', width = 280 }) {
  const axios = require('axios');
  const subscribeMessageService = require('./subscribe-message.service');
  const accessToken = await subscribeMessageService.getAccessToken();
  const response = await axios.post(
    `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`,
    { scene, page, check_path: false, env_version: normalizeEnvVersion(envVersion), width },
    { responseType: 'arraybuffer', timeout: 8000 }
  );
  const contentType = String((response.headers && response.headers['content-type']) || '');
  if (!contentType.startsWith('image/')) {
    let detail = '';
    try {
      detail = Buffer.from(response.data).toString('utf8').slice(0, 200);
    } catch (error) {
      detail = '';
    }
    throw new Error(`getwxacodeunlimit 失败: ${detail}`);
  }
  return Buffer.from(response.data).toString('base64');
}

module.exports = { requestWxacode, normalizeEnvVersion, QR_ENV_VERSIONS };
