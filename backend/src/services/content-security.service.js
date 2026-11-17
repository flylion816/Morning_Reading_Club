/**
 * 微信内容安全：文本检查（msg_sec_check 2.0 版）。
 *
 * 只有微信明确判定 pass 的文本才算通过。违规或存疑算「没通过」（CONTENT_RISKY）；
 * 出错、超时、返回了无法识别的结果算「服务不可用」（CONTENT_CHECK_UNAVAILABLE）。
 * 调用方据此决定返回 400 还是 503，两种情况都不放行。
 * 日志里不记原文，只记 trace_id 和结论。
 *
 * 2.0 需要发送者的 openid（官方要求该用户近期访问过小程序），场景取「评论」。
 * 参数和限制以微信官方文档为准。
 */
const axios = require('axios');
const subscribeMessageService = require('./subscribe-message.service');
const logger = require('../utils/logger');

const MSG_SEC_CHECK_URL = 'https://api.weixin.qq.com/wxa/msg_sec_check';
const REQUEST_TIMEOUT_MS = 5000;
// 场景：1 资料，2 评论，3 论坛，4 社交日志
const SCENE_COMMENT = 2;
const CONTENT_RISKY = 'CONTENT_RISKY';
const CONTENT_CHECK_UNAVAILABLE = 'CONTENT_CHECK_UNAVAILABLE';
// 40001 令牌无效、42001 令牌过期：清掉缓存后重试一次
const TOKEN_ERROR_CODES = new Set([40001, 42001]);
// 内容违规（旧版接口的返回，2.0 偶尔也会直接给出）
const ERRCODE_RISKY = 87014;

function checkError(code, message) {
  const error = new Error(message);
  error.name = 'ContentCheckError';
  error.code = code;
  return error;
}

async function postCheck(payload) {
  const accessToken = await subscribeMessageService.getAccessToken();
  const response = await axios.post(`${MSG_SEC_CHECK_URL}?access_token=${accessToken}`, payload, {
    timeout: REQUEST_TIMEOUT_MS
  });
  return (response && response.data) || {};
}

/**
 * 检查一段文本。通过时返回 { traceId }；没通过或检查不了都会抛出带 code 的错误。
 */
async function checkText({ openid, content, scene = SCENE_COMMENT } = {}) {
  if (!openid || typeof content !== 'string' || !content) {
    throw checkError(CONTENT_CHECK_UNAVAILABLE, '缺少检查所需的信息');
  }

  const payload = { version: 2, openid, scene, content };
  let data;
  try {
    data = await postCheck(payload);
    if (TOKEN_ERROR_CODES.has(Number(data.errcode))) {
      subscribeMessageService.clearAccessTokenCache();
      data = await postCheck(payload);
    }
  } catch (error) {
    logger.warn('内容安全检查请求失败', { message: error && error.message });
    throw checkError(CONTENT_CHECK_UNAVAILABLE, '内容安全检查暂时不可用');
  }

  const errcode = Number(data.errcode || 0);
  const result = data.result || {};
  if (errcode === ERRCODE_RISKY || result.suggest === 'risky' || result.suggest === 'review') {
    logger.info('内容安全检查未通过', { traceId: data.trace_id, suggest: result.suggest, label: result.label });
    throw checkError(CONTENT_RISKY, '内容没有通过检查');
  }
  if (errcode === 0 && result.suggest === 'pass') {
    return { traceId: data.trace_id };
  }

  logger.warn('内容安全检查返回了无法识别的结果', { errcode, errmsg: data.errmsg, traceId: data.trace_id });
  throw checkError(CONTENT_CHECK_UNAVAILABLE, '内容安全检查暂时不可用');
}

module.exports = { checkText, CONTENT_RISKY, CONTENT_CHECK_UNAVAILABLE, SCENE_COMMENT };
