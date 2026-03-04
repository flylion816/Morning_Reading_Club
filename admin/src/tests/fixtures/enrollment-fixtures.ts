/**
 * 报名相关的测试数据工厂函数
 * 用于 Admin 项目的单元测试
 */

export interface MockEnrollment {
  id?: string;
  _id?: string;
  userId: string;
  periodId: string;
  status?: string;
  enrollmentDate?: Date;
  paymentStatus?: string;
  paymentDate?: Date | null;
  amount?: number;
  [key: string]: unknown;
}

/**
 * 创建报名 Mock 对象
 */
export const createMockEnrollment = (overrides: Partial<MockEnrollment> = {}): MockEnrollment => ({
  id: 'enrollment-001',
  _id: 'enrollment-001',
  userId: 'user-001',
  periodId: 'period-001',
  status: 'confirmed',
  enrollmentDate: new Date('2025-02-20'),
  paymentStatus: 'paid',
  paymentDate: new Date('2025-02-21'),
  amount: 99,
  ...overrides
});

/**
 * 创建多个报名记录
 */
export const createMockEnrollments = (count = 5, overrides: Partial<MockEnrollment> = {}): MockEnrollment[] =>
  Array.from({ length: count }, (_, i) =>
    createMockEnrollment({
      id: `enrollment-${String(i + 1).padStart(3, '0')}`,
      _id: `enrollment-${String(i + 1).padStart(3, '0')}`,
      userId: `user-${String(i + 1).padStart(3, '0')}`,
      periodId: 'period-001',
      enrollmentDate: new Date(2025, 1, 20 + i),
      ...overrides
    })
  );

/**
 * 创建待审核的报名
 */
export const createMockPendingEnrollment = (overrides: Partial<MockEnrollment> = {}): MockEnrollment =>
  createMockEnrollment({
    status: 'pending',
    paymentStatus: 'pending',
    paymentDate: null,
    ...overrides
  });

/**
 * 创建已拒绝的报名
 */
export const createMockRejectedEnrollment = (overrides: Partial<MockEnrollment> = {}): MockEnrollment =>
  createMockEnrollment({
    status: 'rejected',
    paymentStatus: 'refunded',
    ...overrides
  });

/**
 * 创建未支付的报名
 */
export const createMockUnpaidEnrollment = (overrides: Partial<MockEnrollment> = {}): MockEnrollment =>
  createMockEnrollment({
    status: 'pending',
    paymentStatus: 'unpaid',
    paymentDate: null,
    ...overrides
  });

/**
 * 创建已支付的报名
 */
export const createMockPaidEnrollment = (overrides: Partial<MockEnrollment> = {}): MockEnrollment =>
  createMockEnrollment({
    status: 'confirmed',
    paymentStatus: 'paid',
    paymentDate: new Date('2025-02-21'),
    ...overrides
  });

/**
 * 创建已取消的报名
 */
export const createMockCancelledEnrollment = (overrides: Partial<MockEnrollment> = {}): MockEnrollment =>
  createMockEnrollment({
    status: 'cancelled',
    paymentStatus: 'refunded',
    ...overrides
  });
