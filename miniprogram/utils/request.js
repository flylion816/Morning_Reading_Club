/**
 * 网络请求工具类
 * 封装微信小程序的 wx.request API,提供统一的请求接口
 */

const envConfig = require('../config/env');
const constants = require('../config/constants');
const logger = require('./logger');

class Request {
  constructor() {
    this.baseURL = envConfig.apiBaseUrl;
    this.timeout = constants.REQUEST_TIMEOUT;
    this.header = {
      'Content-Type': 'application/json'
    };
    // Token 刷新管理
    this.isRefreshing = false; // 防止并发刷新
    this.requestQueue = []; // 等待刷新完成的请求队列
  }

  /**
   * 核心请求方法
   * @param {Object} options 请求配置
   * @returns {Promise}
   */
  request(options) {
    const {
      url,
      method = 'GET',
      data = {},
      header = {},
      showLoading = false,
      loadingText = '加载中...'
    } = options;

    // 显示加载提示
    if (showLoading) {
      wx.showLoading({
        title: loadingText,
        mask: true
      });
    }

    // 获取token
    const token = wx.getStorageSync(constants.STORAGE_KEYS.TOKEN);

    // 合并请求头
    const requestHeader = {
      ...this.header,
      ...header
    };

    // 添加认证token
    if (token) {
      requestHeader['Authorization'] = `Bearer ${token}`;
    }

    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.baseURL}${url}`,
        method,
        data,
        header: requestHeader,
        timeout: this.timeout,
        success: res => {
          if (showLoading) {
            wx.hideLoading();
          }

          // 处理响应（传入原始请求选项用于重试）
          this.handleResponse(res, resolve, reject, options);
        },
        fail: err => {
          if (showLoading) {
            wx.hideLoading();
          }

          logger.error('请求失败:', err);
          this.handleError(err);
          reject(err);
        }
      });
    });
  }

  /**
   * 处理响应（支持Token自动刷新）
   */
  handleResponse(res, resolve, reject, originalOptions) {
    const { statusCode, data } = res;

    // 成功响应
    if (statusCode >= 200 && statusCode < 300) {
      // 检查业务状态码
      if (data.code === 0 || data.code === 200 || statusCode === 200) {
        resolve(data.data || data);
      } else {
        // 业务错误
        this.showError(data.message || '请求失败');
        reject(data);
      }
    }
    // 401 未授权 - 尝试刷新Token
    else if (statusCode === 401) {
      this.handleTokenRefresh(resolve, reject, originalOptions);
    }
    // 403 禁止访问
    else if (statusCode === 403) {
      this.showError('没有权限访问');
      reject(res);
    }
    // 404 未找到
    else if (statusCode === 404) {
      this.showError('请求的资源不存在');
      reject(res);
    }
    // 500 服务器错误
    else if (statusCode >= 500) {
      this.showError('服务器错误,请稍后重试');
      reject(res);
    }
    // 其他错误
    else {
      this.showError(data.message || '请求失败');
      reject(res);
    }
  }

  /**
   * 处理Token刷新（自动重试机制）
   */
  handleTokenRefresh(resolve, reject, originalOptions) {
    const refreshToken = wx.getStorageSync(constants.STORAGE_KEYS.REFRESH_TOKEN);

    if (!refreshToken) {
      // 没有refreshToken，直接处理认证错误
      this.handleAuthError();
      reject(new Error('Token已过期，需要重新登录'));
      return;
    }

    // 防止并发刷新
    if (this.isRefreshing) {
      // 将请求加入队列，等待刷新完成后重试
      logger.info('加入请求队列，等待Token刷新');
      this.requestQueue.push({ resolve, reject, options: originalOptions });
      return;
    }

    // 标记为正在刷新
    this.isRefreshing = true;
    logger.info('开始刷新Token');

    // 调用刷新Token API
    const authService = require('../services/auth.service');
    authService.refreshToken(refreshToken)
      .then(newTokens => {
        // 保存新Token
        wx.setStorageSync(constants.STORAGE_KEYS.TOKEN, newTokens.accessToken);
        wx.setStorageSync(constants.STORAGE_KEYS.REFRESH_TOKEN, newTokens.refreshToken);
        logger.info('✅ Token刷新成功');

        // 重试原始请求
        this.request(originalOptions)
          .then(resolve)
          .catch(reject);

        // 处理队列中的请求
        const queue = this.requestQueue;
        this.requestQueue = [];
        queue.forEach(({ options, resolve: qResolve, reject: qReject }) => {
          this.request(options)
            .then(qResolve)
            .catch(qReject);
        });
      })
      .catch(refreshError => {
        // Token刷新失败
        logger.error('❌ Token刷新失败:', refreshError);
        this.handleAuthError();

        // 拒绝所有队列中的请求
        this.requestQueue.forEach(({ reject: qReject }) => {
          qReject(refreshError);
        });
        this.requestQueue = [];

        reject(refreshError);
      })
      .finally(() => {
        this.isRefreshing = false;
      });
  }

  /**
   * 处理认证错误
   */
  handleAuthError() {
    wx.showToast({
      title: '登录已过期,请重新登录',
      icon: 'none',
      duration: 2000
    });

    // 清除本地存储
    wx.removeStorageSync(constants.STORAGE_KEYS.TOKEN);
    wx.removeStorageSync(constants.STORAGE_KEYS.USER_INFO);
    wx.removeStorageSync(constants.STORAGE_KEYS.REFRESH_TOKEN);

    // 更新全局登录状态
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.isLogin = false;
      app.globalData.userInfo = null;
      app.globalData.token = null;
    }

    // 延迟跳转到登录页
    setTimeout(() => {
      wx.reLaunch({
        url: '/pages/login/login'
      });
    }, 2000);
  }

  /**
   * 处理网络错误
   */
  handleError(err) {
    if (err.errMsg.includes('timeout')) {
      this.showError('请求超时,请检查网络');
    } else if (err.errMsg.includes('fail')) {
      this.showError('网络请求失败,请检查网络');
    } else {
      this.showError('请求失败');
    }
  }

  /**
   * 显示错误提示
   */
  showError(message) {
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    });
  }

  /**
   * GET 请求
   */
  get(url, data = {}, options = {}) {
    return this.request({
      url,
      method: 'GET',
      data,
      ...options
    });
  }

  /**
   * POST 请求
   */
  post(url, data = {}, options = {}) {
    return this.request({
      url,
      method: 'POST',
      data,
      ...options
    });
  }

  /**
   * PUT 请求
   */
  put(url, data = {}, options = {}) {
    return this.request({
      url,
      method: 'PUT',
      data,
      ...options
    });
  }

  /**
   * DELETE 请求
   */
  delete(url, data = {}, options = {}) {
    return this.request({
      url,
      method: 'DELETE',
      data,
      ...options
    });
  }

  /**
   * PATCH 请求
   */
  patch(url, data = {}, options = {}) {
    return this.request({
      url,
      method: 'PATCH',
      data,
      ...options
    });
  }

  /**
   * 上传文件
   */
  upload(url, filePath, formData = {}, options = {}) {
    const token = wx.getStorageSync(constants.STORAGE_KEYS.TOKEN);

    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${this.baseURL}${url}`,
        filePath,
        name: 'file',
        formData,
        header: {
          Authorization: token ? `Bearer ${token}` : ''
        },
        success: res => {
          const data = JSON.parse(res.data);
          if (res.statusCode === 200 && data.code === 0) {
            resolve(data.data);
          } else {
            this.showError(data.message || '上传失败');
            reject(data);
          }
        },
        fail: err => {
          logger.error('上传失败:', err);
          this.showError('上传失败');
          reject(err);
        }
      });
    });
  }
}

// 导出单例
module.exports = new Request();
