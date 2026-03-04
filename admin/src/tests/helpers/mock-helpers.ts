/**
 * Mock 辅助函数库
 * 提供与后端完全一致的 mock 工具函数
 * 用于 services、stores、components 的单元测试
 */

import { vi } from 'vitest';

/**
 * 创建 Mock API 响应对象
 * 支持链式调用，模拟 Express response 对象
 */
export const createMockResponse = (sandbox: typeof vi = vi) => {
  const response = {
    statusCode: 200,
    data: {},
    status: sandbox.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: sandbox.fn(function (this: any, data: any) {
      this.data = data;
      return this;
    }),
    send: sandbox.fn(function (this: any, data: any) {
      this.data = data;
      return this;
    }),
  };
  // 绑定 this 上下文
  response.status = response.status.bind(response);
  response.json = response.json.bind(response);
  response.send = response.send.bind(response);
  return response;
};

/**
 * 创建 Mock API 调用结果（成功）
 * 保持与后端 API 响应格式一致：{ code, message, data }
 */
export const createMockApiSuccess = (data: Record<string, unknown> = {}, message = 'Success') => ({
  code: 200,
  message,
  data,
});

/**
 * 创建 Mock API 错误响应
 */
export const createMockApiError = (code = 400, message = 'Bad Request', data = null) => ({
  code,
  message,
  data,
});

/**
 * Mock API 服务的 GET 请求
 */
export const mockApiGet = (sandbox: typeof vi = vi, returnValue: Record<string, unknown> = {}) => {
  return sandbox.fn(async () => createMockApiSuccess(returnValue));
};

/**
 * Mock API 服务的 POST 请求
 */
export const mockApiPost = (sandbox: typeof vi = vi, returnValue: Record<string, unknown> = {}) => {
  return sandbox.fn(async () => createMockApiSuccess(returnValue));
};

/**
 * Mock API 服务的 PUT 请求
 */
export const mockApiPut = (sandbox: typeof vi = vi, returnValue: Record<string, unknown> = {}) => {
  return sandbox.fn(async () => createMockApiSuccess(returnValue));
};

/**
 * Mock API 服务的 PATCH 请求
 */
export const mockApiPatch = (sandbox: typeof vi = vi, returnValue: Record<string, unknown> = {}) => {
  return sandbox.fn(async () => createMockApiSuccess(returnValue));
};

/**
 * Mock API 服务的 DELETE 请求
 */
export const mockApiDelete = (sandbox: typeof vi = vi, returnValue: Record<string, unknown> = {}) => {
  return sandbox.fn(async () => createMockApiSuccess(returnValue));
};

/**
 * Mock API 请求失败
 */
export const mockApiFailure = (sandbox: typeof vi = vi, code = 500, message = 'Internal Server Error') => {
  const error: unknown = new Error(message);
  (error as Record<string, unknown>).response = createMockApiError(code, message);
  return sandbox.fn(async () => {
    throw error;
  });
};

/**
 * Mock Pinia Store 的 getter
 */
export const createMockStoreGetter = <T = unknown>(value: T) => {
  return vi.fn(() => value);
};

/**
 * Mock Pinia Store 的 action
 */
export const createMockStoreAction = <T = unknown>(returnValue: T = undefined as unknown as T, sandbox: typeof vi = vi) => {
  return sandbox.fn(async () => returnValue);
};

/**
 * Mock Pinia Store 的 mutation
 */
export const createMockStoreMutation = (sandbox: typeof vi = vi) => {
  return sandbox.fn();
};

/**
 * 创建完整的 Mock Pinia Store
 */
export const createMockStore = (sandbox: typeof vi = vi) => {
  return {
    state: sandbox.fn(() => ({})),
    getters: {},
    actions: {},
    mutations: {},
  };
};

/**
 * Mock Vue Router
 */
export const createMockRouter = (sandbox: typeof vi = vi) => ({
  push: sandbox.fn(async () => true),
  replace: sandbox.fn(async () => true),
  go: sandbox.fn(),
  back: sandbox.fn(),
  forward: sandbox.fn(),
  currentRoute: { value: { path: '/', name: 'Home', params: {}, query: {} } },
  options: { history: {} },
});

/**
 * Mock Vue Router 的路由参数
 */
export const createMockRouteParams = (overrides: Record<string, unknown> = {}) => ({
  path: '/',
  name: 'Home',
  params: {},
  query: {},
  meta: {},
  ...overrides,
});

/**
 * Mock localStorage
 */
export const createMockLocalStorage = () => {
  const store: Record<string, string> = {};
  const keyOrder: string[] = [];  // 维护插入顺序，确保 key() 方法的稳定性

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      if (!keyOrder.includes(key)) {
        keyOrder.push(key);
      }
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
      const index = keyOrder.indexOf(key);
      if (index > -1) {
        keyOrder.splice(index, 1);
      }
    },
    clear: () => {
      Object.keys(store).forEach(key => delete store[key]);
      keyOrder.length = 0;
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      return keyOrder[index] || null;
    },
  };
};

/**
 * Mock sessionStorage
 */
export const createMockSessionStorage = () => {
  const store: Record<string, string> = {};
  const keyOrder: string[] = [];  // 维护插入顺序，确保 key() 方法的稳定性

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      if (!keyOrder.includes(key)) {
        keyOrder.push(key);
      }
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
      const index = keyOrder.indexOf(key);
      if (index > -1) {
        keyOrder.splice(index, 1);
      }
    },
    clear: () => {
      Object.keys(store).forEach(key => delete store[key]);
      keyOrder.length = 0;
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      return keyOrder[index] || null;
    },
  };
};

/**
 * Mock window 对象的方法
 */
export const mockWindowAlert = (sandbox: typeof vi = vi) => {
  const mockAlert = sandbox.fn();
  (window as unknown).alert = mockAlert;
  return mockAlert;
};

/**
 * Mock console 的方法
 */
export const mockConsoleLog = (sandbox: typeof vi = vi) => {
  return sandbox.spyOn(console, 'log').mockImplementation(() => {});
};

export const mockConsoleError = (sandbox: typeof vi = vi) => {
  return sandbox.spyOn(console, 'error').mockImplementation(() => {});
};

export const mockConsoleWarn = (sandbox: typeof vi = vi) => {
  return sandbox.spyOn(console, 'warn').mockImplementation(() => {});
};

/**
 * 创建异步等待函数，用于测试异步操作
 */
export const waitFor = (callback: () => boolean, timeout = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (callback()) {
        clearInterval(interval);
        resolve();
      }
      if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        reject(new Error(`waitFor timeout after ${timeout}ms`));
      }
    }, 10);
  });
};

/**
 * 创建延迟 Promise
 */
export const delay = (ms = 100): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Mock HTTP 请求拦截器
 */
export const createMockHttpInterceptor = (sandbox: typeof vi = vi) => ({
  request: {
    use: sandbox.fn(),
    eject: sandbox.fn(),
  },
  response: {
    use: sandbox.fn(),
    eject: sandbox.fn(),
  },
});

/**
 * 重置所有 mock 函数
 */
export const resetAllMocks = () => {
  vi.clearAllMocks();
};

/**
 * 恢复所有 spy
 */
export const restoreAllMocks = () => {
  vi.restoreAllMocks();
};
