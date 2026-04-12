/**
 * Jest Global Setup
 * Configures the test environment before running any test suites
 * - Mocks console methods for clean test output
 * - Mocks global wx object with WeChat API stubs
 * - Sets test timeout to 5 seconds
 */

// Mock console methods to keep output clean
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Create deterministic ID generator with counter for unique IDs
global.__idCounter = 0;
global.generateUniqueId = function() {
  return String(global.__idCounter++);
};

global.__mockCanvasGradient = {
  addColorStop: jest.fn()
};

global.__mockCanvasImageSrcs = [];
global.__mockCanvasCreateImage = jest.fn(() => {
  const image = {
    onload: null,
    onerror: null,
    _src: ''
  };

  Object.defineProperty(image, 'src', {
    get() {
      return image._src;
    },
    set(value) {
      image._src = value;
      global.__mockCanvasImageSrcs.push(value);
      setTimeout(() => {
        if (image.onload) {
          image.onload();
        }
      }, 0);
    }
  });

  return image;
});

global.__mockCanvasContext = {
  save: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  closePath: jest.fn(),
  clip: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arcTo: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  scale: jest.fn(),
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  fillText: jest.fn(),
  measureText: jest.fn(text => ({
    width: String(text || '').length * 12
  })),
  drawImage: jest.fn(),
  setTransform: jest.fn(),
  resetTransform: jest.fn(),
  createLinearGradient: jest.fn(() => global.__mockCanvasGradient)
};

// Mock WeChat global object with all APIs
global.wx = {
  // Storage APIs
  getStorageSync: jest.fn((key) => {
    return global.wx.__storage?.[key] || null;
  }),
  setStorageSync: jest.fn((key, data) => {
    if (!global.wx.__storage) {
      global.wx.__storage = {};
    }
    global.wx.__storage[key] = data;
  }),
  removeStorageSync: jest.fn((key) => {
    if (global.wx.__storage) {
      delete global.wx.__storage[key];
    }
  }),
  clearStorageSync: jest.fn(() => {
    global.wx.__storage = {};
  }),

  // Network API
  request: jest.fn((options) => {
    // Simulate HTTP request with 100ms delay
    setTimeout(() => {
      if (options.success) {
        options.success({
          statusCode: 200,
          data: options._mockResponse || {},
        });
      }
    }, 100);
  }),

  // Login API
  login: jest.fn((options) => {
    // Simulate login with 100ms delay
    setTimeout(() => {
      if (options.success) {
        options.success({
          code: `mock_code_${Math.random().toString(36).substring(2, 15)}`,
        });
      }
    }, 100);
  }),

  // User Profile API
  getUserProfile: jest.fn((options) => {
    // Simulate getting user profile with 100ms delay
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
    }, 100);
  }),

  // Subscription Message APIs
  getSetting: jest.fn((options) => {
    if (options && options.success) {
      options.success({
        subscriptionsSetting: {
          itemSettings: {}
        }
      });
    }
  }),

  requestSubscribeMessage: jest.fn((options) => {
    if (options && options.success) {
      const result = {};
      (options.tmplIds || []).forEach(templateId => {
        result[templateId] = 'accept';
      });
      options.success(result);
    }
  }),

  // Network Info API
  getNetworkType: jest.fn((options) => {
    // Simulate network info
    if (options.success) {
      options.success({
        networkType: 'wifi',
      });
    }
  }),

  // Payment APIs
  choosePayment: jest.fn((options) => {
    // Deprecated, use requestPayment instead
    setTimeout(() => {
      if (options.success) {
        options.success({
          errMsg: 'choosePayment:ok',
        });
      }
    }, 200);
  }),

  requestPayment: jest.fn((options) => {
    // Simulate payment with 90% success rate, 200ms delay
    setTimeout(() => {
      const isSuccess = Math.random() > 0.1;
      if (isSuccess && options.success) {
        options.success({
          errMsg: 'requestPayment:ok',
        });
      } else if (!isSuccess && options.fail) {
        options.fail({
          errMsg: 'requestPayment:fail cancel',
        });
      }
    }, 200);
  }),

  // Navigation APIs
  navigateTo: jest.fn((options) => {
    if (options.success) {
      options.success();
    }
  }),

  navigateBack: jest.fn((options) => {
    if (options.success) {
      options.success();
    }
  }),

  reLaunch: jest.fn((options) => {
    if (options.success) {
      options.success();
    }
  }),

  redirectTo: jest.fn((options) => {
    if (options.success) {
      options.success();
    }
  }),

  switchTab: jest.fn((options) => {
    if (options.success) {
      options.success();
    }
  }),

  // UI APIs
  showToast: jest.fn((options) => {
    // Toast doesn't have callbacks, but we mock it for completeness
  }),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  showActionSheet: jest.fn((options) => {
    if (options.success) {
      options.success({ tapIndex: 0 });
    }
  }),
  previewImage: jest.fn(),
  saveImageToPhotosAlbum: jest.fn((options) => {
    if (options.success) {
      options.success({});
    }
  }),
  openSetting: jest.fn(),
  setNavigationBarTitle: jest.fn(),

  showModal: jest.fn((options) => {
    if (options.success) {
      options.success({
        confirm: true,
        cancel: false,
      });
    }
  }),

  hideToast: jest.fn(),

  // System Info API
  getSystemInfoSync: jest.fn(() => {
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
  }),

  createSelectorQuery: jest.fn(() => ({
    in() {
      return this;
    },
    select() {
      return this;
    },
    fields() {
      return this;
    },
    exec(callback) {
      callback([
        {
          node: {
            width: 0,
            height: 0,
            getContext: () => global.__mockCanvasContext,
            createImage: global.__mockCanvasCreateImage
          },
          width: 1040,
          height: 1600
        }
      ]);
    }
  })),

  canvasToTempFilePath: jest.fn((options) => {
    if (options.success) {
      options.success({
        tempFilePath: '/tmp/mock-long-image.png'
      });
    }
  }),

  // Storage for internal test usage
  __storage: {},
};

// Set test timeout to 5 seconds
jest.setTimeout(5000);
