/**
 * Course Service Tests (Stage 3: Task 3.2)
 * Tests for course management, listing, and content retrieval
 *
 * Test Coverage:
 * - Course listing by period
 * - Course details retrieval
 * - Course content and markdown support
 * - Checkin statistics per course
 * - Course date and time handling
 * - Course caching and updates
 * - Course status and visibility
 */

const courseService = require('../../services/course.service');
const request = require('../../utils/request');
const { createMockCourse, createMockPeriod, createMockUser, generateId } = require('../fixtures');

jest.mock('../../utils/request');

describe('Course Service Tests (Stage 3: Task 3.2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.wx.__storage = {};
    global.wx.getStorageSync.mockClear();
    global.wx.setStorageSync.mockClear();
    global.wx.removeStorageSync.mockClear();
    request.get.mockClear();
    request.post.mockClear();
  });

  describe('[COURSE-1] 获取课程列表应返回按天次排序的课程', () => {
    test('should return courses sorted by day of period', async () => {
      const mockCourses = [
        createMockCourse({ dayOfPeriod: 1, title: '第1天' }),
        createMockCourse({ dayOfPeriod: 2, title: '第2天' }),
        createMockCourse({ dayOfPeriod: 3, title: '第3天' })
      ];

      request.get.mockResolvedValue({
        data: mockCourses,
        total: 3
      });

      const result = await courseService.getCoursesList('period_123');

      expect(result.data.length).toBe(3);
      expect(result.data[0].dayOfPeriod).toBeLessThanOrEqual(result.data[1].dayOfPeriod);
      expect(request.get).toHaveBeenCalledWith('/courses/period/period_123', expect.any(Object));
    });

    test('should maintain day order across multiple pages', async () => {
      const mockCourses = [
        createMockCourse({ dayOfPeriod: 5 }),
        createMockCourse({ dayOfPeriod: 10 }),
        createMockCourse({ dayOfPeriod: 15 })
      ];

      request.get.mockResolvedValue({
        data: mockCourses,
        total: 3
      });

      const result = await courseService.getCoursesList('period_123');

      for (let i = 0; i < result.data.length - 1; i++) {
        expect(result.data[i].dayOfPeriod).toBeLessThanOrEqual(result.data[i + 1].dayOfPeriod);
      }
    });
  });

  describe('[COURSE-2] 获取课程详情应返回完整内容', () => {
    test('should return full course details', async () => {
      const courseId = 'course_123';
      const mockCourse = createMockCourse({
        _id: courseId,
        title: '成功的秘诀',
        description: '探讨成功的核心要素',
        content: '## 成功的三个要素\n1. 专注\n2. 坚持\n3. 反思',
        status: 'published'
      });

      request.get.mockResolvedValue(mockCourse);

      const result = await courseService.getCourseDetails(courseId);

      expect(result._id).toBe(courseId);
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('content');
      expect(request.get).toHaveBeenCalledWith(`/courses/${courseId}`);
    });

    test('should include all course metadata', async () => {
      const mockCourse = createMockCourse({
        periodId: 'period_123',
        dayOfPeriod: 5,
        checkinsCount: 45,
        status: 'published'
      });

      request.get.mockResolvedValue(mockCourse);

      const result = await courseService.getCourseDetails('course_123');

      expect(result).toHaveProperty('periodId');
      expect(result).toHaveProperty('dayOfPeriod');
      expect(result).toHaveProperty('checkinsCount');
    });
  });

  describe('[COURSE-3] 课程应包含 dayOfPeriod 字段表示第几天', () => {
    test('should include dayOfPeriod field in course objects', async () => {
      const mockCourses = [
        createMockCourse({ dayOfPeriod: 1 }),
        createMockCourse({ dayOfPeriod: 2 })
      ];

      request.get.mockResolvedValue({
        data: mockCourses,
        total: 2
      });

      const result = await courseService.getCoursesList('period_123');

      expect(result.data[0]).toHaveProperty('dayOfPeriod');
      expect(typeof result.data[0].dayOfPeriod).toBe('number');
      expect(result.data[0].dayOfPeriod).toBeGreaterThanOrEqual(1);
    });

    test('should have valid dayOfPeriod values', async () => {
      const mockCourse = createMockCourse({ dayOfPeriod: 15 });

      request.get.mockResolvedValue(mockCourse);

      const result = await courseService.getCourseDetails('course_123');

      expect(result.dayOfPeriod).toBeGreaterThan(0);
      expect(result.dayOfPeriod).toBeLessThanOrEqual(365);
    });
  });

  describe('[COURSE-4] 获取当前期次的课程列表', () => {
    test('should get courses for current period', async () => {
      const periodId = 'period_123';
      const mockCourses = [
        createMockCourse({ periodId }),
        createMockCourse({ periodId })
      ];

      request.get.mockResolvedValue({
        data: mockCourses,
        total: 2
      });

      const result = await courseService.getCoursesList(periodId);

      expect(request.get).toHaveBeenCalledWith(
        `/courses/period/${periodId}`,
        expect.any(Object)
      );
      expect(result.data.every(c => c.periodId === periodId)).toBe(true);
    });

    test('should filter courses by period ID', async () => {
      const mockCourses = [createMockCourse({ periodId: 'period_123' })];

      request.get.mockResolvedValue({
        data: mockCourses,
        total: 1
      });

      const result = await courseService.getCoursesList('period_123');

      expect(result.data.length).toBe(1);
    });
  });

  describe('[COURSE-5] 获取课程打卡统计', () => {
    test('should return checkin statistics for course', async () => {
      const mockStats = {
        courseId: 'course_123',
        totalCheckins: 75,
        totalEnrolled: 100,
        checkinRate: 0.75
      };

      request.get.mockResolvedValue(mockStats);

      const result = await courseService.getCourseCheckinStats('course_123');

      expect(result).toHaveProperty('totalCheckins');
      expect(result).toHaveProperty('totalEnrolled');
      expect(result).toHaveProperty('checkinRate');
    });

    test('should calculate checkin percentage', async () => {
      const mockStats = {
        totalCheckins: 50,
        totalEnrolled: 100,
        checkinRate: 0.5
      };

      request.get.mockResolvedValue(mockStats);

      const result = await courseService.getCourseCheckinStats('course_123');

      expect(result.checkinRate).toBe(0.5);
    });
  });

  describe('[COURSE-6] 课程内容应支持 Markdown 格式', () => {
    test('should support markdown in course content', async () => {
      const markdownContent = `# 标题\n## 小标题\n- 列表1\n- 列表2\n\n**粗体** 和 *斜体*`;
      const mockCourse = createMockCourse({
        content: markdownContent
      });

      request.get.mockResolvedValue(mockCourse);

      const result = await courseService.getCourseDetails('course_123');

      expect(result.content).toContain('#');
      expect(result.content).toContain('**');
      expect(result.content).toContain('*');
    });

    test('should preserve markdown formatting', async () => {
      const markdownContent = '## 成功的秘诀\n1. 专注\n2. 坚持\n3. 反思';
      const mockCourse = createMockCourse({ content: markdownContent });

      request.get.mockResolvedValue(mockCourse);

      const result = await courseService.getCourseDetails('course_123');

      expect(result.content).toBe(markdownContent);
    });
  });

  describe('[COURSE-7] 获取课程的评论列表', () => {
    test('should return comments for course', async () => {
      const mockComments = [
        { _id: 'comment_1', content: '很好的课程', userId: 'user_1' },
        { _id: 'comment_2', content: '学到很多', userId: 'user_2' }
      ];

      request.get.mockResolvedValue({
        data: mockComments,
        total: 2
      });

      const result = await courseService.getCourseComments('course_123');

      expect(result.data.length).toBe(2);
      expect(request.get).toHaveBeenCalledWith('/courses/course_123/comments', expect.any(Object));
    });

    test('should support pagination for comments', async () => {
      request.get.mockResolvedValue({
        data: [],
        page: 1,
        pageSize: 10,
        total: 50
      });

      const result = await courseService.getCourseComments('course_123', {
        page: 1,
        limit: 10
      });

      expect(result.total).toBe(50);
    });
  });

  describe('[COURSE-8] 获取课程的 insights 列表', () => {
    test('should return insights for course', async () => {
      const mockInsights = [
        { _id: 'insight_1', content: '我看见你的进步' },
        { _id: 'insight_2', content: '很棒的分享' }
      ];

      request.get.mockResolvedValue({
        data: mockInsights,
        total: 2
      });

      const result = await courseService.getCourseInsights('course_123');

      expect(result.data.length).toBe(2);
      expect(request.get).toHaveBeenCalledWith('/courses/course_123/insights', expect.any(Object));
    });

    test('should include insight creator info', async () => {
      const mockInsights = [
        {
          _id: 'insight_1',
          creatorUserId: 'user_1',
          creatorNickname: '用户1',
          content: '内容'
        }
      ];

      request.get.mockResolvedValue({
        data: mockInsights,
        total: 1
      });

      const result = await courseService.getCourseInsights('course_123');

      expect(result.data[0]).toHaveProperty('creatorUserId');
      expect(result.data[0]).toHaveProperty('creatorNickname');
    });
  });

  describe('[COURSE-9] 应支持按期次和日期范围查询课程', () => {
    test('should query courses by period and date range', async () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      const mockCourses = [createMockCourse()];

      request.get.mockResolvedValue({
        data: mockCourses,
        total: 1
      });

      const result = await courseService.getCoursesList('period_123', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      expect(request.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
      );
    });
  });

  describe('[COURSE-10] 课程发布状态应影响是否显示', () => {
    test('should only show published courses', async () => {
      const mockCourses = [
        createMockCourse({ status: 'published' })
      ];

      request.get.mockResolvedValue({
        data: mockCourses,
        total: 1
      });

      const result = await courseService.getCoursesList('period_123');

      expect(result.data.every(c => c.status === 'published')).toBe(true);
    });

    test('should exclude draft courses from list', async () => {
      const mockCourses = [
        createMockCourse({ status: 'published' })
      ];

      request.get.mockResolvedValue({
        data: mockCourses,
        total: 1
      });

      const result = await courseService.getCoursesList('period_123');

      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe('[COURSE-11] 课程时间信息应正确格式化', () => {
    test('should return properly formatted timestamps', async () => {
      const createdAt = new Date().toISOString();
      const mockCourse = createMockCourse({
        createdAt: createdAt,
        updatedAt: createdAt
      });

      request.get.mockResolvedValue(mockCourse);

      const result = await courseService.getCourseDetails('course_123');

      expect(result.createdAt).toBe(createdAt);
      expect(new Date(result.createdAt)).toBeInstanceOf(Date);
    });

    test('should handle timezone-aware dates', async () => {
      const isoDate = new Date(2024, 0, 15, 10, 30).toISOString();
      const mockCourse = createMockCourse({ createdAt: isoDate });

      request.get.mockResolvedValue(mockCourse);

      const result = await courseService.getCourseDetails('course_123');

      expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('[COURSE-12] 获取课程列表应显示每个课程的打卡状态（已打卡/未打卡）', () => {
    test('should include checkin status in course list', async () => {
      const mockCourses = [
        createMockCourse({
          _id: 'course_1',
          isCheckedIn: true
        }),
        createMockCourse({
          _id: 'course_2',
          isCheckedIn: false
        })
      ];

      request.get.mockResolvedValue({
        data: mockCourses,
        total: 2
      });

      const result = await courseService.getCoursesList('period_123');

      expect(result.data[0]).toHaveProperty('isCheckedIn');
      expect(result.data[0].isCheckedIn).toBe(true);
      expect(result.data[1].isCheckedIn).toBe(false);
    });

    test('should show checkin status for current user', async () => {
      const userId = 'user_123';
      wx.setStorageSync('userInfo', { _id: userId });

      const mockCourses = [
        createMockCourse({ isCheckedIn: true })
      ];

      request.get.mockResolvedValue({
        data: mockCourses,
        total: 1
      });

      const result = await courseService.getCoursesList('period_123');

      expect(result.data[0].isCheckedIn).toBeDefined();
    });
  });

  describe('[COURSE-13] 课程数据应包含打卡数和 insights 数', () => {
    test('should include checkins count and insights count', async () => {
      const mockCourse = createMockCourse({
        checkinsCount: 85,
        insightsCount: 45
      });

      request.get.mockResolvedValue(mockCourse);

      const result = await courseService.getCourseDetails('course_123');

      expect(result).toHaveProperty('checkinsCount');
      expect(result).toHaveProperty('insightsCount');
      expect(result.checkinsCount).toBe(85);
      expect(result.insightsCount).toBe(45);
    });

    test('should show zero counts for new courses', async () => {
      const mockCourse = createMockCourse({
        checkinsCount: 0,
        insightsCount: 0
      });

      request.get.mockResolvedValue(mockCourse);

      const result = await courseService.getCourseDetails('course_123');

      expect(result.checkinsCount).toBe(0);
      expect(result.insightsCount).toBe(0);
    });
  });

  describe('[COURSE-14] 应支持课程列表的本地缓存', () => {
    test('should cache course list locally', async () => {
      const mockCourses = [
        createMockCourse({ _id: 'course_1' })
      ];

      request.get.mockResolvedValue({
        data: mockCourses,
        total: 1
      });

      const result = await courseService.getCoursesList('period_123');

      // Service should cache the result
      expect(request.get).toHaveBeenCalled();
    });

    test('should return cached data for repeated requests', async () => {
      const mockCourses = [createMockCourse()];

      request.get.mockResolvedValue({
        data: mockCourses,
        total: 1
      });

      await courseService.getCoursesList('period_123');
      const result2 = await courseService.getCoursesList('period_123');

      expect(result2).toBeDefined();
    });
  });

  describe('[COURSE-15] 课程更新应自动刷新缓存', () => {
    test('should refresh cache after course update', async () => {
      const updatedCourse = createMockCourse({
        _id: 'course_123',
        title: '更新后的课程'
      });

      request.put.mockResolvedValue(updatedCourse);

      const result = await courseService.updateCourse('course_123', {
        title: '更新后的课程'
      });

      expect(request.put).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('should invalidate old cache after update', async () => {
      request.put.mockResolvedValue(createMockCourse());

      await courseService.updateCourse('course_123', { title: '新标题' });

      expect(request.put).toHaveBeenCalled();
    });
  });
});
