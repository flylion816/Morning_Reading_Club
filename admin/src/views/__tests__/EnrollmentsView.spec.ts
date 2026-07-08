import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(__dirname, '../EnrollmentsView.vue'),
  'utf8'
);

describe('EnrollmentsView', () => {
  it('provides enrollment management and form statistics tabs', () => {
    expect(source).toContain('el-tabs');
    expect(source).toContain('name="list"');
    expect(source).toContain('name="statistics"');
    expect(source).toContain('报名信息统计');
  });

  it('loads form statistics and renders major analysis sections', () => {
    expect(source).toContain('enrollmentApi.getFormStatistics');
    expect(source).toContain('性别分布');
    expect(source).toContain('年龄分布');
    expect(source).toContain('地区分布');
    expect(source).toContain('缘起分析');
    expect(source).toContain('期待分析');
    expect(source).toContain('报名填写明细');
  });
});
