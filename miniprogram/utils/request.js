/**
 * 网络请求工具类
 * 封装微信小程序的 wx.request API,提供统一的请求接口
 */

const envConfig = require('../config/env');
const currentTenant = require('../config/current-tenant');
const constants = require('../config/constants');
const logger = require('./logger');
const { tenantStorage } = require('./storage');

const ENABLE_TENANT_REQUEST_LOG = false;

class Request {
  constructor() {
    this.timeout = constants.REQUEST_TIMEOUT;
    this.header = {
      'Content-Type': 'application/json'
    };
    // Token 刷新管理
    this.isRefreshing = false; // 防止并发刷新
    this.requestQueue = []; // 等待刷新完成的请求队列
  }

  getBaseURL() {
    // env.js can be switched by the local startup script while the mini-program
    // process retains modules. Resolve it per request instead of caching prod.
    return currentTenant.apiBaseUrl || envConfig.apiBaseUrl;
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

    // 合并请求头
    const requestHeader = {
      ...this.header,
      ...header,
      'X-Wx-AppId': currentTenant.wxAppId,
      'X-Course-Template-Version': '1'
    };

    // 公开端点不需要token（避免旧token干扰）
    const publicEndpoints = ['/auth/wechat/login', '/auth/refresh'];
    const isPublicEndpoint = publicEndpoints.some((endpoint) =>
      url.includes(endpoint)
    );

    // 添加认证token（公开端点除外）
    if (!isPublicEndpoint) {
      const token = tenantStorage.get(constants.STORAGE_KEYS.TOKEN);
      if (token) {
        requestHeader['Authorization'] = `Bearer ${token}`;
      }
    }

    const requestUrl = `${this.getBaseURL()}${url}`;

    if (ENABLE_TENANT_REQUEST_LOG) {
      logger.debug('[TENANT-REQUEST]', method, url, {
        wxAppId: currentTenant.wxAppId,
        hasToken: !!requestHeader['Authorization']
      });
    }

    return new Promise((resolve, reject) => {
      wx.request({
        url: requestUrl,
        method,
        data,
        header: requestHeader,
        timeout: this.timeout,
        success: (res) => {
          if (showLoading) {
            wx.hideLoading();
          }

          // 处理响应（传入原始请求选项用于重试）
          this.handleResponse(res, resolve, reject, options);
        },
        fail: (err) => {
          if (showLoading) {
            wx.hideLoading();
          }

          logger.error('请求失败:', {
            url: requestUrl,
            method,
            errMsg: err.errMsg,
            error: err
          });
          if (!options.suppressError) {
            this.handleError(err);
          }
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
        if (originalOptions.preserveResponse) {
          resolve(data);
          return;
        }
        resolve(data.data || data);
      } else {
        // 业务错误
        if (!originalOptions.suppressError) {
          this.showError(data.message || '请求失败');
        }
        reject(data);
      }
    }
    // 401 未授权 - 对公开端点直接返回错误，对受保护端点尝试刷新Token
    else if (statusCode === 401) {
      // 公开端点不应该尝试刷新token
      const publicEndpoints = ['/auth/wechat/login', '/auth/refresh'];
      const isPublicEndpoint = publicEndpoints.some((endpoint) =>
        originalOptions.url.includes(endpoint)
      );

      if (isPublicEndpoint) {
        // 公开端点的401表示请求本身失败，直接返回
        logger.error('公开端点认证失败:', {
          url: originalOptions.url,
          message: data.message
        });
        if (!originalOptions.suppressError) {
          this.showError(data.message || '请求失败，请重试');
        }
        reject(data);
      } else {
        // 受保护端点的401表示token过期，尝试刷新
        this.handleTokenRefresh(resolve, reject, originalOptions);
      }
    }
    // 409 业务冲突（例如昵称重复）：把后端业务错误体直接交给调用方。
    else if (statusCode === 409) {
      if (!originalOptions.suppressError) {
        this.showError(data.message || '请求冲突，请修改后重试');
      }
      reject(data);
    }
    // 403 禁止访问：账号被禁用/令牌失效需要重新登录，其余展示后端给出的原因
    else if (statusCode === 403) {
      const message = (data && data.message) || '没有权限访问';
      // 登录接口本身被拒（如账号已禁用）时由登录页展示原因，不再跳回登录页
      const isAuthEndpoint = ['/auth/wechat/login', '/auth/refresh'].some((endpoint) =>
        originalOptions.url.includes(endpoint)
      );
      if (!isAuthEndpoint && this.requiresRelogin(message)) {
        this.handleAuthError({ silent: true });
        this.showError(message);
      } else if (!originalOptions.suppressError) {
        this.showError(message);
      }
      reject(this.buildHttpError(res, message));
    }
    // 404 未找到
    else if (statusCode === 404) {
      const message = (data && data.message) || '请求的资源不存在';
      if (!originalOptions.suppressError) {
        this.showError(message);
      }
      reject(this.buildHttpError(res, message));
    }
    // 500 服务器错误（不透出服务端内部信息）
    else if (statusCode >= 500) {
      const message = '服务器错误,请稍后重试';
      if (!originalOptions.suppressError) {
        this.showError(message);
      }
      reject(this.buildHttpError(res, message));
    }
    // 其他错误
    else {
      const message = (data && data.message) || '请求失败';
      if (!originalOptions.suppressError) {
        this.showError(message);
      }
      reject(this.buildHttpError(res, message));
    }
  }

  /**
   * HTTP 错误对象：保留原 wx 响应字段（statusCode/data/header），
   * 并补上 message/code，页面可直接用 err.message 拿到后端原因。
   */
  buildHttpError(res, message) {
    const data = (res && res.data) || {};
    return {
      ...res,
      code: data.code !== undefined ? data.code : res.statusCode,
      message
    };
  }

  /**
   * 这些 403 表示当前登录态已不可用，需要清除并重新登录
   */
  requiresRelogin(message) {
    return ['重新登录', '用户已被禁用', '用户已被删除'].some((keyword) =>
      String(message || '').includes(keyword)
    );
  }

  /**
   * 处理Token刷新（自动重试机制）
   */
  handleTokenRefresh(resolve, reject, originalOptions) {
    const refreshToken = tenantStorage.get(
      constants.STORAGE_KEYS.REFRESH_TOKEN
    );

    if (!refreshToken) {
      // 没有refreshToken，直接处理认证错误
      this.handleAuthError({
        silent: !!originalOptions.suppressAuthError,
        redirect: !originalOptions.suppressAuthError
      });
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
    authService
      .refreshToken(refreshToken)
      .then((newTokens) => {
        // 保存新Token
        tenantStorage.set(constants.STORAGE_KEYS.TOKEN, newTokens.accessToken);
        tenantStorage.set(
          constants.STORAGE_KEYS.REFRESH_TOKEN,
          newTokens.refreshToken
        );
        logger.info('✅ Token刷新成功');

        // 重试原始请求
        this.request(originalOptions).then(resolve).catch(reject);

        // 处理队列中的请求
        const queue = this.requestQueue;
        this.requestQueue = [];
        queue.forEach(({ options, resolve: qResolve, reject: qReject }) => {
          this.request(options).then(qResolve).catch(qReject);
        });
      })
      .catch((refreshError) => {
        // Token刷新失败
        logger.error('❌ Token刷新失败:', refreshError);
        this.handleAuthError({
          silent: !!originalOptions.suppressAuthError,
          redirect: !originalOptions.suppressAuthError
        });

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
  handleAuthError(options = {}) {
    const { silent = false, redirect = true } = options;

    if (!silent) {
      wx.showToast({
        title: '登录已过期,请重新登录',
        icon: 'none',
        duration: 2000
      });
    }

    // 清除本地存储
    tenantStorage.remove(constants.STORAGE_KEYS.TOKEN);
    tenantStorage.remove(constants.STORAGE_KEYS.USER_INFO);
    tenantStorage.remove(constants.STORAGE_KEYS.REFRESH_TOKEN);

    // 更新全局登录状态
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.isLogin = false;
      app.globalData.userInfo = null;
      app.globalData.token = null;
    }

    if (redirect) {
      // 延迟跳转到登录页
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/login/login'
        });
      }, 2000);
    }
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
    const token = tenantStorage.get(constants.STORAGE_KEYS.TOKEN);

    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${this.getBaseURL()}${url}`,
        filePath,
        name: 'file',
        formData,
        header: {
          Authorization: token ? `Bearer ${token}` : '',
          'X-Wx-AppId': currentTenant.wxAppId
        },
        success: (res) => {
          let data;
          try {
            data = JSON.parse(res.data);
          } catch (error) {
            this.showError('上传响应异常');
            reject(error);
            return;
          }

          if (res.statusCode >= 200 && res.statusCode < 300 && (data.code === 0 || data.code === 200 || data.success)) {
            resolve(data.data);
          } else {
            this.showError(data.message || '上传失败');
            reject(data);
          }
        },
        fail: (err) => {
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
