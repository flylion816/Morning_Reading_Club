/**
 * Vitest 全局测试配置
 * 在所有测试运行前执行
 */

import { beforeAll, afterAll, afterEach } from 'vitest';
import { config } from '@vue/test-utils';
import { createMockLocalStorage, createMockSessionStorage } from './helpers/mock-helpers';

// 全局初始化 localStorage 和 sessionStorage
beforeAll(() => {
  // 如果 localStorage 不存在或不可用，使用 mock
  if (typeof localStorage === 'undefined' || !localStorage.getItem) {
    (global as any).localStorage = createMockLocalStorage();
  }
  if (typeof sessionStorage === 'undefined' || !sessionStorage.getItem) {
    (global as any).sessionStorage = createMockSessionStorage();
  }

  // Vue Test Utils 全局配置
  config.global.mocks = {
    $t: (key: string) => key // Mock i18n
  };

  // 配置全局组件（如需要）
  // config.global.components = {
  //   ElButton: true,
  //   ElInput: true
  // }

  // 配置全局插件
  // config.global.plugins = []
});

// 每个测试后清理
afterEach(() => {
  // 清理 DOM
  document.body.innerHTML = '';

  // 清理 localStorage（如果存在的话）
  if (typeof localStorage !== 'undefined' && localStorage.clear) {
    localStorage.clear();
  }

  // 清理 sessionStorage（如果存在的话）
  if (typeof sessionStorage !== 'undefined' && sessionStorage.clear) {
    sessionStorage.clear();
  }
});

// 所有测试完成后
afterAll(() => {
  // 清理工作
});

// 全局Mock
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {}
  })
});
