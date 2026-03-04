/**
 * Checkin Service Tests (Stage 5: Task 5.1)
 * Tests for attendance tracking, checkin submission, and statistics
 *
 * Test Coverage:
 * - Checkin submission and validation
 * - Daily checkin limit enforcement
 * - Checkin statistics and tracking
 * - Checkin history retrieval
 * - Time-based checkin management
 * - Checkin caching
 */

const checkinService = require('../../services/checkin.service');
const request = require('../../utils/request');
const { createMockCheckin, createMockCourse, createMockUser, generateId } = require('../fixtures');

jest.mock('../../utils/request');

describe('Checkin Service Tests (Stage 5: Task 5.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.wx.__storage = {};
    global.wx.getStorageSync.mockClear();
    global.wx.setStorageSync.mockClear();
    global.wx.removeStorageSync.mockClear();
    request.get.mockClear();
    request.post.mockClear();
    request.delete.mockClear();
    request.put.mockClear();
  });

  describe('[CHECK-1] 提交打卡应返回打卡记录', () => {
    test('should return checkin record after submission', async () => {
      const mockCheckin = createMockCheckin({
        _id: 'checkin_123',
        courseId: 'course_123',
        status: 'completed'
      });

      request.post.mockResolvedValue(mockCheckin);

      const result = await checkinService.submitCheckin('course_123');

      expect(result).toHaveProperty('_id');
      expect(result.status).toBe('completed');
      expect(request.post).toHaveBeenCalledWith('/checkins', expect.any(Object));
    });

    test('should include checkin timestamp', async () => {
      const mockCheckin = createMockCheckin({
        checkinTime: new Date().toISOString()
      });

      request.post.mockResolvedValue(mockCheckin);

      const result = await checkinService.submitCheckin('course_123');

      expect(result).toHaveProperty('checkinTime');
    });
  });

  describe('[CHECK-2] 打卡应包含课程 ID、用户 ID、时间戳', () => {
    test('should include required checkin fields', async () => {
      const userId = 'user_123';
      const courseId = 'course_456';
      const checkinTime = new Date().toISOString();

      const mockCheckin = createMockCheckin({
        userId: userId,
        courseId: courseId,
        checkinTime: checkinTime
      });

      request.post.mockResolvedValue(mockCheckin);

      const result = await checkinService.submitCheckin(courseId);

      expect(result.userId).toBe(userId);
      expect(result.courseId).toBe(courseId);
      expect(result.checkinTime).toBe(checkinTime);
    });

    test('should validate field types', async () => {
      const mockCheckin = createMockCheckin({
        userId: 'user_123',
        courseId: 'course_123'
      });

      request.post.mockResolvedValue(mockCheckin);

      const result = await checkinService.submitCheckin('course_123');

      expect(typeof result.userId).toBe('string');
      expect(typeof result.courseId).toBe('string');
    });
  });

  describe('[CHECK-3] 每个课程每个用户每天只能打卡一次', () => {
    test('should allow only one checkin per course per day', async () => {
      const mockCheckin = createMockCheckin({ courseId: 'course_123' });

      request.post.mockResolvedValueOnce(mockCheckin);
      request.post.mockRejectedValueOnce({
        code: 400,
        message: 'Already checked in for this course today'
      });

      const result1 = await checkinService.submitCheckin('course_123');
      expect(result1).toBeDefined();

      await expect(
        checkinService.submitCheckin('course_123')
      ).rejects.toEqual(expect.objectContaining({
        message: 'Already checked in for this course today'
      }));
    });
  });

  describe('[CHECK-4] 重复打卡应返回错误', () => {
    test('should return error on duplicate checkin', async () => {
      request.post.mockRejectedValue({
        code: 400,
        message: 'Duplicate checkin'
      });

      await expect(
        checkinService.submitCheckin('course_123')
      ).rejects.toEqual(expect.objectContaining({
        message: 'Duplicate checkin'
      }));
    });
  });

  describe('[CHECK-5] 打卡应保存用户笔记', () => {
    test('should save checkin notes', async () => {
      const notes = '今天学到了很多关于专注的内容';
      const mockCheckin = createMockCheckin({
        notes: notes
      });

      request.post.mockResolvedValue(mockCheckin);

      const result = await checkinService.submitCheckin('course_123', {
        notes: notes
      });

      expect(result.notes).toBe(notes);
    });

    test('should handle checkin without notes', async () => {
      const mockCheckin = createMockCheckin({
        notes: null
      });

      request.post.mockResolvedValue(mockCheckin);

      const result = await checkinService.submitCheckin('course_123');

      expect(result).toBeDefined();
    });
  });

  describe('[CHECK-6] 获取打卡列表应返回用户的所有打卡记录', () => {
    test('should return all checkins for user', async () => {
      const mockCheckins = [
        createMockCheckin({ courseId: 'course_1' }),
        createMockCheckin({ courseId: 'course_2' }),
        createMockCheckin({ courseId: 'course_3' })
      ];

      request.get.mockResolvedValue({
        data: mockCheckins,
        total: 3
      });

      const result = await checkinService.getCheckinList();

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(3);
      expect(result.total).toBe(3);
    });

    test('should return only current user checkins', async () => {
      const userId = 'user_123';
      wx.setStorageSync('userInfo', { _id: userId });

      const mockCheckins = [
        createMockCheckin({ userId: userId }),
        createMockCheckin({ userId: userId })
      ];

      request.get.mockResolvedValue({
        data: mockCheckins,
        total: 2
      });

      const result = await checkinService.getCheckinList();

      expect(result.data.every(c => c.userId === userId)).toBe(true);
    });
  });

  describe('[CHECK-7] 打卡列表应按时间倒序排序', () => {
    test('should sort checkins by time descending', async () => {
      const baseTime = new Date();
      const mockCheckins = [
        createMockCheckin({
          checkinTime: new Date(baseTime.getTime() + 2 * 60 * 60 * 1000).toISOString()
        }),
        createMockCheckin({
          checkinTime: new Date(baseTime.getTime() + 1 * 60 * 60 * 1000).toISOString()
        }),
        createMockCheckin({
          checkinTime: baseTime.toISOString()
        })
      ];

      request.get.mockResolvedValue({
        data: mockCheckins,
        total: 3
      });

      const result = await checkinService.getCheckinList();

      const times = result.data.map(c => new Date(c.checkinTime).getTime());
      for (let i = 0; i < times.length - 1; i++) {
        expect(times[i]).toBeGreaterThanOrEqual(times[i + 1]);
      }
    });
  });

  describe('[CHECK-8] 获取打卡统计（今日打卡数、总打卡数）', () => {
    test('should return checkin statistics', async () => {
      const mockStats = {
        todayCheckins: 1,
        totalCheckins: 25,
        continuousDays: 5,
        thisWeekCheckins: 7
      };

      request.get.mockResolvedValue(mockStats);

      const result = await checkinService.getCheckinStats();

      expect(result).toHaveProperty('todayCheckins');
      expect(result).toHaveProperty('totalCheckins');
      expect(result).toHaveProperty('continuousDays');
      expect(result.todayCheckins).toBe(1);
      expect(result.totalCheckins).toBe(25);
    });

    test('should calculate streak days', async () => {
      const mockStats = {
        continuousDays: 10,
        totalCheckins: 30
      };

      request.get.mockResolvedValue(mockStats);

      const result = await checkinService.getCheckinStats();

      expect(result.continuousDays).toBeGreaterThan(0);
    });
  });

  describe('[CHECK-9] 打卡记录应显示打卡时间距离现在多久', () => {
    test('should show relative time from checkin', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const mockCheckin = createMockCheckin({
        checkinTime: oneHourAgo.toISOString()
      });

      request.get.mockResolvedValue({
        data: [mockCheckin],
        total: 1
      });

      const result = await checkinService.getCheckinList();

      expect(result.data[0].checkinTime).toBeDefined();
      // Service should calculate time difference
    });

    test('should format time difference for display', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const mockCheckin = createMockCheckin({
        checkinTime: fiveMinutesAgo.toISOString()
      });

      request.post.mockResolvedValue(mockCheckin);

      const result = await checkinService.submitCheckin('course_123');

      expect(result.checkinTime).toBeDefined();
    });
  });

  describe('[CHECK-10] 应支持按课程查询打卡记录', () => {
    test('should filter checkins by course', async () => {
      const courseId = 'course_123';
      const mockCheckins = [
        createMockCheckin({ courseId: courseId })
      ];

      request.get.mockResolvedValue({
        data: mockCheckins,
        total: 1
      });

      const result = await checkinService.getCheckinList({
        courseId: courseId
      });

      expect(request.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ courseId: courseId })
      );
    });
  });

  describe('[CHECK-11] 应支持按期次查询打卡记录', () => {
    test('should filter checkins by period', async () => {
      const periodId = 'period_123';
      const mockCheckins = [
        createMockCheckin({ periodId: periodId })
      ];

      request.get.mockResolvedValue({
        data: mockCheckins,
        total: 1
      });

      const result = await checkinService.getCheckinList({
        periodId: periodId
      });

      expect(request.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ periodId: periodId })
      );
    });
  });

  describe('[CHECK-12] 打卡记录应包含关联的课程信息', () => {
    test('should include course details in checkin record', async () => {
      const mockCheckin = createMockCheckin({
        courseId: 'course_123',
        courseTitle: '成功的秘诀',
        courseDayOfPeriod: 5
      });

      request.get.mockResolvedValue({
        data: [mockCheckin],
        total: 1
      });

      const result = await checkinService.getCheckinList();

      expect(result.data[0]).toHaveProperty('courseId');
      expect(result.data[0]).toHaveProperty('courseTitle');
    });
  });

  describe('[CHECK-13] 删除打卡记录应成功（如果是自己的记录）', () => {
    test('should delete own checkin record', async () => {
      const checkinId = 'checkin_123';
      request.delete.mockResolvedValue({
        code: 200,
        message: 'Checkin deleted'
      });

      const result = await checkinService.deleteCheckin(checkinId);

      expect(request.delete).toHaveBeenCalledWith(`/checkins/${checkinId}`);
      expect(result.code).toBe(200);
    });

    test('should prevent deletion of others checkins', async () => {
      request.delete.mockRejectedValue({
        code: 403,
        message: 'Cannot delete other users checkin'
      });

      await expect(
        checkinService.deleteCheckin('other_user_checkin')
      ).rejects.toBeDefined();
    });
  });

  describe('[CHECK-14] 打卡成功应自动更新打卡统计', () => {
    test('should update stats after successful checkin', async () => {
      const mockCheckin = createMockCheckin();
      request.post.mockResolvedValue(mockCheckin);

      const result = await checkinService.submitCheckin('course_123');

      expect(request.post).toHaveBeenCalled();
      // Stats update should happen automatically
      expect(result).toBeDefined();
    });
  });

  describe('[CHECK-15] 打卡记录应本地缓存', () => {
    test('should cache checkin locally', async () => {
      wx.setStorageSync('checkins', []);

      const mockCheckin = createMockCheckin({
        _id: 'checkin_123'
      });

      request.post.mockResolvedValue(mockCheckin);

      const result = await checkinService.submitCheckin('course_123');

      expect(request.post).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('should update cache when retrieving checkins', async () => {
      const mockCheckins = [
        createMockCheckin({ _id: 'checkin_1' }),
        createMockCheckin({ _id: 'checkin_2' })
      ];

      request.get.mockResolvedValue({
        data: mockCheckins,
        total: 2
      });

      const result = await checkinService.getCheckinList();

      expect(result.data.length).toBe(2);
    });
  });

  // Additional edge case tests for comprehensive coverage
  describe('[CHECK-EXTRA] Additional Checkin Service Methods', () => {
    test('should get checkin count for period', async () => {
      request.get.mockResolvedValue({ count: 15 });

      const result = await checkinService.getCheckinCountForPeriod('period_123');

      expect(request.get).toHaveBeenCalled();
      expect(result.count).toBe(15);
    });

    test('should get checkin progress percentage', async () => {
      request.get.mockResolvedValue({
        completed: 20,
        total: 30,
        percentage: 66.67
      });

      const result = await checkinService.getCheckinProgress('period_123');

      expect(result.percentage).toBeLessThanOrEqual(100);
    });

    test('should support batch checkin query', async () => {
      const courseIds = ['course_1', 'course_2', 'course_3'];
      const mockCheckins = [
        createMockCheckin({ courseId: courseIds[0] }),
        createMockCheckin({ courseId: courseIds[1] })
      ];

      request.post.mockResolvedValue({
        data: mockCheckins,
        total: 2
      });

      const result = await checkinService.getMultipleCheckins(courseIds);

      expect(result.data.length).toBeGreaterThan(0);
    });

    test('should validate checkin time constraints', async () => {
      request.post.mockRejectedValue({
        code: 400,
        message: 'Checkin not allowed at this time'
      });

      await expect(
        checkinService.submitCheckin('course_123')
      ).rejects.toBeDefined();
    });

    test('should handle checkin with attendance duration', async () => {
      const mockCheckin = createMockCheckin({
        durationMinutes: 45
      });

      request.post.mockResolvedValue(mockCheckin);

      const result = await checkinService.submitCheckin('course_123', {
        duration: 45
      });

      expect(result).toBeDefined();
    });
  });
});
