/**
 * 微信支付服务
 *
 * 处理微信支付相关操作：
 * - 调用微信统一下单 API 获取 prepayId
 * - 生成支付签名
 * - 返回前端所需的支付参数
 */

const crypto = require('crypto');
const axios = require('axios');
const logger = require('../utils/logger');

// 微信支付配置
const WECHAT_PAY_CONFIG = {
  // 微信公众平台 AppID
  appId: process.env.WECHAT_APPID || 'wx199d6d332344ed0a',
  // 微信商户号（需要从环境变量读取）
  mchId: process.env.WECHAT_MCH_ID || '1234567890',
  // API 秘钥（用于签名）
  apiKey: process.env.WECHAT_API_KEY || 'dev-api-key-for-testing-only',
  // API v3 秘钥（用于新 API）
  apiV3Key: process.env.WECHAT_API_V3_KEY || 'dev-api-v3-key-for-testing-only',
  // 证书路径（生产环境需要）
  certPath: process.env.WECHAT_CERT_PATH || '',
  keyPath: process.env.WECHAT_KEY_PATH || '',
  // 回调地址
  notifyUrl: process.env.WECHAT_NOTIFY_URL || 'https://wx.shubai01.com/api/v1/payments/wechat/callback'
};

/**
 * 调用微信统一下单 API（旧版本 MD5 签名）
 *
 * @param {Object} params 订单参数
 * @param {string} params.orderId 订单ID
 * @param {number} params.amount 金额（单位：分）
 * @param {string} params.body 商品描述
 * @param {string} params.detail 商品详情（可选）
 * @returns {Promise<Object>} 包含 prepayId 的响应
 */
async function unifiedOrder(params) {
  try {
    // 构造请求参数
    const requestData = {
      appid: WECHAT_PAY_CONFIG.appId,
      mch_id: WECHAT_PAY_CONFIG.mchId,
      nonce_str: generateNonceStr(),
      body: params.body || '晨读营课程费用',
      out_trade_no: params.orderId, // 商户订单号
      total_fee: params.amount, // 金额（分）
      spbill_create_ip: '127.0.0.1',
      notify_url: WECHAT_PAY_CONFIG.notifyUrl,
      trade_type: 'JSAPI', // 小程序支付
      openid: params.openid || ''
    };

    // 生成签名
    const sign = generateMD5Sign(requestData, WECHAT_PAY_CONFIG.apiKey);
    requestData.sign = sign;

    // 构造 XML 请求体
    const xmlBody = objectToXml(requestData);

    // 调用微信 API
    const response = await axios.post(
      'https://api.mch.weixin.qq.com/pay/unifiedorder',
      xmlBody,
      {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 10000
      }
    );

    // 解析 XML 响应
    const result = xmlToObject(response.data);

    if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
      return {
        success: true,
        prepayId: result.prepay_id,
        nonce_str: result.nonce_str
      };
    } else {
      logger.warn('WeChat unifiedOrder API failed', {
        return_code: result.return_code,
        result_code: result.result_code,
        err_code: result.err_code,
        err_code_des: result.err_code_des
      });
      return {
        success: false,
        error: result.err_code_des || 'WeChat API error'
      };
    }
  } catch (error) {
    logger.error('WeChat unifiedOrder API error', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 生成支付签名
 * 用于 wx.requestPayment() 调用时验证请求的合法性
 *
 * @param {Object} params 签名参数
 * @param {string} params.appId 小程序 AppID
 * @param {string} params.timeStamp 时间戳
 * @param {string} params.nonceStr 随机字符串
 * @param {string} params.prepayId 预支付交易会话 ID
 * @returns {string} MD5 签名
 */
function generatePaymentSignature(params) {
  // 小程序支付二次签名：字段名必须使用 camelCase（微信官方文档要求）
  const signData = {
    appId: params.appId,
    nonceStr: params.nonceStr,
    package: `prepay_id=${params.prepayId}`,
    signType: 'MD5',
    timeStamp: params.timeStamp
  };

  return generateMD5Sign(signData, WECHAT_PAY_CONFIG.apiKey);
}

/**
 * 为前端生成完整的支付参数
 * 用于小程序调用 wx.requestPayment()
 *
 * @param {string} prepayId 微信返回的预支付 ID
 * @returns {Object} 前端支付参数
 */
function generatePaymentParams(prepayId) {
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = generateNonceStr();

  const params = {
    appid: WECHAT_PAY_CONFIG.appId,
    timeStamp,
    nonceStr,
    prepayId,
    signType: 'MD5'
  };

  // 生成签名
  const paySign = generatePaymentSignature({
    appId: WECHAT_PAY_CONFIG.appId,
    timeStamp,
    nonceStr,
    prepayId
  });

  return {
    timeStamp,
    nonceStr,
    package: `prepay_id=${prepayId}`,
    signType: 'MD5',
    paySign
  };
}

/**
 * 生成 MD5 签名
 *
 * @param {Object} data 数据对象
 * @param {string} key API 密钥
 * @returns {string} MD5 签名（大写）
 */
function generateMD5Sign(data, key) {
  // 按 key 的字母顺序排列参数
  const keys = Object.keys(data)
    .filter(k => data[k] !== '' && data[k] !== null && data[k] !== undefined)
    .sort();

  // 构造签名字符串
  let signString = '';
  for (const k of keys) {
    signString += `${k}=${data[k]}&`;
  }
  signString += `key=${key}`;

  // 计算 MD5 哈希
  return crypto.createHash('md5').update(signString).digest('hex').toUpperCase();
}

/**
 * 生成随机字符串
 *
 * @param {number} length 长度
 * @returns {string} 随机字符串
 */
function generateNonceStr(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 将对象转换为 XML 字符串
 *
 * @param {Object} obj 数据对象
 * @returns {string} XML 字符串
 */
function objectToXml(obj) {
  let xml = '<xml>';
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (value !== null && value !== undefined && value !== '') {
        xml += `<${key}>${escapeXml(value.toString())}</${key}>`;
      }
    }
  }
  xml += '</xml>';
  return xml;
}

/**
 * 将 XML 字符串转换为对象
 * 简单的 XML 解析（仅用于微信支付 API 响应）
 *
 * @param {string} xml XML 字符串
 * @returns {Object} 数据对象
 */
function xmlToObject(xml) {
  const result = {};
  // 支持两种格式（用 alternation 区分）：
  // CDATA: <key><![CDATA[value]]></key>
  // 普通:  <key>value</key>（value 不含 < 字符）
  const regex = /<(\w+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+))<\/\1>/g;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    // match[2] 是 CDATA 内容，match[3] 是普通文本内容
    result[match[1]] = match[2] !== undefined ? match[2] : match[3];
  }

  return result;
}

/**
 * 转义 XML 特殊字符
 *
 * @param {string} str 输入字符串
 * @returns {string} 转义后的字符串
 */
function escapeXml(str) {
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  };

  return str.replace(/[&<>"']/g, char => escapeMap[char]);
}

/**
 * 验证微信支付回调签名
 *
 * @param {Object} params 回调参数
 * @returns {boolean} 签名是否有效
 */
function verifyNotifySign(params) {
  // 提取签名
  const sign = params.sign;
  const dataForSign = { ...params };
  delete dataForSign.sign;

  // 生成签名并对比
  const calculatedSign = generateMD5Sign(dataForSign, WECHAT_PAY_CONFIG.apiKey);
  return sign === calculatedSign;
}

module.exports = {
  unifiedOrder,
  generatePaymentSignature,
  generatePaymentParams,
  generateNonceStr,
  verifyNotifySign,
  xmlToObject,
  WECHAT_PAY_CONFIG
};
