jest.mock('../../services/course.service', () => ({
  getPeriodCheckins: jest.fn()
}));

jest.mock('../../utils/formatters', () => ({
  getAvatarColorByUserId: jest.fn(() => '#4a90e2')
}));

jest.mock('../../utils/period-access', () => ({
  getPeriodAccess: jest.fn()
}));

jest.mock('../../utils/subscribe-auto-topup', () => ({
  maybeAutoTopUpSubscriptions: jest.fn(() => Promise.resolve())
}));

describe('courses page', () => {
  let pageConfig;
  let pageInstance;
  let courseService;

  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;

    global.Page = jest.fn((config) => {
      pageConfig = config;
      return config;
    });
    global.getApp = jest.fn(() => ({
      globalData: {
        isLogin: true
      }
    }));

    courseService = require('../../services/course.service');
    require('../../pages/courses/courses');

    pageInstance = {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };

    courseService.getPeriodCheckins.mockReset();
  });

  afterEach(() => {
    delete global.Page;
    delete global.getApp;
  });

  test('should fold long checkin content and expand on demand', async () => {
    courseService.getPeriodCheckins.mockResolvedValue({
      list: [
        {
          _id: 'checkin_1',
          userId: {
            _id: 'user_1',
            nickname: '狮子'
          },
          sectionId: {
            _id: 'section_1',
            title: '觉察日记',
            day: 1
          },
          note: '这是很长的打卡内容'.repeat(20),
          createdAt: '2025-07-06T03:57:21.000Z'
        }
      ]
    });

    pageInstance.setData({ periodId: 'period_1' });

    await pageInstance.loadAllCheckins.call(pageInstance);

    expect(pageInstance.data.allCheckins[0].canExpandContent).toBe(true);
    expect(pageInstance.data.allCheckins[0].contentExpanded).toBe(false);

    pageInstance.toggleCheckinContent.call(pageInstance, {
      currentTarget: {
        dataset: {
          checkinId: 'checkin_1'
        }
      }
    });

    expect(pageInstance.data.allCheckins[0].contentExpanded).toBe(true);
  });

  test('should preserve checkin pagination state for load more', async () => {
    courseService.getPeriodCheckins
      .mockResolvedValueOnce({
        data: [
          {
            _id: 'checkin_1',
            userId: { _id: 'user_1', nickname: '狮子' },
            sectionId: { _id: 'section_1', title: '觉察日记', day: 1 },
            note: '第一页打卡',
            createdAt: '2025-07-06T03:57:21.000Z'
          }
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 11,
          totalPages: 2,
          hasNext: true
        }
      })
      .mockResolvedValueOnce({
        data: [
          {
            _id: 'checkin_2',
            userId: { _id: 'user_2', nickname: '老虎' },
            sectionId: { _id: 'section_1', title: '觉察日记', day: 1 },
            note: '第二页打卡',
            createdAt: '2025-07-07T03:57:21.000Z'
          }
        ],
        pagination: {
          page: 2,
          limit: 10,
          total: 11,
          totalPages: 2,
          hasNext: false
        }
      });

    pageInstance.setData({ periodId: 'period_1' });

    await pageInstance.loadAllCheckins.call(pageInstance);
    expect(pageInstance.data.checkinHasMore).toBe(true);
    expect(pageInstance.data.checkinTotal).toBe(11);

    await pageInstance.loadAllCheckins.call(pageInstance, true);
    expect(courseService.getPeriodCheckins).toHaveBeenLastCalledWith(
      'period_1',
      {
        page: 2,
        limit: 10
      }
    );
    expect(pageInstance.data.allCheckins).toHaveLength(2);
    expect(pageInstance.data.checkinHasMore).toBe(false);
  });
});
