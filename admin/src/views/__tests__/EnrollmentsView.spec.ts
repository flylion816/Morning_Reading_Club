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

  it('guards statistics results against stale period requests', () => {
    expect(source).toContain('const requestedPeriodId = statisticsFilters.value.periodId');
    expect(source).toContain('const requestId = ++statisticsRequestId');
    expect(source).toContain('requestId !== statisticsRequestId');
    expect(source).toContain('requestedPeriodId !== statisticsFilters.value.periodId');
  });

  it('offers admin cancellation and shows the resulting enrollment status', () => {
    expect(source).toContain('label="报名状态"');
    expect(source).toContain('formatEnrollmentStatus(row.status)');
    expect(source).toContain('handleCancelEnrollment(row)');
    expect(source).toContain('enrollmentApi.cancelEnrollment(enrollment._id)');
    expect(source).toContain('withdrawn: \'已取消\'');
  });
});
