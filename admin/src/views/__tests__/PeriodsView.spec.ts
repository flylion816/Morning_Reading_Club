import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, '../PeriodsView.vue'), 'utf8');

describe('PeriodsView', () => {
  it('gives the fixed operation column an opaque background', () => {
    expect(source).toContain('.el-table-fixed-column--right.el-table__cell');
    expect(source).toContain('background-color: var(--admin-surface-strong, var(--el-bg-color, #fff)) !important;');
    expect(source).toContain('tr.el-table__row--striped > td.el-table-fixed-column--right');
  });

  it('includes reading access and enrollment template controls', () => {
    expect(source).toContain('无需报名即可阅读');
    expect(source).toContain('报名后阅读');
    expect(source).toContain('EnrollmentTemplatePicker');
    expect(source).toContain('报名后阅读的期次请选择报名模板');
  });

  it('allows selecting an enrollment template for legacy periods without one', () => {
    expect(source).toContain('function hasEnrollmentTemplate(period: Period)');
    expect(source).toContain(
      'enrollmentTemplateLocked.value = !!row.enrollmentTemplateLocked && hasEnrollmentTemplate(row)'
    );
  });
});
