const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * 微信认证服务
 * 支持开发环境（Mock）和生产环境（真实微信API）的自动切换
 *
 * 使用场景：
 * - NODE_ENV === 'development' | 'test': 使用 Mock 登录，无需真实微信凭证
 * - NODE_ENV === 'production': 调用微信官方 jscode2session API，获取真实的 openid
 */
class WechatService {
  constructor() {
    this.wechatApiUrl = 'https://api.weixin.qq.com/sns/jscode2session';
    // 预定义的测试用户，用于开发环境快速切换身份
    this.testUsers = {
      test_user_atai: {
        openid: 'mock_user_001',
        nickname: '阿泰'
      },
      test_user_liming: {
        openid: 'mock_user_002',
        nickname: '狮子'
      },
      test_user_wangwu: {
        openid: 'mock_user_003',
        nickname: '王五'
      },
      test_user_admin: {
        openid: 'mock_admin_001',
        nickname: '管理员'
      }
    };
  }

  /**
   * 统一入口：根据环境自动选择 Mock 或真实登录
   * @param {string} code 微信授权码
   * @param {Object} ctx 可选，{ appId, tenantId } 多租户上下文
   * @returns {Promise<{openid: string, session_key: string, unionid?: string}>}
   */
  async getOpenidFromCode(code, ctx = {}) {
    const env = process.env.NODE_ENV;

    try {
      if (env === 'development' || env === 'test') {
        return await this.getMockOpenid(code);
      }
      if (env === 'production') {
        return await this.getRealOpenid(code, ctx);
      }
      throw new Error(`未知环境: ${env}`);
    } catch (error) {
      logger.error('获取openid失败', error, {
        environment: env,
        code: WechatService.maskSensitive(code)
      });
      throw error;
    }
  }

  /**
   * 真实微信登录：调用微信官方 jscode2session API
   * 生产环境使用，需要真实的 WECHAT_APPID 和 WECHAT_SECRET
   *
   * @param {string} code 临时登录凭证，由微信小程序 wx.login() 获取
   * @param {Object} ctx 可选，{ appId, tenantId } 多租户上下文
   * @returns {Promise<{openid: string, session_key: string, unionid?: string}>}
   * @throws {Error} 微信API调用失败时抛出错误
   */
  async getRealOpenid(code, { appId, tenantId } = {}) {
    // 优先使用调用方传入的 appId（多租户路径）
    // 兼容性：未传入则回退到环境变量（仅供单租户老配置）
    const useAppId = appId || process.env.WECHAT_APPID;

    // 通过 tenantId 查 Tenant 拿登录 secret。登录凭证和支付凭证必须分开。
    const Tenant = require('../models/Tenant');
    let secret = process.env.WECHAT_SECRET;
    if (tenantId) {
      const tenant = await Tenant.findById(tenantId)
        .select('+wechatLogin.appSecret wechatLogin')
        .lean();
      secret = tenant?.wechatLogin?.appSecret || process.env.WECHAT_SECRET;
      // 放宽校验：允许 useAppId 在以下任一处出现：
      //  - tenant.wechatLogin.appId（主登录 appId）
      //  - tenant.wxAppIds[]（同租户名下多个小程序 appId）
      const validAppIds = new Set(
        [tenant?.wechatLogin?.appId, ...(tenant?.wxAppIds || [])].filter(Boolean)
      );
      if (validAppIds.size > 0 && !validAppIds.has(useAppId)) {
        throw new Error(`wxAppId ${useAppId} 不属于租户 ${tenant.slug || tenantId} 配置`);
      }
    }
    if (!useAppId || !secret) {
      throw new Error('租户未配置微信登录凭证');
    }

    try {
      logger.info('开始调用微信 jscode2session API', {
        appid: `${useAppId.substring(0, 8)}***`,
        code: WechatService.maskSensitive(code)
      });

      // 调用微信官方API
      const response = await axios.get(this.wechatApiUrl, {
        params: {
          appid: useAppId,
          secret,
          js_code: code,
          grant_type: 'authorization_code'
        },
        timeout: 5000
      });

      // 处理微信API错误
      if (response.data.errcode) {
        WechatService.handleWechatError(response.data, code);
      }

      logger.info('微信 jscode2session API 调用成功', {
        openid: WechatService.maskSensitive(response.data.openid),
        hasSessionKey: !!response.data.session_key,
        hasUnionid: !!response.data.unionid
      });

      return {
        openid: response.data.openid,
        session_key: response.data.session_key,
        unionid: response.data.unionid || null
      };
    } catch (error) {
      // 如果已经是业务错误（来自 Tenant 校验或微信 API 错误处理），直接抛出
      if (error.message.includes('不属于租户') || error.message.includes('未配置微信登录凭证')) {
        throw error;
      }

      // 网络错误或超时
      if (error.code === 'ECONNABORTED') {
        const errorMsg = '微信API请求超时，请稍后重试';
        logger.error(errorMsg, error, { code: WechatService.maskSensitive(code) });
        throw new Error(errorMsg);
      }

      if (error.response) {
        const errorMsg = `微信API错误: ${error.response.status} ${error.response.statusText}`;
        logger.error(errorMsg, error, {
          status: error.response.status,
          data: error.response.data,
          code: WechatService.maskSensitive(code)
        });
        throw new Error('微信服务异常，请稍后重试');
      }

      const errorMessage = error.message || String(error);
      logger.error('微信API调用异常', error, {
        code: WechatService.maskSensitive(code),
        errorMessage,
        errorName: error.name,
        hasResponse: !!error.response,
        hasRequest: !!error.request
      });
      if (errorMessage.includes('timeout')) {
        throw new Error('微信API请求超时，请稍后重试');
      }
      throw new Error('登录失败，请检查网络并重试');
    }
  }

  /**
   * Mock登录：开发和测试环境使用
   * 不需要真实微信凭证，返回虚拟的 openid
   *
   * @param {string} code 临时登录凭证（在开发环境中仅用于识别）
   * @returns {Promise<{openid: string, session_key: string}>}
   */
  async getMockOpenid(code) {
    try {
      // 检查是否是预定义的测试用户
      if (this.testUsers[code]) {
        const testUser = this.testUsers[code];
        logger.info('使用预定义的测试用户登录', {
          code: WechatService.maskSensitive(code),
          openid: testUser.openid,
          nickname: testUser.nickname
        });

        return {
          openid: testUser.openid,
          session_key: `mock_session_key_${Date.now()}`,
          unionid: null
        };
      }

      // 对非预定义的code，基于MD5生成一致的虚拟openid
      // 同一个code总是返回同一个openid，便于开发测试
      const hash = crypto.createHash('md5').update(String(code)).digest('hex');
      const generatedOpenid = `mock_${hash.substr(0, 16)}`;

      logger.debug('使用动态生成的Mock openid', {
        code: WechatService.maskSensitive(code),
        openid: generatedOpenid
      });

      return {
        openid: generatedOpenid,
        session_key: `mock_session_key_${Date.now()}`,
        unionid: null
      };
    } catch (error) {
      logger.error('Mock登录失败', error, {
        code: WechatService.maskSensitive(code)
      });
      throw error;
    }
  }

  /**
   * 处理微信API返回的错误
   * 将微信错误码转换为用户友好的错误信息
   *
   * @static
   * @param {Object} errorData 微信API错误响应
   * @param {string} code 用户的授权码
   * @throws {Error} 抛出包含友好提示信息的错误
   */
  static handleWechatError(errorData, code) {
    const { errcode, errmsg } = errorData;

    // 详细日志记录（用于后续排查）
    logger.warn('微信API返回错误', {
      errcode,
      errmsg,
      code: WechatService.maskSensitive(code),
      timestamp: new Date().toISOString()
    });

    // 错误码映射到用户友好的信息
    // 参考：https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/login/code2session.html
    const errorMessages = {
      40001: 'AppSecret错误或格式不正确',
      40002: 'AppID不存在',
      40028: 'AppID无效',
      40029: 'code无效或已过期，请重新登录',
      40163: 'code已被使用，请重新登录',
      45011: '请求过于频繁，请稍后再试',
      45087: '服务暂时不可用，请稍后再试',
      9001001: '微信服务异常，请稍后重试'
    };

    const userMessage = errorMessages[errcode] || `微信登录失败 (错误码: ${errcode})`;

    const error = new Error(userMessage);
    error.code = errcode;
    error.wechatError = errmsg;

    throw error;
  }

  /**
   * 敏感信息脱敏工具函数
   * 仅显示字符串的前4位和后4位，中间用 *** 替代
   * 用于日志记录，防止敏感信息泄露
   *
   * @static
   * @param {string} str 要脱敏的字符串
   * @returns {string} 脱敏后的字符串
   */
  static maskSensitive(str) {
    if (!str || typeof str !== 'string' || str.length < 8) {
      return '***';
    }
    return `${str.substring(0, 4)}***${str.substring(str.length - 4)}`;
  }

  /**
   * 获取预定义的测试用户列表（开发用）
   * @returns {Object} 测试用户映射
   */
  getTestUsers() {
    return this.testUsers;
  }

  /**
   * 添加新的测试用户（开发用）
   * @param {string} code 触发code
   * @param {string} openid Mock openid
   * @param {string} nickname 昵称
   */
  addTestUser(code, openid, nickname) {
    this.testUsers[code] = { openid, nickname };
    logger.debug('添加测试用户', { code, openid, nickname });
  }
}

// 导出单例
module.exports = new WechatService();
