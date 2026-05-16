const crypto = require('crypto');
const axios = require('axios');
const logger = require('../utils/logger');

const WECHAT_API_BASE = 'https://api.weixin.qq.com/cgi-bin';
const CACHE_SAFETY_SECONDS = 300;

let accessTokenCache = null;
let jsapiTicketCache = null;

function getWechatConfig() {
  return {
    appId: process.env.WECHAT_MP_APPID || process.env.WECHAT_APPID,
    secret: process.env.WECHAT_MP_SECRET || process.env.WECHAT_SECRET
  };
}

function getAllowedHosts() {
  const raw = process.env.WECHAT_JS_ALLOWED_HOSTS || 'wx.shubai01.com,localhost,127.0.0.1';
  return raw
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);
}

function validateShareUrl(rawUrl) {
  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    throw new Error('无效的页面地址');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('页面地址协议不支持');
  }

  const host = parsed.hostname.toLowerCase();
  if (!getAllowedHosts().includes(host)) {
    throw new Error('页面地址域名不允许');
  }

  parsed.hash = '';
  return parsed.toString();
}

function isCacheValid(cache) {
  return cache && cache.expiresAt > Date.now();
}

function buildExpiresAt(expiresIn) {
  const safeExpiresIn = Math.max(Number(expiresIn || 7200) - CACHE_SAFETY_SECONDS, 60);
  return Date.now() + safeExpiresIn * 1000;
}

async function getAccessToken() {
  if (isCacheValid(accessTokenCache)) {
    return accessTokenCache.value;
  }

  const { appId, secret } = getWechatConfig();
  if (!appId || !secret) {
    throw new Error('未配置 WECHAT_MP_APPID/WECHAT_MP_SECRET 或 WECHAT_APPID/WECHAT_SECRET');
  }

  const response = await axios.get(`${WECHAT_API_BASE}/token`, {
    params: {
      grant_type: 'client_credential',
      appid: appId,
      secret
    },
    timeout: 5000
  });

  if (response.data.errcode) {
    logger.error('获取微信 access_token 失败', null, {
      errcode: response.data.errcode,
      errmsg: response.data.errmsg
    });
    throw new Error('获取微信 access_token 失败');
  }

  accessTokenCache = {
    value: response.data.access_token,
    expiresAt: buildExpiresAt(response.data.expires_in)
  };

  return accessTokenCache.value;
}

async function getJsapiTicket() {
  if (isCacheValid(jsapiTicketCache)) {
    return jsapiTicketCache.value;
  }

  const accessToken = await getAccessToken();
  const response = await axios.get(`${WECHAT_API_BASE}/ticket/getticket`, {
    params: {
      access_token: accessToken,
      type: 'jsapi'
    },
    timeout: 5000
  });

  if (response.data.errcode !== 0) {
    logger.error('获取微信 jsapi_ticket 失败', null, {
      errcode: response.data.errcode,
      errmsg: response.data.errmsg
    });
    throw new Error('获取微信 jsapi_ticket 失败');
  }

  jsapiTicketCache = {
    value: response.data.ticket,
    expiresAt: buildExpiresAt(response.data.expires_in)
  };

  return jsapiTicketCache.value;
}

async function createJssdkSignature(rawUrl) {
  const url = validateShareUrl(rawUrl);
  const ticket = await getJsapiTicket();
  const { appId } = getWechatConfig();
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000);
  const signPayload = [
    `jsapi_ticket=${ticket}`,
    `noncestr=${nonceStr}`,
    `timestamp=${timestamp}`,
    `url=${url}`
  ].join('&');

  const signature = crypto.createHash('sha1').update(signPayload).digest('hex');

  return {
    appId,
    timestamp,
    nonceStr,
    signature,
    url
  };
}

function __resetCache() {
  accessTokenCache = null;
  jsapiTicketCache = null;
}

module.exports = {
  createJssdkSignature,
  validateShareUrl,
  __resetCache
};
