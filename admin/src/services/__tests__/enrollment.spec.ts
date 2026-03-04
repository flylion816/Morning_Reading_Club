/**
 * 报名管理 API 单元测试
 */

import { describe, it, expect } from 'vitest';
import { enrollmentApi } from '../api';

describe('Enrollment API', () => {
  it('应该导出 getEnrollments 方法，并接受可选参数', () => {
    const result = enrollmentApi.getEnrollments();
    expect(result).toBeInstanceOf(Promise);

    const withParams = enrollmentApi.getEnrollments({ page: 1, limit: 10 });
    expect(withParams).toBeInstanceOf(Promise);
  });

  it('应该导出 getEnrollmentDetail 方法，接受 id 参数', () => {
    const result = enrollmentApi.getEnrollmentDetail('enrollment-001');
    expect(result).toBeInstanceOf(Promise);
  });

  it('应该导出 approveEnrollment 方法，接受 id 参数', () => {
    const result = enrollmentApi.approveEnrollment('enrollment-001');
    expect(result).toBeInstanceOf(Promise);

    const withData = enrollmentApi.approveEnrollment('enrollment-001', { remarks: 'Approved' });
    expect(withData).toBeInstanceOf(Promise);
  });

  it('应该导出 rejectEnrollment 方法，接受 id 参数', () => {
    const result = enrollmentApi.rejectEnrollment('enrollment-001');
    expect(result).toBeInstanceOf(Promise);

    const withData = enrollmentApi.rejectEnrollment('enrollment-001', { reason: 'Not qualified' });
    expect(withData).toBeInstanceOf(Promise);
  });

  it('应该导出 updateEnrollment 方法，接受 id 和 data 参数', () => {
    const result = enrollmentApi.updateEnrollment('enrollment-001', { status: 'confirmed' });
    expect(result).toBeInstanceOf(Promise);
  });
});
