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
        success: (res) => {
          resolve(res.userInfo);
        },
        fail: (err) => {
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
          _id: 'mock_user_' + Date.now(),  // 添加 _id 字段，用于 API 认证
          id: 1,
          nickname: userInfo.nickName || '晨读营用户',
          avatar: '🦁',
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
      // 生产环境：获取真实微信code
      const loginRes = await this.getWechatCode();
      const code = loginRes.code;

      // 2. 调用后端登录接口
      const loginData = await this.login(code, {
        nickname: userInfo.nickName,
        avatar_url: userInfo.avatarUrl,
        gender: userInfo.gender === 1 ? 'male' : userInfo.gender === 2 ? 'female' : 'unknown'
      });

      // 3. 保存token和用户信息
      // 后端使用驼峰命名：accessToken, refreshToken
      const accessToken = loginData.accessToken || loginData.access_token;
      const refreshToken = loginData.refreshToken || loginData.refresh_token;

      wx.setStorageSync('token', accessToken);
      wx.setStorageSync('refreshToken', refreshToken);
      wx.setStorageSync('userInfo', loginData.user);

      return loginData;
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
        success: (res) => {
          if (res.code) {
            resolve(res);
          } else {
            reject(new Error('获取授权码失败'));
          }
        },
        fail: (err) => {
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
