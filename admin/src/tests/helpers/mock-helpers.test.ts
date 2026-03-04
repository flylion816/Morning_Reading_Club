/**
 * Mock Helpers 的单元测试
 * 验证所有 mock 辅助函数的正确性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockResponse,
  createMockApiSuccess,
  createMockApiError,
  mockApiGet,
  mockApiPost,
  mockApiPut,
  mockApiPatch,
  mockApiDelete,
  mockApiFailure,
  createMockStoreGetter,
  createMockStoreAction,
  createMockStoreMutation,
  createMockRouter,
  createMockRouteParams,
  createMockLocalStorage,
  createMockSessionStorage,
  mockWindowAlert,
  mockConsoleLog,
  mockConsoleError,
  mockConsoleWarn,
  waitFor,
  delay,
  resetAllMocks,
  restoreAllMocks,
} from './mock-helpers';

describe('Mock Helpers', () => {
  afterEach(() => {
    restoreAllMocks();
  });

  describe('createMockResponse', () => {
    it('应该创建一个链式调用的 mock response', () => {
      const response = createMockResponse();
      expect(response.status).toBeDefined();
      expect(response.json).toBeDefined();
      expect(response.send).toBeDefined();
      expect(response.statusCode).toBe(200);
    });

    it('status 方法应该被定义为函数', () => {
      const response = createMockResponse();
      expect(typeof response.status).toBe('function');
    });

    it('json 方法应该被定义为函数', () => {
      const response = createMockResponse();
      expect(typeof response.json).toBe('function');
    });

    it('send 方法应该被定义为函数', () => {
      const response = createMockResponse();
      expect(typeof response.send).toBe('function');
    });
  });

  describe('API 响应创建函数', () => {
    it('createMockApiSuccess 应该返回正确的成功响应格式', () => {
      const result = createMockApiSuccess({ id: 1 }, 'Success');
      expect(result.code).toBe(200);
      expect(result.message).toBe('Success');
      expect(result.data).toEqual({ id: 1 });
    });

    it('createMockApiSuccess 应该支持空数据', () => {
      const result = createMockApiSuccess();
      expect(result.code).toBe(200);
      expect(result.data).toEqual({});
    });

    it('createMockApiError 应该返回正确的错误响应格式', () => {
      const result = createMockApiError(400, 'Bad Request');
      expect(result.code).toBe(400);
      expect(result.message).toBe('Bad Request');
      expect(result.data).toBeNull();
    });

    it('createMockApiError 应该支持自定义数据字段', () => {
      const errorData = { field: 'email', reason: 'invalid' };
      const result = createMockApiError(422, 'Validation Error', errorData);
      expect(result.code).toBe(422);
      expect(result.data).toEqual(errorData);
    });
  });

  describe('API 请求 mock 函数', () => {
    it('mockApiGet 应该返回解析后的 Promise', async () => {
      const getStub = mockApiGet(vi, { id: 1, name: 'Test' });
      const result = await getStub();
      expect(result.code).toBe(200);
      expect(result.data.id).toBe(1);
    });

    it('mockApiPost 应该支持自定义返回值', async () => {
      const postStub = mockApiPost(vi, { created: true, id: 123 });
      const result = await postStub();
      expect(result.data.created).toBe(true);
      expect(result.data.id).toBe(123);
    });

    it('mockApiPut 应该返回更新结果', async () => {
      const putStub = mockApiPut(vi, { updated: true });
      const result = await putStub();
      expect(result.data.updated).toBe(true);
    });

    it('mockApiPatch 应该返回部分更新结果', async () => {
      const patchStub = mockApiPatch(vi, { patched: true });
      const result = await patchStub();
      expect(result.data.patched).toBe(true);
    });

    it('mockApiDelete 应该返回删除结果', async () => {
      const deleteStub = mockApiDelete(vi, { deleted: true });
      const result = await deleteStub();
      expect(result.data.deleted).toBe(true);
    });

    it('mockApiFailure 应该返回被拒绝的 Promise', async () => {
      const failureStub = mockApiFailure(vi, 500, 'Server Error');
      try {
        await failureStub();
        expect.fail('应该抛出错误');
      } catch (error: any) {
        expect(error.response.code).toBe(500);
        expect(error.response.message).toBe('Server Error');
      }
    });
  });

  describe('Pinia Store mock 函数', () => {
    it('createMockStoreGetter 应该返回一个函数', () => {
      const getter = createMockStoreGetter({ count: 10 });
      expect(getter).toBeDefined();
      expect(getter()).toEqual({ count: 10 });
    });

    it('createMockStoreAction 应该返回一个异步函数', async () => {
      const action = createMockStoreAction({ success: true });
      const result = await action();
      expect(result).toEqual({ success: true });
    });

    it('createMockStoreMutation 应该返回一个可被跟踪的函数', () => {
      const mutation = createMockStoreMutation(vi);
      expect(mutation).toBeDefined();
      mutation({ state: 'test' });
      expect(mutation).toHaveBeenCalled();
    });
  });

  describe('Vue Router mock', () => {
    it('createMockRouter 应该有 push、replace、go、back 方法', () => {
      const router = createMockRouter();
      expect(router.push).toBeDefined();
      expect(router.replace).toBeDefined();
      expect(router.go).toBeDefined();
      expect(router.back).toBeDefined();
      expect(router.forward).toBeDefined();
    });

    it('router.push 应该返回解析后的 Promise', async () => {
      const router = createMockRouter();
      const result = await router.push('/test');
      expect(result).toBe(true);
    });

    it('createMockRouteParams 应该返回路由参数对象', () => {
      const params = createMockRouteParams();
      expect(params.path).toBe('/');
      expect(params.name).toBe('Home');
      expect(params.params).toBeDefined();
      expect(params.query).toBeDefined();
    });

    it('createMockRouteParams 应该支持覆盖参数', () => {
      const params = createMockRouteParams({ path: '/users', name: 'Users', params: { id: 123 } });
      expect(params.path).toBe('/users');
      expect(params.name).toBe('Users');
      expect(params.params.id).toBe(123);
    });
  });

  describe('Storage mock', () => {
    it('createMockLocalStorage 应该模拟 localStorage 的所有方法', () => {
      const localStorage = createMockLocalStorage();
      localStorage.setItem('test', 'value');
      expect(localStorage.getItem('test')).toBe('value');
      localStorage.removeItem('test');
      expect(localStorage.getItem('test')).toBeNull();
    });

    it('localStorage.clear 应该清空所有数据', () => {
      const localStorage = createMockLocalStorage();
      localStorage.setItem('key1', 'value1');
      localStorage.setItem('key2', 'value2');
      expect(localStorage.length).toBe(2);
      localStorage.clear();
      expect(localStorage.length).toBe(0);
      expect(localStorage.getItem('key1')).toBeNull();
    });

    it('localStorage.key 应该返回指定索引的键', () => {
      const localStorage = createMockLocalStorage();
      localStorage.setItem('a', '1');
      localStorage.setItem('b', '2');
      const firstKey = localStorage.key(0);
      expect(firstKey).toBeTruthy();
    });

    it('createMockSessionStorage 应该模拟 sessionStorage', () => {
      const sessionStorage = createMockSessionStorage();
      sessionStorage.setItem('session-test', 'session-value');
      expect(sessionStorage.getItem('session-test')).toBe('session-value');
      sessionStorage.removeItem('session-test');
      expect(sessionStorage.getItem('session-test')).toBeNull();
    });
  });

  describe('Window 和 Console mock', () => {
    it('mockWindowAlert 应该返回一个 mock 函数', () => {
      const alertMock = mockWindowAlert(vi);
      expect(typeof alertMock).toBe('function');
    });

    it('mockConsoleLog 应该模拟 console.log', () => {
      const logSpy = mockConsoleLog(vi);
      console.log('test message');
      expect(logSpy).toHaveBeenCalled();
    });

    it('mockConsoleError 应该模拟 console.error', () => {
      const errorSpy = mockConsoleError(vi);
      console.error('error message');
      expect(errorSpy).toHaveBeenCalled();
    });

    it('mockConsoleWarn 应该模拟 console.warn', () => {
      const warnSpy = mockConsoleWarn(vi);
      console.warn('warning message');
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('异步工具函数', () => {
    it('delay 应该返回一个 Promise', async () => {
      const result = delay(10);
      expect(result instanceof Promise).toBe(true);
    });

    it('waitFor 应该返回一个 Promise', () => {
      const promise = waitFor(() => true, 2000);
      expect(promise instanceof Promise).toBe(true);
    });
  });

  describe('Mock 重置和恢复', () => {
    it('resetAllMocks 应该是一个函数', () => {
      expect(typeof resetAllMocks).toBe('function');
    });

    it('restoreAllMocks 应该是一个函数', () => {
      expect(typeof restoreAllMocks).toBe('function');
    });
  });
});
