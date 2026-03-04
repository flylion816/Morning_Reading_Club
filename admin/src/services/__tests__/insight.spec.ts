/**
 * 小凡看见 API 单元测试
 */

import { describe, it, expect } from 'vitest';
import { insightApi } from '../api';

describe('Insight API', () => {
  it('应该导出 getInsights 方法', () => {
    const result = insightApi.getInsights();
    expect(result).toBeInstanceOf(Promise);

    const withParams = insightApi.getInsights({ page: 1, isPublished: true });
    expect(withParams).toBeInstanceOf(Promise);
  });

  it('应该导出 getInsightsByPeriod 方法', () => {
    const result = insightApi.getInsightsByPeriod('period-001');
    expect(result).toBeInstanceOf(Promise);

    const withParams = insightApi.getInsightsByPeriod('period-001', { page: 1 });
    expect(withParams).toBeInstanceOf(Promise);
  });

  it('应该导出 getInsightDetail 方法，接受 id 参数', () => {
    const result = insightApi.getInsightDetail('insight-001');
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 createInsight 方法', () => {
    const result = insightApi.createInsight({ content: 'New insight' });
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 updateInsight 方法', () => {
    const result = insightApi.updateInsight('insight-001', { content: 'Updated' });
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 deleteInsight 方法，接受 id 参数', () => {
    const result = insightApi.deleteInsight('insight-001');
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 publishInsight 方法，接受 id 参数', () => {
    const result = insightApi.publishInsight('insight-001');
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 unpublishInsight 方法，接受 id 参数', () => {
    const result = insightApi.unpublishInsight('insight-001');
    expect(result).toBeInstanceOf(Promise);
  });
});
