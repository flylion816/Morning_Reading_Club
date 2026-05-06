jest.mock('../../services/enrollment.service', () => ({
  checkEnrollment: jest.fn()
}));

const enrollmentService = require('../../services/enrollment.service');
const {
  getPeriodAccess,
  findEnrollmentForPeriod,
  isFreshOptimisticEnrollmentAccess
} = require('../../utils/period-access');

describe('Period Access Utility', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = {
      globalData: {
        userInfo: { _id: 'user_1' },
        _enrollmentCache: {}
      }
    };
    global.getApp = jest.fn(() => app);
  });

  afterEach(() => {
    delete global.getApp;
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

  test('应该保留未过期的乐观缓存', async () => {
    const cachedAccess = {
      periodId: 'period_5',
      isEnrolled: true,
      paymentStatus: 'paid',
      enrollmentId: 'enroll_5',
      paymentPending: false,
      canAccessCommunity: true,
      communityAccessState: 'enabled',
      communityLocked: false,
      syncPending: true,
      syncPendingExpiresAt: new Date(Date.now() + 60 * 1000).toISOString()
    };

    app.globalData._enrollmentCache.user_1 = {
      period_5: cachedAccess
    };

    const result = await getPeriodAccess('period_5');

    expect(isFreshOptimisticEnrollmentAccess(cachedAccess)).toBe(true);
    expect(enrollmentService.checkEnrollment).not.toHaveBeenCalled();
    expect(result).toEqual(cachedAccess);
  });

  test('应该让过期的乐观缓存回退到后端状态', async () => {
    const staleAccess = {
      periodId: 'period_6',
      isEnrolled: true,
      paymentStatus: 'paid',
      enrollmentId: 'enroll_6',
      paymentPending: false,
      canAccessCommunity: true,
      communityAccessState: 'enabled',
      communityLocked: false,
      syncPending: true,
      syncPendingExpiresAt: new Date(Date.now() - 60 * 1000).toISOString()
    };

    app.globalData._enrollmentCache.user_1 = {
      period_6: staleAccess
    };

    enrollmentService.checkEnrollment.mockResolvedValue({
      isEnrolled: false,
      paymentStatus: null,
      enrollmentId: null
    });

    const result = await getPeriodAccess('period_6');

    expect(enrollmentService.checkEnrollment).toHaveBeenCalledWith('period_6');
    expect(result).toEqual(
      expect.objectContaining({
        periodId: 'period_6',
        isEnrolled: false,
        paymentStatus: null,
        canAccessCommunity: false,
        communityAccessState: 'locked'
      })
    );
  });

  test('skipRequest 也应该优先命中乐观缓存', async () => {
    const cachedAccess = {
      periodId: 'period_7',
      isEnrolled: true,
      paymentStatus: 'paid',
      enrollmentId: 'enroll_7',
      paymentPending: false,
      canAccessCommunity: true,
      communityAccessState: 'enabled',
      communityLocked: false,
      syncPending: true,
      syncPendingExpiresAt: new Date(Date.now() + 60 * 1000).toISOString()
    };

    app.globalData._enrollmentCache.user_1 = {
      period_7: cachedAccess
    };

    const result = await getPeriodAccess('period_7', {
      skipRequest: true
    });

    expect(result).toEqual(cachedAccess);
    expect(enrollmentService.checkEnrollment).not.toHaveBeenCalled();
  });

  test('enrollmentList + skipRequest 也应该优先命中乐观缓存', async () => {
    const cachedAccess = {
      periodId: 'period_8',
      isEnrolled: true,
      paymentStatus: 'paid',
      enrollmentId: 'enroll_8',
      paymentPending: false,
      canAccessCommunity: true,
      communityAccessState: 'enabled',
      communityLocked: false,
      syncPending: true,
      syncPendingExpiresAt: new Date(Date.now() + 60 * 1000).toISOString()
    };

    app.globalData._enrollmentCache.user_1 = {
      period_8: cachedAccess
    };

    const result = await getPeriodAccess('period_8', {
      enrollmentList: [
        {
          _id: 'enroll_old',
          periodId: { _id: 'period_8' },
          status: 'active',
          paymentStatus: 'pending'
        }
      ],
      skipRequest: true
    });

    expect(result).toEqual(cachedAccess);
    expect(enrollmentService.checkEnrollment).not.toHaveBeenCalled();
  });
});
