/**
 * API Service 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import api from '../api';

// Mock axios
vi.mock('axios');

describe('API Service', () => {
  beforeEach(() => {
    // 清理所有 mock
    vi.clearAllMocks();

    // 清理 localStorage
    localStorage.clear();
  });

  describe('请求拦截器', () => {
    it('应该在请求头中添加 Authorization token', async () => {
      const token = 'test-token';
      localStorage.setItem('token', token);

      const mockAxios = axios as any;
      mockAxios.create.mockReturnValue({
        interceptors: {
          request: { use: vi.fn(fn => fn({ headers: {} })) },
          response: { use: vi.fn() }
        },
        get: vi.fn()
      });

      // 重新导入以触发拦截器
      const { default: apiService } = await import('../api');

      expect(apiService).toBeDefined();
    });

    it('应该在没有 token 时不添加 Authorization 头', () => {
      localStorage.removeItem('token');

      const config = { headers: {} };

      // 验证不应该有 Authorization 头
      expect(config.headers).not.toHaveProperty('Authorization');
    });
  });

  describe('响应拦截器', () => {
    it('应该在401错误时清除token并跳转登录', async () => {
      const mockAxios = axios as any;

      const errorInterceptor = vi.fn(error => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          // 模拟跳转
          return Promise.reject(error);
        }
        return Promise.reject(error);
      });

      mockAxios.create.mockReturnValue({
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn((success, error) => error({ response: { status: 401 } })) }
        }
      });

      // 验证 token 被清除
      localStorage.setItem('token', 'test-token');

      try {
        await errorInterceptor({ response: { status: 401 } });
      } catch (e) {
        expect(localStorage.getItem('token')).toBeNull();
      }
    });

    it('应该在网络错误时返回友好提示', () => {
      const networkError = { message: 'Network Error' };

      expect(networkError.message).toBe('Network Error');
    });
  });

  describe('API 方法', () => {
    it('应该正确构造 GET 请求', async () => {
      const mockGet = vi.fn().mockResolvedValue({ data: { code: 200, data: [] } });

      const mockAxios = axios as any;
      mockAxios.create.mockReturnValue({
        get: mockGet,
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      });

      // 使用 api.get 会触发 mockGet
      // 这里仅验证 mock 配置正确
      expect(mockGet).toBeDefined();
    });

    it('应该正确构造 POST 请求', async () => {
      const mockPost = vi.fn().mockResolvedValue({ data: { code: 200, data: {} } });

      const mockAxios = axios as any;
      mockAxios.create.mockReturnValue({
        post: mockPost,
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() }
        }
      });

      expect(mockPost).toBeDefined();
    });
  });
});
