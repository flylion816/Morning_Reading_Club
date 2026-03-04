/**
 * 期次管理 API 单元测试
 */

import { describe, it, expect } from 'vitest';
import { periodApi } from '../api';

describe('Period API', () => {
  it('应该导出 getPeriods 方法', () => {
    const result = periodApi.getPeriods();
    expect(result).toBeInstanceOf(Promise);

    const withParams = periodApi.getPeriods({ page: 1, limit: 20 });
    expect(withParams).toBeInstanceOf(Promise);
  });

  it('应该导出 getPeriodDetail 方法，接受 id 参数', () => {
    const result = periodApi.getPeriodDetail('period-001');
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 createPeriod 方法，接受数据参数', () => {
    const result = periodApi.createPeriod({ name: 'New Period' });
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 updatePeriod 方法', () => {
    const result = periodApi.updatePeriod('period-001', { name: 'Updated Period' });
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 deletePeriod 方法，接受 id 参数', () => {
    const result = periodApi.deletePeriod('period-001');
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 getSections 方法', () => {
    const result = periodApi.getSections('period-001');
    expect(result).toBeInstanceOf(Promise);

    const withParams = periodApi.getSections('period-001', { page: 1 });
    expect(withParams).toBeInstanceOf(Promise);
  });

  it('应该导出 createSection 方法', () => {
    const result = periodApi.createSection('period-001', { title: 'New Section' });
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 updateSection 方法', () => {
    const result = periodApi.updateSection('section-001', { title: 'Updated Section' });
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 deleteSection 方法，接受 id 参数', () => {
    const result = periodApi.deleteSection('section-001');
    expect(result).toBeInstanceOf(Promise);
  });
});
