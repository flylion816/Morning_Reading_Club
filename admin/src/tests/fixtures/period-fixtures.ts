/**
 * 期次相关的测试数据工厂函数
 * 用于 Admin 项目的单元测试
 */

export interface MockPeriod {
  id?: string;
  _id?: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  price?: number;
  maxEnrollment?: number;
  status?: string;
  isPublished?: boolean;
  enrollmentCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: unknown;
}

/**
 * 创建期次 Mock 对象
 */
export const createMockPeriod = (overrides: Partial<MockPeriod> = {}): MockPeriod => ({
  id: 'period-001',
  _id: 'period-001',
  name: '心流之境',
  description: '第一期晨读营，深入探讨个人成长和自我提升',
  startDate: '2025-03-01',
  endDate: '2025-03-23',
  price: 99,
  maxEnrollment: 100,
  status: 'active',
  isPublished: true,
  enrollmentCount: 45,
  createdAt: new Date('2025-02-01'),
  updatedAt: new Date('2025-02-28'),
  ...overrides
});

/**
 * 创建多个期次
 */
export const createMockPeriods = (count = 3, overrides: Partial<MockPeriod> = {}): MockPeriod[] =>
  Array.from({ length: count }, (_, i) => {
    const startDate = new Date('2025-03-01');
    startDate.setMonth(startDate.getMonth() + i);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 22);

    return createMockPeriod({
      id: `period-${String(i + 1).padStart(3, '0')}`,
      _id: `period-${String(i + 1).padStart(3, '0')}`,
      name: `期次${i + 1}`,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      enrollmentCount: 20 + i * 10,
      ...overrides
    });
  });

/**
 * 创建草稿状态的期次
 */
export const createMockDraftPeriod = (overrides: Partial<MockPeriod> = {}): MockPeriod =>
  createMockPeriod({
    status: 'draft',
    isPublished: false,
    ...overrides
  });

/**
 * 创建已结束的期次
 */
export const createMockClosedPeriod = (overrides: Partial<MockPeriod> = {}): MockPeriod =>
  createMockPeriod({
    status: 'closed',
    isPublished: true,
    startDate: '2025-01-01',
    endDate: '2025-01-23',
    ...overrides
  });

/**
 * 创建满员的期次
 */
export const createMockFullPeriod = (overrides: Partial<MockPeriod> = {}): MockPeriod =>
  createMockPeriod({
    maxEnrollment: 100,
    enrollmentCount: 100,
    ...overrides
  });

/**
 * 创建即将开始的期次（今天后3天）
 */
export const createMockUpcomingPeriod = (overrides: Partial<MockPeriod> = {}): MockPeriod => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 3);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 22);

  return createMockPeriod({
    status: 'active',
    isPublished: true,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    ...overrides
  });
};
