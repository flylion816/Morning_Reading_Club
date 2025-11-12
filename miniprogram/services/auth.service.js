/**
 * 认证服务
 * 处理用户登录、注册等认证相关的API请求
 */

const request = require('../utils/request');

class AuthService {
  /**
   * 微信登录
   * @param {string} code 微信授权码
   * @param {Object} userInfo 用户信息(可选)
   * @returns {Promise}
   */
  login(code, userInfo = {}) {
    return request.post('/auth/login', {
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
   * 微信授权登录
   * @returns {Promise}
   */
  async wechatLogin() {
    try {
      // 1. 获取微信授权码
      const loginRes = await this.getWechatCode();
      const code = loginRes.code;

      // 2. 获取用户信息
      const userInfo = await this.getWechatUserInfo();

      // 3. 调用后端登录接口
      const loginData = await this.login(code, {
        nickname: userInfo.nickName,
        avatar_url: userInfo.avatarUrl,
        gender: userInfo.gender === 1 ? 'male' : userInfo.gender === 2 ? 'female' : 'unknown'
      });

      // 4. 保存token和用户信息
      wx.setStorageSync('token', loginData.access_token);
      wx.setStorageSync('refreshToken', loginData.refresh_token);
      wx.setStorageSync('userInfo', loginData.user);

      return loginData;
    } catch (error) {
      console.error('微信登录失败:', error);
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
