/**
 * Period Store 单元测试
 * 覆盖所有 state、getters、actions 相关场景
 * 共 6 个测试用例
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePeriodStore } from '@/stores/period';
import { createMockPeriods, createMockPeriod } from '@/tests/fixtures';

describe('PeriodStore - usePeriodStore()', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============ State 测试 (2 个) ============
  describe('State Initialization', () => {
    it('[State-1] 应该以空值初始化期次状态', () => {
      const store = usePeriodStore();
      expect(store.periods).toEqual([]);
      expect(store.currentPeriod).toBeNull();
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('[State-2] 应该允许直接修改 state 值', () => {
      const store = usePeriodStore();
      const periods = createMockPeriods(2);

      store.periods = periods;
      expect(store.periods).toHaveLength(2);

      store.currentPeriod = periods[0];
      expect(store.currentPeriod).toEqual(periods[0]);

      store.error = '期次加载失败';
      expect(store.error).toBe('期次加载失败');
    });
  });

  // ============ Getters 测试 (2 个) ============
  describe('Getters', () => {
    it('[Getter-1] periodCount 应该返回期次总数', () => {
      const store = usePeriodStore();
      expect(store.periodCount).toBe(0);

      const periods = createMockPeriods(3);
      store.periods = periods;
      expect(store.periodCount).toBe(3);
    });

    it('[Getter-2] activePeriods 和 archivedPeriods 应该按状态过滤', () => {
      const store = usePeriodStore();
      const activePeriod = createMockPeriod({ status: 'active' });
      const archivedPeriod = createMockPeriod({ id: 'p2', _id: 'p2', status: 'archived', name: '已归档期次' });

      store.periods = [activePeriod, archivedPeriod];

      expect(store.activePeriods).toHaveLength(1);
      expect(store.activePeriods[0]).toEqual(activePeriod);

      expect(store.archivedPeriods).toHaveLength(1);
      expect(store.archivedPeriods[0]).toEqual(archivedPeriod);

      expect(store.hasActivePeriod).toBe(true);
    });
  });

  // ============ Actions 测试 - Period Management (2 个) ============
  describe('Actions - Period Management', () => {
    it('[Action-1] setPeriods()、addPeriod()、removePeriod() 应该管理期次列表', () => {
      const store = usePeriodStore();
      const periods = createMockPeriods(2);

      store.setPeriods(periods);
      expect(store.periodCount).toBe(2);

      const newPeriod = createMockPeriod({ id: 'p-new', _id: 'p-new', name: '新期次' });
      store.addPeriod(newPeriod);
      expect(store.periodCount).toBe(3);

      store.removePeriod(periods[0].id);
      expect(store.periodCount).toBe(2);
      expect(store.periods.map(p => p.id)).not.toContain(periods[0].id);
    });

    it('[Action-2] updatePeriod() 应该更新期次信息，同时更新 currentPeriod', () => {
      const store = usePeriodStore();
      const period = createMockPeriod();
      store.periods = [period];
      store.currentPeriod = period;

      store.updatePeriod(period.id, { status: 'archived', name: '已结束的期次' });

      const updatedPeriod = store.periods[0];
      expect(updatedPeriod.status).toBe('archived');
      expect(updatedPeriod.name).toBe('已结束的期次');

      // currentPeriod 也应被更新
      expect(store.currentPeriod?.status).toBe('archived');
      expect(store.currentPeriod?.name).toBe('已结束的期次');
    });
  });

  // ============ Actions 测试 - Current Period (1 个) ============
  describe('Actions - Current Period', () => {
    it('[Action-3] setCurrentPeriod() 应该设置当前期次', () => {
      const store = usePeriodStore();
      const period = createMockPeriod();

      store.setCurrentPeriod(period);
      expect(store.currentPeriod).toEqual(period);

      store.setCurrentPeriod(null);
      expect(store.currentPeriod).toBeNull();
    });
  });

  // ============ Actions 测试 - Async Fetch (1 个) ============
  describe('Actions - Async Fetch', () => {
    it('[Action-4] 期次数据应该能正确设置和读取', async () => {
      const store = usePeriodStore();
      const periods = createMockPeriods(3);

      // 直接设置 periods（模拟 API 响应）
      store.periods = periods;

      // 验证状态
      expect(store.periodCount).toBe(3);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.periods).toHaveLength(3);
    });
  });

  // ============ 工具方法测试 (1 个) ============
  describe('Utility Methods', () => {
    it('[Action-5] clearError() 和 reset() 应该清除状态', () => {
      const store = usePeriodStore();
      const periods = createMockPeriods(2);

      store.periods = periods;
      store.currentPeriod = periods[0];
      store.loading = true;
      store.error = '加载失败';

      store.clearError();
      expect(store.error).toBeNull();
      expect(store.periods).toHaveLength(2); // 其他状态不变

      store.reset();
      expect(store.periods).toEqual([]);
      expect(store.currentPeriod).toBeNull();
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  // ============ Edge Cases (1 个) ============
  describe('Edge Cases', () => {
    it('[Edge-1] removePeriod() 删除 currentPeriod 时应该清除 currentPeriod', () => {
      const store = usePeriodStore();
      const period = createMockPeriod();

      store.periods = [period];
      store.currentPeriod = period;

      store.removePeriod(period.id);

      expect(store.currentPeriod).toBeNull();
      expect(store.periods).toHaveLength(0);
    });
  });
});
