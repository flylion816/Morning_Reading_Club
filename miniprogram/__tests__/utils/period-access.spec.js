jest.mock('../../services/enrollment.service', () => ({
  checkEnrollment: jest.fn()
}));

const enrollmentService = require('../../services/enrollment.service');
const { getPeriodAccess, findEnrollmentForPeriod } = require('../../utils/period-access');

describe('Period Access Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('应该将 pending 报名识别为锁定状态', async () => {
    enrollmentService.checkEnrollment.mockResolvedValue({
      isEnrolled: true,
      paymentStatus: 'pending',
      enrollmentId: 'enroll_1'
    });

    const result = await getPeriodAccess('period_1');

    expect(result).toEqual(
      expect.objectContaining({
        periodId: 'period_1',
        isEnrolled: true,
        paymentStatus: 'pending',
        paymentPending: true,
        canAccessCommunity: false,
        communityAccessState: 'locked',
        communityLocked: true
      })
    );
  });

  test('应该将 paid 报名识别为开放状态', async () => {
    enrollmentService.checkEnrollment.mockResolvedValue({
      isEnrolled: true,
      paymentStatus: 'paid',
      enrollmentId: 'enroll_2'
    });

    const result = await getPeriodAccess('period_2');

    expect(result).toEqual(
      expect.objectContaining({
        periodId: 'period_2',
        isEnrolled: true,
        paymentStatus: 'paid',
        paymentPending: false,
        canAccessCommunity: true,
        communityAccessState: 'enabled',
        communityLocked: false
      })
    );
  });

  test('应该从 enrollmentList 中匹配当前期次并沿用其支付状态', async () => {
    const enrollmentList = [
      {
        _id: 'enroll_3',
        periodId: { _id: 'period_3' },
        status: 'active',
        paymentStatus: 'pending'
      },
      {
        _id: 'enroll_4',
        periodId: { _id: 'period_4' },
        status: 'completed',
        paymentStatus: 'paid'
      }
    ];

    const matched = findEnrollmentForPeriod(enrollmentList, 'period_4');
    const result = await getPeriodAccess('period_4', { enrollmentList, skipRequest: true });

    expect(matched).toEqual(expect.objectContaining({ _id: 'enroll_4' }));
    expect(enrollmentService.checkEnrollment).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        periodId: 'period_4',
        paymentStatus: 'paid',
        canAccessCommunity: true,
        communityAccessState: 'enabled'
      })
    );
  });
});
