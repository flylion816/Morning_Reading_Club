/**
 * Vitest 全局测试配置
 * 在所有测试运行前执行
 */

import { beforeAll, afterAll, afterEach } from 'vitest';
import { config } from '@vue/test-utils';

// Vue Test Utils 全局配置
beforeAll(() => {
  // 配置全局属性
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

  // 清理 localStorage
  localStorage.clear();

  // 清理 sessionStorage
  sessionStorage.clear();
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
