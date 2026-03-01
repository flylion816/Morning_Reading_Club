/**
 * 认证服务
 * 处理用户登录、注册等认证相关的API请求
 */

const request = require('../utils/request');
const logger = require('../utils/logger');

class AuthService {
  /**
   * 微信登录
   * @param {string} code 微信授权码
   * @param {Object} userInfo 用户信息(可选)
   * @returns {Promise}
   */
  login(code, userInfo = {}) {
    return request.post('/auth/wechat/login', {
      code,
      ...userInfo
    });
  }

  /**
   * 刷新token
   * @param {string} refreshToken 刷新令牌
   * @returns {Promise}
   */
  refreshToken(refreshToken) {
    return request.post('/auth/refresh', {
      refresh_token: refreshToken
    });
  }

  /**
   * 退出登录
   * @returns {Promise}
   */
  logout() {
    return request.post('/auth/logout');
  }

  /**
   * 获取微信用户信息
   * @returns {Promise}
   */
  getWechatUserInfo() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善会员资料',
        success: res => {
          resolve(res.userInfo);
        },
        fail: err => {
          reject(err);
        }
      });
    });
  }

  /**
   * 微信授权登录（Mock模式，用于开发测试）
   * @param {Object} userInfo 用户信息（从getUserProfile获取）
   * @returns {Promise}
   */
  async wechatLoginMock(userInfo) {
    try {
      logger.debug('Mock登录开始，用户信息:', userInfo);

      // 模拟登录成功的返回数据
      const mockLoginData = {
        accessToken: 'mock_token_' + Date.now(),
        refreshToken: 'mock_refresh_token_' + Date.now(),
        user: {
          _id: 'mock_user_' + Date.now(), // 添加 _id 字段，用于 API 认证
          id: 1,
          nickname: userInfo.nickName || '晨读营用户',
          avatar: '🦁',
          avatarUrl: userInfo.avatarUrl || null, // 添加 avatarUrl 字段
          signature: '天天开心，觉知当下！'
        }
      };

      // 保存token和用户信息
      wx.setStorageSync('token', mockLoginData.accessToken);
      wx.setStorageSync('refreshToken', mockLoginData.refreshToken);
      wx.setStorageSync('userInfo', mockLoginData.user);

      logger.debug('Mock登录成功');

      return mockLoginData;
    } catch (error) {
      logger.error('Mock登录失败:', error);
      throw error;
    }
  }

  /**
   * 微信授权登录（生产模式）
   * @param {Object} userInfo 用户信息（从getUserProfile获取）
   * @returns {Promise}
   */
  async wechatLogin(userInfo) {
    try {
      // 1. 获取微信授权码
      // 开发环境：使用mock code；生产环境：获取真实微信code
      const envConfig = require('../config/env');
      let code;

      if (envConfig.currentEnv === 'dev') {
        // 开发环境使用固定的mock code（后端会通过MD5哈希生成一致的openid）
        code = 'mock_code_dev';
        logger.debug('开发环境使用mock code:', code);
      } else {
        // 生产环境获取真实code
        const loginRes = await this.getWechatCode();
        code = loginRes.code;
      }

      // 2. 调用后端登录接口
      // ⚠️ 新策略：让后端返回的数据为准，前端只在新用户时才用微信信息补充
      const loginData = await this.login(code, {
        nickname: userInfo.nickName,
        avatar_url: userInfo.avatarUrl,
        gender: userInfo.gender === 1 ? 'male' : userInfo.gender === 2 ? 'female' : 'unknown'
      });

      logger.info('登录结果', {
        isNewUser: loginData.isNewUser,
        needsWechatInfo: loginData.needsWechatInfo,
        serverNickname: loginData.user.nickname,
        wechatNickname: userInfo.nickName
      });

      // 3. 智能合并用户信息
      // 策略：优先使用服务器的数据，只在新用户且服务器数据不完整时才补充微信信息
      let finalUserInfo = { ...loginData.user };

      if (loginData.isNewUser && loginData.needsWechatInfo) {
        // 新用户：用微信信息补充服务器没有的字段
        const defaultNicknames = ['微信用户', '晨读营用户', '晨读营', 'wechat user'];
        const isDefaultNickname =
          !userInfo.nickName || defaultNicknames.includes(userInfo.nickName);

        logger.debug('新用户数据补充', {
          hasServerNickname: !!finalUserInfo.nickname,
          wechatNicknameIsDefault: isDefaultNickname
        });

        // 只有当服务器昵称为空或默认值，且微信昵称非默认值时，才用微信昵称
        if (!finalUserInfo.nickname || defaultNicknames.includes(finalUserInfo.nickname)) {
          if (!isDefaultNickname) {
            finalUserInfo.nickname = userInfo.nickName;
            logger.info('用微信昵称补充新用户', { nickname: userInfo.nickName });
          }
        }

        // 补充头像URL
        if (!finalUserInfo.avatarUrl && userInfo.avatarUrl) {
          finalUserInfo.avatarUrl = userInfo.avatarUrl;
        }
      }
      // 既有用户：完全使用服务器返回的数据，不用微信信息
      // 这样既有用户改过的昵称（"老虎"）就不会被覆盖

      // 4. 保存token和用户信息
      const accessToken = loginData.accessToken || loginData.access_token;
      const refreshToken = loginData.refreshToken || loginData.refresh_token;

      wx.setStorageSync('token', accessToken);
      wx.setStorageSync('refreshToken', refreshToken);
      wx.setStorageSync('userInfo', finalUserInfo); // ← 保存合并后的信息

      logger.info('用户信息已保存', {
        nickname: finalUserInfo.nickname,
        isNewUser: loginData.isNewUser
      });

      return { ...loginData, user: finalUserInfo };
    } catch (error) {
      logger.error('微信登录失败:', error);
      throw error;
    }
  }

  /**
   * 获取微信授权码
   * @returns {Promise}
   */
  getWechatCode() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: res => {
          if (res.code) {
            resolve(res);
          } else {
            reject(new Error('获取授权码失败'));
          }
        },
        fail: err => {
          reject(err);
        }
      });
    });
  }

  /**
   * 检查登录状态
   * @returns {boolean}
   */
  isLogin() {
    const token = wx.getStorageSync('token');
    return !!token;
  }
}

module.exports = new AuthService();
