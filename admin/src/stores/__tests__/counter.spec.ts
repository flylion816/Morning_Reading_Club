/**
 * Counter Store 单元测试
 * 覆盖所有 state、getters、actions 相关场景
 * 共 6 个测试用例
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCounterStore } from '@/stores/counter';

describe('CounterStore - useCounterStore()', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============ State 测试 (2 个) ============
  describe('State Initialization', () => {
    it('[State-1] 应该初始化计数器为 0', () => {
      const store = useCounterStore();
      expect(store.count).toBe(0);
    });

    it('[State-2] 应该允许直接修改 count 值', () => {
      const store = useCounterStore();

      store.count = 5;
      expect(store.count).toBe(5);

      store.count = 100;
      expect(store.count).toBe(100);

      store.count = -10;
      expect(store.count).toBe(-10);

      store.count = 0;
      expect(store.count).toBe(0);
    });
  });

  // ============ Getters 测试 (2 个) ============
  describe('Getters', () => {
    it('[Getter-1] doubleCount 应该返回 count 的两倍', () => {
      const store = useCounterStore();

      expect(store.doubleCount).toBe(0);

      store.count = 5;
      expect(store.doubleCount).toBe(10);

      store.count = 0;
      expect(store.doubleCount).toBe(0);

      store.count = -5;
      expect(store.doubleCount).toBe(-10);
    });

    it('[Getter-2] doubleCount 应该是只读的计算属性', () => {
      const store = useCounterStore();
      store.count = 7;

      expect(store.doubleCount).toBe(14);

      // 尝试直接赋值（在 TypeScript 编译时就会失败）
      // 这里用 any 来演示运行时行为
      (store.doubleCount as any) = 100;

      // 但计算属性的值不应该改变，仍然是 count * 2
      expect(store.doubleCount).toBe(14);
    });
  });

  // ============ Actions 测试 (2 个) ============
  describe('Actions', () => {
    it('[Action-1] increment() 应该增加计数器', () => {
      const store = useCounterStore();
      expect(store.count).toBe(0);

      store.increment();
      expect(store.count).toBe(1);

      store.increment();
      expect(store.count).toBe(2);

      store.increment();
      expect(store.count).toBe(3);
    });

    it('[Action-2] increment() 应该支持多次连续调用', () => {
      const store = useCounterStore();

      for (let i = 0; i < 10; i++) {
        store.increment();
      }

      expect(store.count).toBe(10);
      expect(store.doubleCount).toBe(20);
    });
  });

  // ============ 状态一致性测试 (1 个) ============
  describe('State Consistency', () => {
    it('[Consistency-1] 不同的 store 实例应该是独立的', () => {
      setActivePinia(createPinia());
      const store1 = useCounterStore();
      store1.increment();
      expect(store1.count).toBe(1);

      // 创建新的 pinia 实例，模拟新会话
      setActivePinia(createPinia());
      const store2 = useCounterStore();
      expect(store2.count).toBe(0); // 新实例应该重新初始化

      // 原实例不受影响
      expect(store1.count).toBe(1);
    });
  });
});
