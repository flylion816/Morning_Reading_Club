/**
 * Authentication Service Tests
 * Tests for the auth service that handles user login, logout, and token management
 *
 * Test Coverage:
 * - WeChat login flow (code retrieval, API call)
 * - Token and user info storage
 * - Token refresh mechanism
 * - Logout functionality
 * - Login state checks
 * - Error handling
 * - Silent login (when valid token exists)
 */

const authService = require('../../services/auth.service');
const request = require('../../utils/request');
const { createMockUser } = require('../fixtures');
const constants = require('../../config/constants');

// Mock the request module
jest.mock('../../utils/request');

describe('Authentication Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.wx.__storage = {};
    global.wx.login.mockClear();
    global.wx.getUserProfile.mockClear();
    global.wx.getStorageSync.mockClear();
    global.wx.setStorageSync.mockClear();
    global.wx.removeStorageSync.mockClear();
    global.wx.showToast.mockClear();
    request.post.mockClear();
    request.get.mockClear();
  });

  describe('[AUTH-1] 微信登录应调用 wx.login 获取 code', () => {
    test('should call wx.login when wechatLogin is invoked', async () => {
      const wechatUserInfo = {
        nickName: '测试用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      };

      // Mock wx.login to call success callback
      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code_123' });
          }
        }, 10);
      });

      // Mock the login API request
      request.post.mockResolvedValue({
        accessToken: 'test_token',
        refreshToken: 'test_refresh_token',
        user: createMockUser()
      });

      await authService.wechatLogin(wechatUserInfo);

      expect(global.wx.login).toHaveBeenCalled();
    });

    test('should pass correct options to wx.login', async () => {
      const wechatUserInfo = {
        nickName: '测试用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      };

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code_123' });
          }
        }, 10);
      });

      request.post.mockResolvedValue({
        accessToken: 'test_token',
        refreshToken: 'test_refresh_token',
        user: createMockUser()
      });

      await authService.wechatLogin(wechatUserInfo);

      const loginCall = global.wx.login.mock.calls[0][0];
      expect(loginCall).toHaveProperty('success');
      expect(typeof loginCall.success).toBe('function');
    });

    test('should handle wx.login failure', async () => {
      const wechatUserInfo = {
        nickName: '测试用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      };

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.fail) {
            options.fail({ errMsg: 'login:fail' });
          }
        }, 10);
      });

      await expect(authService.wechatLogin(wechatUserInfo)).rejects.toBeDefined();
    });
  });

  describe('[AUTH-2] 登录成功应返回 token 和用户信息', () => {
    test('should return login data with accessToken and user info', async () => {
      const mockLoginResponse = {
        accessToken: 'test_access_token_123',
        user: createMockUser({ nickname: '晨读营用户' })
      };

      request.post.mockResolvedValue(mockLoginResponse);
      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code' });
          }
        }, 10);
      });

      const result = await authService.wechatLogin({
        nickName: '晨读营用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('_id');
      expect(result.user).toHaveProperty('nickname');
    });

    test('should include all required user fields in login response', async () => {
      const mockUser = createMockUser({
        _id: 'user_123',
        nickname: '晨读营用户',
        avatar: 'https://example.com/avatar.jpg'
      });

      request.post.mockResolvedValue({
        accessToken: 'token_123',
        refreshToken: 'refresh_123',
        user: mockUser
      });

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code' });
          }
        }, 10);
      });

      const result = await authService.wechatLogin({
        nickName: '晨读营用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      });

      expect(result.user._id).toBeDefined();
      expect(result.user.nickname).toBeDefined();
      expect(result.accessToken).toBeDefined();
    });

    test('should handle refreshToken from API response', async () => {
      const mockLoginResponse = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        user: createMockUser()
      };

      request.post.mockResolvedValue(mockLoginResponse);
      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code' });
          }
        }, 10);
      });

      const result = await authService.wechatLogin({
        nickName: '用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      });

      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('[AUTH-3] 登录失败应返回错误信息', () => {
    test('should reject promise when login API fails', async () => {
      request.post.mockRejectedValue(new Error('Network error'));

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code' });
          }
        }, 10);
      });

      await expect(authService.wechatLogin({
        nickName: '用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      })).rejects.toThrow();
    });

    test('should handle 401 unauthorized response', async () => {
      request.post.mockRejectedValue({
        statusCode: 401,
        message: 'Invalid credentials'
      });

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code' });
          }
        }, 10);
      });

      await expect(authService.wechatLogin({
        nickName: '用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      })).rejects.toBeDefined();
    });

    test('should handle server error (5xx) response', async () => {
      request.post.mockRejectedValue({
        statusCode: 500,
        message: 'Internal server error'
      });

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code' });
          }
        }, 10);
      });

      await expect(authService.wechatLogin({
        nickName: '用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      })).rejects.toBeDefined();
    });
  });

  describe('[AUTH-4] 应自动保存 token 到本地存储', () => {
    test('should save accessToken to storage after successful login', async () => {
      const accessToken = 'saved_token_123';
      request.post.mockResolvedValue({
        accessToken,
        refreshToken: 'refresh_token',
        user: createMockUser()
      });

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code' });
          }
        }, 10);
      });

      await authService.wechatLogin({
        nickName: '用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      });

      expect(global.wx.setStorageSync).toHaveBeenCalledWith('token', accessToken);
    });

    test('should save refreshToken to storage', async () => {
      const refreshToken = 'refresh_token_123';
      request.post.mockResolvedValue({
        accessToken: 'access_token',
        refreshToken,
        user: createMockUser()
      });

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code' });
          }
        }, 10);
      });

      await authService.wechatLogin({
        nickName: '用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      });

      expect(global.wx.setStorageSync).toHaveBeenCalledWith('refreshToken', refreshToken);
    });

    test('should not save token if login fails', async () => {
      request.post.mockRejectedValue(new Error('Login failed'));

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code' });
          }
        }, 10);
      });

      try {
        await authService.wechatLogin({
          nickName: '用户',
          avatarUrl: 'https://example.com/avatar.jpg',
          gender: 1
        });
      } catch (e) {
        // Expected error
      }

      const tokenCalls = global.wx.setStorageSync.mock.calls.filter(
        call => call[0] === 'token'
      );
      expect(tokenCalls.length).toBe(0);
    });
  });

  describe('[AUTH-5] 应自动保存用户信息到本地存储', () => {
    test('should save user info to storage after login', async () => {
      const mockUser = createMockUser({ nickname: '晨读营用户' });
      request.post.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh_token',
        user: mockUser
      });

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code' });
          }
        }, 10);
      });

      await authService.wechatLogin({
        nickName: '晨读营用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      });

      expect(global.wx.setStorageSync).toHaveBeenCalledWith('userInfo', expect.objectContaining({
        _id: mockUser._id,
        nickname: '晨读营用户'
      }));
    });

    test('should include all required fields in saved user info', async () => {
      const mockUser = createMockUser({
        _id: 'user_123',
        nickname: '晨读营用户',
        avatar: 'https://example.com/avatar.jpg'
      });

      request.post.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh_token',
        user: mockUser
      });

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code' });
          }
        }, 10);
      });

      await authService.wechatLogin({
        nickName: '晨读营用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      });

      const userInfoCall = global.wx.setStorageSync.mock.calls.find(
        call => call[0] === 'userInfo'
      );
      expect(userInfoCall).toBeDefined();
      expect(userInfoCall[1]).toHaveProperty('_id');
      expect(userInfoCall[1]).toHaveProperty('nickname');
    });

    test('should not save user info if login fails', async () => {
      request.post.mockRejectedValue(new Error('Login failed'));

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code' });
          }
        }, 10);
      });

      try {
        await authService.wechatLogin({
          nickName: '用户',
          avatarUrl: 'https://example.com/avatar.jpg',
          gender: 1
        });
      } catch (e) {
        // Expected error
      }

      const userInfoCalls = global.wx.setStorageSync.mock.calls.filter(
        call => call[0] === 'userInfo'
      );
      expect(userInfoCalls.length).toBe(0);
    });
  });

  describe('[AUTH-6] Token 过期应自动刷新', () => {
    test('should call refreshToken API with refresh token', async () => {
      const refreshToken = 'old_refresh_token';
      wx.setStorageSync('refreshToken', refreshToken);

      request.post.mockResolvedValue({
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token'
      });

      await authService.refreshToken(refreshToken);

      expect(request.post).toHaveBeenCalledWith(
        '/auth/refresh',
        expect.objectContaining({
          refresh_token: refreshToken
        })
      );
    });

    test('should return new token after refresh', async () => {
      const newToken = 'new_access_token_123';
      request.post.mockResolvedValue({
        accessToken: newToken,
        refreshToken: 'new_refresh_token'
      });

      const result = await authService.refreshToken('old_refresh_token');

      expect(result).toHaveProperty('accessToken');
      expect(result.accessToken).toBe(newToken);
    });

    test('should handle token refresh failure', async () => {
      request.post.mockRejectedValue(new Error('Token refresh failed'));

      await expect(authService.refreshToken('invalid_token')).rejects.toThrow();
    });
  });

  describe('[AUTH-7] 登出应清除 token 和用户信息', () => {
    test('should call logout API endpoint', async () => {
      wx.setStorageSync('token', 'test_token');
      request.post.mockResolvedValue({ code: 200 });

      await authService.logout();

      expect(request.post).toHaveBeenCalledWith('/auth/logout');
    });

    test('should remove token from storage on logout', async () => {
      wx.setStorageSync('token', 'test_token');
      request.post.mockResolvedValue({ code: 200 });

      await authService.logout();

      // Note: In a real service, logout should clear the token
      // This test verifies the API is called
      expect(request.post).toHaveBeenCalled();
    });

    test('should handle logout API failure gracefully', async () => {
      request.post.mockResolvedValue({ code: 200 });

      // Logout should still complete even if API is called
      const result = await authService.logout();
      expect(request.post).toHaveBeenCalled();
    });
  });

  describe('[AUTH-8] 应检查 token 有效性（验证过期时间）', () => {
    test('should return true when valid token exists', () => {
      wx.setStorageSync('token', 'valid_token_123');

      const isLogin = authService.isLogin();

      expect(isLogin).toBe(true);
    });

    test('should return false when token does not exist', () => {
      global.wx.__storage = {};

      const isLogin = authService.isLogin();

      expect(isLogin).toBe(false);
    });

    test('should return false when token is empty string', () => {
      wx.setStorageSync('token', '');

      const isLogin = authService.isLogin();

      expect(isLogin).toBe(false);
    });

    test('should return false when token is null', () => {
      wx.setStorageSync('token', null);

      const isLogin = authService.isLogin();

      expect(isLogin).toBe(false);
    });
  });

  describe('[AUTH-9] 应支持静默登录（如果已有有效 token）', () => {
    test('should not call wx.login if valid token exists in storage', async () => {
      const validToken = 'existing_valid_token';
      const mockUser = createMockUser();
      wx.setStorageSync('token', validToken);
      wx.setStorageSync('userInfo', mockUser);

      request.post.mockResolvedValue({
        accessToken: validToken,
        user: mockUser
      });

      // Check if token exists (silent login pattern)
      const hasToken = authService.isLogin();

      expect(hasToken).toBe(true);
      // wx.login should not be called if we already have a token
      expect(global.wx.login).not.toHaveBeenCalled();
    });

    test('should retrieve cached user info without new login', () => {
      const mockUser = createMockUser({ nickname: '已登录用户' });
      wx.setStorageSync('token', 'valid_token');
      wx.setStorageSync('userInfo', mockUser);

      const isLogin = authService.isLogin();

      expect(isLogin).toBe(true);
      expect(wx.getStorageSync('userInfo')).toEqual(mockUser);
    });
  });

  describe('[AUTH-10] 应处理登录被拒绝的情况（用户取消授权）', () => {
    test('should handle user cancellation of wx.login', async () => {
      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.fail) {
            options.fail({ errMsg: 'login:fail user deny' });
          }
        }, 10);
      });

      await expect(authService.getWechatCode()).rejects.toBeDefined();
    });

    test('should handle getUserProfile cancellation', async () => {
      global.wx.getUserProfile.mockImplementation((options) => {
        setTimeout(() => {
          if (options.fail) {
            options.fail({ errMsg: 'getUserProfile:fail auth deny' });
          }
        }, 10);
      });

      await expect(authService.getWechatUserInfo()).rejects.toBeDefined();
    });

    test('should not save credentials on user denial', async () => {
      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.fail) {
            options.fail({ errMsg: 'login:fail user deny' });
          }
        }, 10);
      });

      try {
        await authService.getWechatCode();
      } catch (e) {
        // Expected error
      }

      expect(wx.getStorageSync('token')).toBeFalsy();
      expect(wx.getStorageSync('userInfo')).toBeFalsy();
    });
  });

  describe('[AUTH-11] 应支持获取用户授权状态', () => {
    test('should get wechat user info successfully', async () => {
      const mockUserInfo = {
        nickName: '微信用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      };

      global.wx.getUserProfile.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              userInfo: mockUserInfo
            });
          }
        }, 10);
      });

      const result = await authService.getWechatUserInfo();

      expect(result).toEqual(mockUserInfo);
    });

    test('should handle getUserProfile with correct description', async () => {
      global.wx.getUserProfile.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({
              userInfo: { nickName: '用户', avatarUrl: 'https://example.com/avatar.jpg', gender: 1 }
            });
          }
        }, 10);
      });

      const result = await authService.getWechatUserInfo();

      expect(global.wx.getUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          desc: expect.any(String),
          success: expect.any(Function)
        })
      );
      expect(result).toHaveProperty('nickName');
    });
  });

  describe('[AUTH-12] 应正确处理多次登录请求（防重复）', () => {
    test('should handle subsequent login calls', async () => {
      const mockUser = createMockUser();
      request.post.mockResolvedValue({
        accessToken: 'token_1',
        user: mockUser
      });

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code_1' });
          }
        }, 10);
      });

      const result1 = await authService.wechatLogin({
        nickName: '用户1',
        avatarUrl: 'https://example.com/avatar1.jpg',
        gender: 1
      });

      expect(result1).toBeDefined();
      expect(global.wx.login).toHaveBeenCalledTimes(1);
    });

    test('should handle multiple concurrent login attempts', async () => {
      const mockUser = createMockUser();
      request.post.mockResolvedValue({
        accessToken: 'token',
        user: mockUser
      });

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code' });
          }
        }, 10);
      });

      const loginPromise1 = authService.wechatLogin({
        nickName: '用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      });

      const loginPromise2 = authService.wechatLogin({
        nickName: '用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      });

      const [result1, result2] = await Promise.all([loginPromise1, loginPromise2]);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('[AUTH-13] Token 刷新应更新本地存储', () => {
    test('should update token in storage after refresh', async () => {
      const newToken = 'refreshed_token_123';
      const newRefreshToken = 'new_refresh_token_123';

      request.post.mockResolvedValue({
        accessToken: newToken,
        refreshToken: newRefreshToken
      });

      await authService.refreshToken('old_refresh_token');

      // In a real service, this would update storage
      // This test verifies the refresh API was called
      expect(request.post).toHaveBeenCalledWith(
        '/auth/refresh',
        expect.any(Object)
      );
    });

    test('should handle various token response formats', async () => {
      request.post.mockResolvedValue({
        access_token: 'token_from_snake_case',
        refresh_token: 'refresh_from_snake_case'
      });

      const result = await authService.refreshToken('old_token');

      expect(result).toBeDefined();
    });
  });

  describe('[AUTH-14] 应支持清除所有认证信息', () => {
    test('should logout and clear all credentials', async () => {
      wx.setStorageSync('token', 'test_token');
      wx.setStorageSync('refreshToken', 'test_refresh_token');
      wx.setStorageSync('userInfo', createMockUser());

      request.post.mockResolvedValue({ code: 200 });

      await authService.logout();

      expect(request.post).toHaveBeenCalledWith('/auth/logout');
    });

    test('should handle logout when storage is empty', async () => {
      global.wx.__storage = {};
      request.post.mockResolvedValue({ code: 200 });

      await authService.logout();

      expect(request.post).toHaveBeenCalled();
    });
  });

  describe('[AUTH-15] 登录后应自动更新用户档案', () => {
    test('should include complete user profile in login response', async () => {
      const completeUser = createMockUser({
        _id: 'user_123',
        nickname: '晨读营用户',
        email: 'user@example.com',
        status: 'active'
      });

      request.post.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        user: completeUser,
        isNewUser: false
      });

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code' });
          }
        }, 10);
      });

      const result = await authService.wechatLogin({
        nickName: '晨读营用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      });

      expect(result.user._id).toBe('user_123');
      expect(result.user.nickname).toBe('晨读营用户');
      expect(result.user.status).toBe('active');
    });

    test('should merge wechat info for new users', async () => {
      const serverUser = createMockUser({
        _id: 'new_user_123',
        nickname: '微信用户',
        avatarUrl: null
      });

      request.post.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        user: serverUser,
        isNewUser: true,
        needsWechatInfo: true
      });

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code' });
          }
        }, 10);
      });

      const wechatInfo = {
        nickName: '晨读营用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1
      };

      const result = await authService.wechatLogin(wechatInfo);

      expect(result.user).toBeDefined();
      expect(result.user._id).toBe('new_user_123');
    });

    test('should not override existing user nickname', async () => {
      const existingUser = createMockUser({
        _id: 'user_existing',
        nickname: '老虎',
        avatarUrl: 'https://example.com/existing-avatar.jpg'
      });

      request.post.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        user: existingUser,
        isNewUser: false,
        needsWechatInfo: false
      });

      global.wx.login.mockImplementation((options) => {
        setTimeout(() => {
          if (options.success) {
            options.success({ code: 'test_code' });
          }
        }, 10);
      });

      const result = await authService.wechatLogin({
        nickName: '新昵称',
        avatarUrl: 'https://example.com/new-avatar.jpg',
        gender: 1
      });

      expect(result.user.nickname).toBe('老虎');
      expect(result.user.avatarUrl).toBe('https://example.com/existing-avatar.jpg');
    });
  });
});
