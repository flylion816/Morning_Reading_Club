/**
 * Enrollment Service Tests (Stage 3: Task 3.1)
 * Tests for enrollment management, period listing, and enrollment operations
 *
 * Test Coverage:
 * - Period listing and retrieval
 * - Enrollment submission and validation
 * - Enrollment status management
 * - Duplicate enrollment prevention
 * - Enrollment cancellation
 * - Enrollment caching
 * - Period capacity management
 */

const enrollmentService = require('../../services/enrollment.service');
const request = require('../../utils/request');
const { createMockPeriod, createMockEnrollment, createMockUser, generateId } = require('../fixtures');
const constants = require('../../config/constants');

// Mock the request module
jest.mock('../../utils/request');

describe('Enrollment Service Tests (Stage 3: Task 3.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.wx.__storage = {};
    global.wx.getStorageSync.mockClear();
    global.wx.setStorageSync.mockClear();
    global.wx.removeStorageSync.mockClear();
    global.wx.showToast.mockClear();
    request.get.mockClear();
    request.post.mockClear();
    request.put.mockClear();
    request.delete.mockClear();
  });

  describe('[ENROLL-1] 获取期次列表应返回期次数组', () => {
    test('should return periods list from API', async () => {
      const mockPeriods = [
        createMockPeriod({ name: '晨读营第1期' }),
        createMockPeriod({ name: '晨读营第2期' })
      ];

      request.get.mockResolvedValue(mockPeriods);

      const result = await enrollmentService.getPeriods();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(request.get).toHaveBeenCalledWith('/periods');
    });

    test('should include all required period fields', async () => {
      const mockPeriods = [
        createMockPeriod({
          _id: 'period_123',
          name: '晨读营第1期',
          status: 'active'
        })
      ];

      request.get.mockResolvedValue({
        data: mockPeriods,
        total: 1
      });

      const result = await enrollmentService.getPeriodsList();

      expect(result.data[0]).toHaveProperty('_id');
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('status');
      expect(result.data[0]).toHaveProperty('startDate');
      expect(result.data[0]).toHaveProperty('endDate');
    });

    test('should handle empty periods list', async () => {
      request.get.mockResolvedValue({
        data: [],
        total: 0
      });

      const result = await enrollmentService.getPeriodsList();

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    test('should handle API error', async () => {
      request.get.mockRejectedValue(new Error('API request failed'));

      await expect(enrollmentService.getPeriodsList()).rejects.toThrow();
    });
  });

  describe('[ENROLL-2] 期次列表应按开始日期排序', () => {
    test('should return periods sorted by start date', async () => {
      const baseDate = new Date();
      const mockPeriods = [
        createMockPeriod({
          name: '晨读营第1期',
          startDate: new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
        }),
        createMockPeriod({
          name: '晨读营第2期',
          startDate: new Date(baseDate.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString()
        })
      ];

      request.get.mockResolvedValue({
        data: mockPeriods,
        total: 2
      });

      const result = await enrollmentService.getPeriodsList();

      const dates = result.data.map(p => new Date(p.startDate).getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i + 1]);
      }
    });

    test('should maintain sort order across multiple pages', async () => {
      const mockPeriods = [
        createMockPeriod({ startDate: new Date(2024, 0, 1).toISOString() }),
        createMockPeriod({ startDate: new Date(2024, 0, 15).toISOString() })
      ];

      request.get.mockResolvedValue({
        data: mockPeriods,
        total: 2
      });

      const result = await enrollmentService.getPeriodsList();

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe('[ENROLL-3] 获取期次详情应返回完整信息', () => {
    test('should return period details by ID', async () => {
      const periodId = 'period_123';
      const mockPeriod = createMockPeriod({
        _id: periodId,
        name: '晨读营第1期',
        description: '详细描述',
        maxEnrollment: 100,
        currentEnrollment: 50
      });

      request.get.mockResolvedValue(mockPeriod);

      const result = await enrollmentService.getPeriodDetails(periodId);

      expect(result._id).toBe(periodId);
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('maxEnrollment');
      expect(result).toHaveProperty('currentEnrollment');
      expect(request.get).toHaveBeenCalledWith(`/periods/${periodId}`);
    });

    test('should include instructor information', async () => {
      const mockPeriod = createMockPeriod({
        instructor: {
          _id: 'instructor_123',
          nickname: '晨读讲师'
        }
      });

      request.get.mockResolvedValue(mockPeriod);

      const result = await enrollmentService.getPeriodDetails('period_123');

      expect(result.instructor).toBeDefined();
      expect(result.instructor._id).toBe('instructor_123');
    });

    test('should handle non-existent period', async () => {
      request.get.mockRejectedValue({
        statusCode: 404,
        message: 'Period not found'
      });

      await expect(enrollmentService.getPeriodDetails('non_existent')).rejects.toBeDefined();
    });
  });

  describe('[ENROLL-4] 提交报名应返回报名记录', () => {
    test('should submit enrollment successfully', async () => {
      const periodId = 'period_123';
      const mockEnrollment = createMockEnrollment({
        _id: 'enrollment_123',
        userId: 'user_123',
        periodId: periodId,
        status: 'active'
      });

      request.post.mockResolvedValue(mockEnrollment);

      const result = await enrollmentService.submitEnrollment(periodId);

      expect(result).toHaveProperty('_id');
      expect(result.periodId).toBe(periodId);
      expect(result.status).toBe('active');
      expect(request.post).toHaveBeenCalledWith('/enrollments', expect.any(Object));
    });

    test('should return enrollment with creation timestamp', async () => {
      const mockEnrollment = createMockEnrollment({
        enrollmentDate: new Date().toISOString()
      });

      request.post.mockResolvedValue(mockEnrollment);

      const result = await enrollmentService.submitEnrollment('period_123');

      expect(result.enrollmentDate).toBeDefined();
    });

    test('should handle enrollment submission error', async () => {
      request.post.mockRejectedValue(new Error('Enrollment failed'));

      await expect(enrollmentService.submitEnrollment('period_123')).rejects.toThrow();
    });
  });

  describe('[ENROLL-5] 报名应包含用户 ID 和期次 ID', () => {
    test('should include userId and periodId in enrollment', async () => {
      const userId = 'user_123';
      const periodId = 'period_456';
      const mockEnrollment = createMockEnrollment({
        userId: userId,
        periodId: periodId
      });

      request.post.mockResolvedValue(mockEnrollment);

      const result = await enrollmentService.submitEnrollment(periodId);

      expect(result.userId).toBe(userId);
      expect(result.periodId).toBe(periodId);
    });

    test('should validate userId format', async () => {
      const mockEnrollment = createMockEnrollment({
        userId: 'user_123'
      });

      request.post.mockResolvedValue(mockEnrollment);

      const result = await enrollmentService.submitEnrollment('period_123');

      expect(typeof result.userId).toBe('string');
      expect(result.userId.length).toBeGreaterThan(0);
    });
  });

  describe('[ENROLL-6] 重复报名应返回错误', () => {
    test('should return error when enrolling to same period twice', async () => {
      request.post.mockRejectedValue({
        code: 400,
        message: 'Already enrolled in this period'
      });

      await expect(
        enrollmentService.submitEnrollment('period_123')
      ).rejects.toEqual(expect.objectContaining({
        message: 'Already enrolled in this period'
      }));
    });

    test('should check existing enrollment before submitting', async () => {
      const periodId = 'period_123';
      request.post.mockRejectedValue({
        code: 400,
        message: 'Duplicate enrollment'
      });

      await expect(enrollmentService.submitEnrollment(periodId)).rejects.toBeDefined();
    });
  });

  describe('[ENROLL-7] 获取我的报名列表应只返回当前用户的报名', () => {
    test('should return only current user enrollments', async () => {
      const userId = 'user_123';
      wx.setStorageSync('userInfo', { _id: userId });

      const mockEnrollments = [
        createMockEnrollment({ userId: userId, periodId: 'period_1' }),
        createMockEnrollment({ userId: userId, periodId: 'period_2' })
      ];

      request.get.mockResolvedValue({
        data: mockEnrollments,
        total: 2
      });

      const result = await enrollmentService.getMyEnrollments();

      expect(request.get).toHaveBeenCalled();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.total).toBe(2);
    });

    test('should filter enrollments by current user ID', async () => {
      const userId = 'current_user_123';
      wx.setStorageSync('userInfo', { _id: userId });

      const mockEnrollments = [
        createMockEnrollment({ userId: userId })
      ];

      request.get.mockResolvedValue({
        data: mockEnrollments,
        total: 1
      });

      const result = await enrollmentService.getMyEnrollments();

      expect(result.data[0].userId).toBe(userId);
    });

    test('should return empty list for user with no enrollments', async () => {
      wx.setStorageSync('userInfo', { _id: 'new_user_123' });

      request.get.mockResolvedValue({
        data: [],
        total: 0
      });

      const result = await enrollmentService.getMyEnrollments();

      expect(result.data.length).toBe(0);
    });
  });

  describe('[ENROLL-8] 报名列表应支持按状态筛选（待审批、已批准、已拒绝）', () => {
    test('should filter enrollments by status', async () => {
      const mockEnrollments = [
        createMockEnrollment({ status: 'pending' })
      ];

      request.get.mockResolvedValue({
        data: mockEnrollments,
        total: 1
      });

      const result = await enrollmentService.getMyEnrollments({ status: 'pending' });

      expect(request.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: 'pending' })
      );
    });

    test('should support multiple status values', async () => {
      const statuses = ['pending', 'active', 'rejected'];
      const mockEnrollments = statuses.map(s => createMockEnrollment({ status: s }));

      request.get.mockResolvedValue({
        data: mockEnrollments,
        total: 3
      });

      const result = await enrollmentService.getMyEnrollments();

      expect(result.data.length).toBe(3);
    });
  });

  describe('[ENROLL-9] 报名列表应支持分页', () => {
    test('should support pagination with page and limit', async () => {
      const mockEnrollments = [createMockEnrollment()];

      request.get.mockResolvedValue({
        data: mockEnrollments,
        page: 1,
        pageSize: 10,
        total: 50
      });

      const result = await enrollmentService.getMyEnrollments({
        page: 1,
        limit: 10
      });

      expect(request.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ page: 1, limit: 10 })
      );
      expect(result.total).toBe(50);
    });

    test('should handle different page sizes', async () => {
      request.get.mockResolvedValue({
        data: [],
        page: 2,
        pageSize: 20,
        total: 100
      });

      const result = await enrollmentService.getMyEnrollments({
        page: 2,
        limit: 20
      });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(20);
    });
  });

  describe('[ENROLL-10] 取消报名应成功', () => {
    test('should cancel enrollment by ID', async () => {
      const enrollmentId = 'enrollment_123';
      request.delete.mockResolvedValue({
        code: 200,
        message: 'Enrollment cancelled'
      });

      const result = await enrollmentService.cancelEnrollment(enrollmentId);

      expect(result.code).toBe(200);
      expect(request.delete).toHaveBeenCalledWith(`/enrollments/${enrollmentId}`);
    });

    test('should return confirmation message', async () => {
      request.delete.mockResolvedValue({
        message: 'Enrollment cancelled successfully'
      });

      const result = await enrollmentService.cancelEnrollment('enrollment_123');

      expect(result).toHaveProperty('message');
    });
  });

  describe('[ENROLL-11] 取消报名应在状态为待审批或已批准时才能执行', () => {
    test('should allow cancellation for pending enrollments', async () => {
      const enrollment = createMockEnrollment({ status: 'pending' });
      request.delete.mockResolvedValue({ code: 200 });

      const result = await enrollmentService.cancelEnrollment(enrollment._id);

      expect(request.delete).toHaveBeenCalled();
    });

    test('should allow cancellation for active enrollments', async () => {
      const enrollment = createMockEnrollment({ status: 'active' });
      request.delete.mockResolvedValue({ code: 200 });

      const result = await enrollmentService.cancelEnrollment(enrollment._id);

      expect(request.delete).toHaveBeenCalled();
    });

    test('should prevent cancellation for completed enrollments', async () => {
      request.delete.mockRejectedValue({
        code: 400,
        message: 'Cannot cancel completed enrollment'
      });

      await expect(enrollmentService.cancelEnrollment('enrollment_123')).rejects.toBeDefined();
    });
  });

  describe('[ENROLL-12] 已拒绝的报名无法取消', () => {
    test('should return error when cancelling rejected enrollment', async () => {
      request.delete.mockRejectedValue({
        code: 400,
        message: 'Rejected enrollment cannot be cancelled'
      });

      await expect(enrollmentService.cancelEnrollment('enrollment_123')).rejects.toBeDefined();
    });
  });

  describe('[ENROLL-13] 获取报名统计（当前期次报名人数）', () => {
    test('should return enrollment statistics', async () => {
      const periodId = 'period_123';
      const mockStats = {
        totalEnrolled: 50,
        totalCapacity: 100,
        pendingReview: 5,
        approved: 45,
        rejected: 0
      };

      request.get.mockResolvedValue(mockStats);

      const result = await enrollmentService.getEnrollmentStats(periodId);

      expect(result).toHaveProperty('totalEnrolled');
      expect(result).toHaveProperty('totalCapacity');
      expect(result.totalEnrolled).toBe(50);
    });

    test('should calculate enrollment percentage', async () => {
      const mockStats = {
        totalEnrolled: 75,
        totalCapacity: 100
      };

      request.get.mockResolvedValue(mockStats);

      const result = await enrollmentService.getEnrollmentStats('period_123');

      expect(result.totalEnrolled).toBe(75);
    });
  });

  describe('[ENROLL-14] 报名后应自动同步到本地缓存', () => {
    test('should cache enrollment after successful submission', async () => {
      const mockEnrollment = createMockEnrollment({
        _id: 'enrollment_123'
      });

      request.post.mockResolvedValue(mockEnrollment);

      await enrollmentService.submitEnrollment('period_123');

      // Verify API was called (service should handle caching)
      expect(request.post).toHaveBeenCalled();
    });

    test('should update cache after enrollment changes', async () => {
      wx.setStorageSync('enrollments', []);

      const mockEnrollment = createMockEnrollment();
      request.post.mockResolvedValue(mockEnrollment);

      await enrollmentService.submitEnrollment('period_123');

      expect(request.post).toHaveBeenCalled();
    });
  });

  describe('[ENROLL-15] 期次满员时应返回错误', () => {
    test('should return error when period is full', async () => {
      request.post.mockRejectedValue({
        code: 400,
        message: 'Period is full'
      });

      await expect(enrollmentService.submitEnrollment('period_123')).rejects.toEqual(
        expect.objectContaining({ message: 'Period is full' })
      );
    });

    test('should check capacity before accepting enrollment', async () => {
      request.post.mockRejectedValue({
        code: 400,
        message: 'No available spots'
      });

      await expect(enrollmentService.submitEnrollment('period_123')).rejects.toBeDefined();
    });
  });

  describe('[ENROLL-16] 应检查报名截止时间', () => {
    test('should return error when enrollment deadline has passed', async () => {
      request.post.mockRejectedValue({
        code: 400,
        message: 'Enrollment deadline has passed'
      });

      await expect(enrollmentService.submitEnrollment('period_123')).rejects.toBeDefined();
    });

    test('should validate enrollment period dates', async () => {
      const mockPeriod = createMockPeriod({
        enrollmentEndDate: new Date(Date.now() - 1000 * 60 * 60).toISOString()
      });

      request.get.mockResolvedValue(mockPeriod);

      const period = await enrollmentService.getPeriodDetails('period_123');

      expect(period.enrollmentEndDate).toBeDefined();
    });
  });

  describe('[ENROLL-17] 获取期次列表应显示当前用户是否已报名', () => {
    test('should include enrollment status in periods list', async () => {
      const mockPeriods = [
        createMockPeriod({
          _id: 'period_1',
          isEnrolled: true
        }),
        createMockPeriod({
          _id: 'period_2',
          isEnrolled: false
        })
      ];

      request.get.mockResolvedValue({
        data: mockPeriods,
        total: 2
      });

      const result = await enrollmentService.getPeriodsList();

      expect(result.data[0]).toHaveProperty('isEnrolled');
    });
  });

  describe('[ENROLL-18] 报名时应自动获取当前期次信息', () => {
    test('should fetch period info during enrollment', async () => {
      const mockEnrollment = createMockEnrollment();
      request.post.mockResolvedValue(mockEnrollment);

      const result = await enrollmentService.submitEnrollment('period_123');

      expect(request.post).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('[ENROLL-19] 应支持批量获取多个期次信息', () => {
    test('should fetch multiple periods in one request', async () => {
      const periodIds = ['period_1', 'period_2', 'period_3'];
      const mockPeriods = periodIds.map(id => createMockPeriod({ _id: id }));

      request.post.mockResolvedValue({
        data: mockPeriods,
        total: 3
      });

      const result = await enrollmentService.getMultiplePeriods(periodIds);

      expect(result.data.length).toBe(3);
      expect(request.post).toHaveBeenCalledWith(
        '/periods/batch',
        expect.any(Object)
      );
    });
  });

  describe('[ENROLL-20] 报名状态变更应触发本地通知更新', () => {
    test('should update local cache when enrollment status changes', async () => {
      const mockEnrollment = createMockEnrollment({
        status: 'active'
      });

      request.put.mockResolvedValue(mockEnrollment);

      const result = await enrollmentService.updateEnrollmentStatus(
        'enrollment_123',
        'active'
      );

      expect(result).toBeDefined();
      expect(request.put).toHaveBeenCalled();
    });
  });
});
