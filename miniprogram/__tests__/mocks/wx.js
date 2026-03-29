/**
 * WxMock Class
 * Provides a reusable mock for WeChat APIs in test suites
 * Can be instantiated per test to provide isolated mock behavior
 */

class WxMock {
  constructor() {
    this.storage = {};
    this.requestDelay = 100;
    this.paymentDelay = 200;
    this.loginDelay = 100;
  }

  /**
   * Storage API - getStorageSync
   * @param {string} key - Storage key
   * @returns {any} Stored value or null
   */
  getStorageSync(key) {
    return this.storage[key] || null;
  }

  /**
   * Storage API - setStorageSync
   * @param {string} key - Storage key
   * @param {any} data - Data to store
   */
  setStorageSync(key, data) {
    this.storage[key] = data;
  }

  /**
   * Storage API - removeStorageSync
   * @param {string} key - Storage key to remove
   */
  removeStorageSync(key) {
    delete this.storage[key];
  }

  /**
   * Storage API - clearStorageSync
   * Clears all storage
   */
  clearStorageSync() {
    this.storage = {};
  }

  /**
   * Network API - request
   * Simulates HTTP request with configurable delay
   * @param {Object} options - Request options
   * @param {string} options.url - Request URL
   * @param {string} options.method - HTTP method (GET, POST, etc.)
   * @param {Object} options.data - Request data
   * @param {Function} options.success - Success callback
   * @param {Function} options.fail - Failure callback
   * @param {Object} options._mockResponse - Mock response data to return
   */
  request(options) {
    setTimeout(() => {
      if (options.success) {
        options.success({
          statusCode: 200,
          data: options._mockResponse || {},
        });
      }
    }, this.requestDelay);
  }

  /**
   * Login API - login
   * Simulates WeChat login and returns mock code
   * @param {Object} options - Login options
   * @param {Function} options.success - Success callback with code
   * @param {Function} options.fail - Failure callback
   */
  login(options) {
    setTimeout(() => {
      if (options.success) {
        options.success({
          code: `mock_code_${Math.random().toString(36).substring(2, 15)}`,
        });
      }
    }, this.loginDelay);
  }

  /**
   * User API - getUserProfile
   * Simulates getting user profile
   * @param {Object} options - Options
   * @param {string} options.desc - Description for user permission
   * @param {Function} options.success - Success callback with userInfo
   * @param {Function} options.fail - Failure callback
   */
  getUserProfile(options) {
    setTimeout(() => {
      if (options.success) {
        options.success({
          userInfo: {
            nickName: '微信用户',
            avatarUrl: 'https://example.com/avatar.jpg',
            gender: 1,
            country: '',
            province: '',
            city: '',
            language: 'zh_CN',
          },
        });
      }
    }, this.requestDelay);
  }

  /**
   * Network API - getNetworkType
   * Simulates getting network type
   * @param {Object} options - Options
   * @param {Function} options.success - Success callback with networkType
   */
  getNetworkType(options) {
    if (options.success) {
      options.success({
        networkType: 'wifi',
      });
    }
  }

  /**
   * Subscription Message API - getSetting
   * Simulates settings lookup with subscription itemSettings
   * @param {Object} options - Options
   * @param {Function} options.success - Success callback
   */
  getSetting(options) {
    if (options.success) {
      options.success({
        subscriptionsSetting: {
          itemSettings: {}
        }
      });
    }
  }

  /**
   * Subscription Message API - requestSubscribeMessage
   * Simulates subscribe message request
   * @param {Object} options - Options
   * @param {Array} options.tmplIds - Template IDs
   * @param {Function} options.success - Success callback
   * @param {Function} options.fail - Failure callback
   */
  requestSubscribeMessage(options) {
    if (options.success) {
      const result = {};
      (options.tmplIds || []).forEach(templateId => {
        result[templateId] = 'accept';
      });
      options.success(result);
    }
  }

  /**
   * Payment API - requestPayment
   * Simulates WeChat payment with configurable success rate
   * @param {Object} options - Payment options
   * @param {string} options.timeStamp - Timestamp
   * @param {string} options.nonceStr - Nonce string
   * @param {string} options.package - Package string
   * @param {string} options.signType - Signature type
   * @param {string} options.paySign - Payment signature
   * @param {Function} options.success - Success callback
   * @param {Function} options.fail - Failure callback
   * @param {number} options._successRate - (Optional) Success rate 0-1, defaults to 0.9
   * @param {Object} options._mockResponse - (Optional) Custom success response to return
   */
  requestPayment(options) {
    const successRate = options._successRate !== undefined ? options._successRate : 0.9;
    const isSuccess = Math.random() < successRate;
    const mockResponse = options._mockResponse;

    setTimeout(() => {
      if (isSuccess && options.success) {
        options.success(
          mockResponse || {
            errMsg: 'requestPayment:ok',
          }
        );
      } else if (!isSuccess && options.fail) {
        options.fail({
          errMsg: 'requestPayment:fail cancel',
        });
      }
    }, this.paymentDelay);
  }

  /**
   * Navigation API - navigateTo
   * Simulates navigating to a new page
   * @param {Object} options - Navigation options
   * @param {string} options.url - Target page URL
   * @param {Function} options.success - Success callback
   */
  navigateTo(options) {
    if (options.success) {
      options.success();
    }
  }

  /**
   * Navigation API - navigateBack
   * Simulates navigating back
   * @param {Object} options - Navigation options
   * @param {number} options.delta - Number of pages to go back
   * @param {Function} options.success - Success callback
   */
  navigateBack(options) {
    if (options.success) {
      options.success();
    }
  }

  /**
   * Navigation API - reLaunch
   * Simulates relaunching the app
   * @param {Object} options - Navigation options
   * @param {string} options.url - Target page URL
   * @param {Function} options.success - Success callback
   */
  reLaunch(options) {
    if (options.success) {
      options.success();
    }
  }

  /**
   * Navigation API - redirectTo
   * Simulates redirecting to a page
   * @param {Object} options - Navigation options
   * @param {string} options.url - Target page URL
   * @param {Function} options.success - Success callback
   */
  redirectTo(options) {
    if (options.success) {
      options.success();
    }
  }

  /**
   * Navigation API - switchTab
   * Simulates switching to a tabbar page
   * @param {Object} options - Navigation options
   * @param {string} options.url - Target tabbar page URL
   * @param {Function} options.success - Success callback
   */
  switchTab(options) {
    if (options.success) {
      options.success();
    }
  }

  /**
   * UI API - showToast
   * Simulates showing a toast message
   * @param {Object} options - Toast options
   * @param {string} options.title - Toast title
   * @param {string} options.icon - Icon type (success, error, loading, none)
   * @param {number} options.duration - Duration in milliseconds
   */
  showToast(options) {
    // Toast doesn't have callbacks, just store for verification if needed
    this._lastToast = options;
  }

  /**
   * UI API - showModal
   * Simulates showing a modal dialog
   * @param {Object} options - Modal options
   * @param {string} options.title - Modal title
   * @param {string} options.content - Modal content
   * @param {Function} options.success - Success callback with confirm/cancel result
   */
  showModal(options) {
    if (options.success) {
      options.success({
        confirm: true,
        cancel: false,
      });
    }
  }

  /**
   * UI API - hideToast
   * Simulates hiding toast
   */
  hideToast() {
    // No-op for mock
  }

  /**
   * System API - getSystemInfoSync
   * Simulates getting system info synchronously
   * @returns {Object} System info object
   */
  getSystemInfoSync() {
    return {
      brand: 'iPhone',
      model: 'iPhone 12',
      pixelRatio: 3,
      screenWidth: 390,
      screenHeight: 844,
      windowWidth: 390,
      windowHeight: 844,
      statusBarHeight: 47,
      language: 'zh-Hans',
      version: '7.0.0',
      system: 'iOS 15.0',
      platform: 'ios',
      fontSizeSetting: 16,
      SDKVersion: '2.24.0',
    };
  }

  /**
   * Helper method - _mockResponse
   * Sets up mock response for the next request
   * Usage: wxMock._mockResponse({...data})
   * @param {Object} response - Response data to return
   */
  _mockResponse(response) {
    this._response = response;
    return response;
  }

  /**
   * Helper method - setRequestDelay
   * Configure request delay for testing timeout scenarios
   * @param {number} delay - Delay in milliseconds
   */
  setRequestDelay(delay) {
    this.requestDelay = delay;
  }

  /**
   * Helper method - setPaymentDelay
   * Configure payment delay for testing timeout scenarios
   * @param {number} delay - Delay in milliseconds
   */
  setPaymentDelay(delay) {
    this.paymentDelay = delay;
  }

  /**
   * Helper method - setLoginDelay
   * Configure login delay for testing timeout scenarios
   * @param {number} delay - Delay in milliseconds
   */
  setLoginDelay(delay) {
    this.loginDelay = delay;
  }

  /**
   * Helper method - reset
   * Clears all stored data and state
   */
  reset() {
    this.storage = {};
    this.requestDelay = 100;
    this.paymentDelay = 200;
    this.loginDelay = 100;
    this._response = null;
    this._lastToast = null;
  }
}

module.exports = WxMock;
