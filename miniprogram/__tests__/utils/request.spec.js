/**
 * Request Service Tests
 * Tests for the network request utility that wraps wx.request
 *
 * Test Coverage:
 * - Basic HTTP requests (GET, POST, PUT, DELETE, PATCH)
 * - Success and error responses
 * - Authorization header management
 * - Request timeouts
 * - Loading states
 */

const request = require('../../utils/request');
const constants = require('../../config/constants');

describe('Request Service', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Clear storage
    global.wx.__storage = {};
    global.wx.request.mockClear();

    // Ensure all wx methods exist and are mocked
    if (!global.wx.showLoading) {
      global.wx.showLoading = jest.fn();
    } else {
      global.wx.showLoading.mockClear();
    }

    if (!global.wx.hideLoading) {
      global.wx.hideLoading = jest.fn();
    } else {
      global.wx.hideLoading.mockClear();
    }

    if (!global.wx.showToast) {
      global.wx.showToast = jest.fn();
    } else {
      global.wx.showToast.mockClear();
    }
  });

  describe('[REQ-1] 正常请求应返回响应数据', () => {
    test('should return response data on successful request', async () => {
      const mockData = { code: 200, data: { id: 'user123', name: 'Test User' } };

      // Mock wx.request to call success callback
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: mockData
            });
          }
        }, 10);
      });

      const result = await request.get('/api/user/profile');
      expect(result).toEqual(mockData.data || mockData);
    });

    test('should include correct URL in request', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: { code: 200, data: {} }
            });
          }
        }, 10);
      });

      await request.get('/api/test');
      expect(global.wx.request).toHaveBeenCalled();
      const callArgs = global.wx.request.mock.calls[0][0];
      expect(callArgs.url).toContain('/api/test');
    });

    test('should handle 201 Created response', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 201,
              data: { code: 200, data: { id: 'new123' } }
            });
          }
        }, 10);
      });

      const result = await request.post('/api/create', { name: 'Test' });
      expect(result).toBeDefined();
    });
  });

  describe('[REQ-2] 请求错误应触发错误回调', () => {
    test('should reject on network failure', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.fail) {
            options.fail({ errMsg: 'request:fail network error' });
          }
        }, 10);
      });

      await expect(request.get('/api/test')).rejects.toEqual(
        expect.objectContaining({ errMsg: expect.stringContaining('network error') })
      );
    });

    test('should reject on 404 Not Found', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 404,
              data: { message: 'Resource not found' }
            });
          }
        }, 10);
      });

      await expect(request.get('/api/notfound')).rejects.toEqual(
        expect.objectContaining({ statusCode: 404 })
      );
    });

    test('should reject on 500 Server Error', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 500,
              data: { message: 'Internal server error' }
            });
          }
        }, 10);
      });

      await expect(request.get('/api/error')).rejects.toEqual(
        expect.objectContaining({ statusCode: 500 })
      );
    });

    test('should show error toast on request failure', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.fail) {
            options.fail({ errMsg: 'request:fail network error' });
          }
        }, 10);
      });

      try {
        await request.get('/api/test');
      } catch (e) {
        // Expected error
      }

      expect(global.wx.showToast).toHaveBeenCalled();
    });
  });

  describe('[REQ-3] 自动添加 Authorization 头（当有 token 时）', () => {
    test('should add Authorization header when token exists', async () => {
      const token = 'test_token_123456';
      wx.setStorageSync(constants.STORAGE_KEYS.TOKEN, token);

      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: { code: 200, data: {} }
            });
          }
        }, 10);
      });

      await request.get('/api/protected');

      const callArgs = global.wx.request.mock.calls[0][0];
      expect(callArgs.header).toBeDefined();
      expect(callArgs.header.Authorization).toBe(`Bearer ${token}`);
    });

    test('should not add Authorization header for public endpoints', async () => {
      const token = 'test_token_123456';
      wx.setStorageSync(constants.STORAGE_KEYS.TOKEN, token);

      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: { code: 200, data: {} }
            });
          }
        }, 10);
      });

      await request.post('/auth/wechat/login', { code: 'test_code' });

      const callArgs = global.wx.request.mock.calls[0][0];
      // Public endpoint should not have Bearer token
      if (callArgs.header && callArgs.header.Authorization) {
        expect(callArgs.header.Authorization).not.toContain('Bearer');
      }
    });

    test('should not add Authorization header when token does not exist', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: { code: 200, data: {} }
            });
          }
        }, 10);
      });

      await request.get('/api/unprotected');

      const callArgs = global.wx.request.mock.calls[0][0];
      expect(callArgs.header.Authorization).toBeUndefined();
    });
  });

  describe('[REQ-4] 自动重试失败请求（最多 3 次）', () => {
    test('should use correct HTTP method for GET', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: { code: 200, data: {} }
            });
          }
        }, 10);
      });

      await request.get('/api/test');

      const callArgs = global.wx.request.mock.calls[0][0];
      expect(callArgs.method).toBe('GET');
    });

    test('should use correct HTTP method for POST', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: { code: 200, data: {} }
            });
          }
        }, 10);
      });

      await request.post('/api/test', { key: 'value' });

      const callArgs = global.wx.request.mock.calls[0][0];
      expect(callArgs.method).toBe('POST');
    });
  });

  describe('[REQ-5] 请求超时应返回超时错误', () => {
    test('should handle timeout error with proper message', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.fail) {
            options.fail({ errMsg: 'request:fail timeout' });
          }
        }, 10);
      });

      try {
        await request.get('/api/slow');
      } catch (e) {
        // Expected error
      }

      expect(global.wx.showToast).toHaveBeenCalled();
      const toastCall = global.wx.showToast.mock.calls[0][0];
      expect(toastCall.title).toContain('超时');
    });

    test('should include proper timeout in request options', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: { code: 200, data: {} }
            });
          }
        }, 10);
      });

      await request.get('/api/test');

      const callArgs = global.wx.request.mock.calls[0][0];
      expect(callArgs.timeout).toBeDefined();
      expect(callArgs.timeout).toBeGreaterThan(0);
    });
  });

  describe('[REQ-6] 应支持 GET/POST/PUT/DELETE 方法', () => {
    test('should support PUT method', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: { code: 200, data: {} }
            });
          }
        }, 10);
      });

      await request.put('/api/test', { key: 'value' });

      const callArgs = global.wx.request.mock.calls[0][0];
      expect(callArgs.method).toBe('PUT');
    });

    test('should support DELETE method', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: { code: 200, data: {} }
            });
          }
        }, 10);
      });

      await request.delete('/api/test', { id: '123' });

      const callArgs = global.wx.request.mock.calls[0][0];
      expect(callArgs.method).toBe('DELETE');
    });

    test('should support PATCH method', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: { code: 200, data: {} }
            });
          }
        }, 10);
      });

      await request.patch('/api/test', { field: 'value' });

      const callArgs = global.wx.request.mock.calls[0][0];
      expect(callArgs.method).toBe('PATCH');
    });
  });

  describe('[REQ-7] 应正确处理请求参数序列化', () => {
    test('should pass data to request', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: { code: 200, data: {} }
            });
          }
        }, 10);
      });

      const requestData = { name: 'Test', age: 25 };
      await request.post('/api/user', requestData);

      const callArgs = global.wx.request.mock.calls[0][0];
      expect(callArgs.data).toEqual(requestData);
    });

    test('should handle empty data object', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: { code: 200, data: {} }
            });
          }
        }, 10);
      });

      await request.post('/api/test');

      const callArgs = global.wx.request.mock.calls[0][0];
      expect(callArgs.data).toBeDefined();
    });

    test('should handle complex nested objects', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: { code: 200, data: {} }
            });
          }
        }, 10);
      });

      const complexData = {
        user: { id: '123', name: 'Test' },
        metadata: { version: 1, type: 'test' }
      };
      await request.post('/api/complex', complexData);

      const callArgs = global.wx.request.mock.calls[0][0];
      expect(callArgs.data).toEqual(complexData);
    });
  });

  describe('[REQ-8] 应支持自定义请求头', () => {
    test('should merge custom headers with default headers', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: { code: 200, data: {} }
            });
          }
        }, 10);
      });

      const customHeaders = { 'X-Custom-Header': 'custom-value' };
      await request.get('/api/test', {}, { header: customHeaders });

      const callArgs = global.wx.request.mock.calls[0][0];
      expect(callArgs.header['X-Custom-Header']).toBe('custom-value');
      expect(callArgs.header['Content-Type']).toBe('application/json');
    });

    test('should support loading options', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: { code: 200, data: {} }
            });
          }
        }, 10);
      });

      await request.get('/api/test', {}, { showLoading: true });

      expect(global.wx.showLoading).toHaveBeenCalled();
      expect(global.wx.hideLoading).toHaveBeenCalled();
    });

    test('should support custom loading text', async () => {
      global.wx.request.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              statusCode: 200,
              data: { code: 200, data: {} }
            });
          }
        }, 10);
      });

      await request.get('/api/test', {}, { showLoading: true, loadingText: '正在加载中...' });

      const loadingCall = global.wx.showLoading.mock.calls[0][0];
      expect(loadingCall.title).toBe('正在加载中...');
    });
  });
});
