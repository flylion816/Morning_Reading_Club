jest.mock('../../utils/social-access', () => ({
  guardSocialPage: jest.fn(() => true)
}));

jest.mock('../../services/seen-card.service', () => ({
  getReceived: jest.fn()
}));

let pageConfig;
let pageInstance;
let seenCardService;

function createPageInstance() {
  return {
    ...pageConfig,
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    setData(update, callback) {
      this.data = { ...this.data, ...update };
      if (typeof callback === 'function') callback();
    }
  };
}

const card = (id, extra = {}) => ({
  id,
  checkinId: `ck${id}`,
  sectionId: `sec${id}`,
  userId: `u${id}`,
  nickname: '小红',
  avatarUrl: '',
  phrase: 'persist',
  courseTitle: '第一天',
  periodName: '第一期',
  createdAt: new Date().toISOString(),
  ...extra
});

describe('seen-received page', () => {
  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;
    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });
    wx.navigateTo.mockClear();
    seenCardService = require('../../services/seen-card.service');
    seenCardService.getReceived.mockReset();
    require('../../pages/seen-received/seen-received');
    pageInstance = createPageInstance();
  });

  afterEach(() => {
    delete global.Page;
  });

  test('loads the first page and decorates phrase text', async () => {
    seenCardService.getReceived.mockResolvedValue({ list: [card('1')], total: 1 });
    await pageInstance.loadFirstPage();
    expect(seenCardService.getReceived).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(pageInstance.data.list[0].phraseText).toBe('我看见你的坚持');
    expect(pageInstance.data.total).toBe(1);
    expect(pageInstance.data.hasMore).toBe(false);
    expect(pageInstance.data.loading).toBe(false);
  });

  test('shows error state on failure and retries', async () => {
    seenCardService.getReceived.mockRejectedValue(new Error('x'));
    await pageInstance.loadFirstPage();
    expect(pageInstance.data.loadError).toBe(true);
    seenCardService.getReceived.mockResolvedValue({ list: [], total: 0 });
    await pageInstance.handleRetry();
    expect(pageInstance.data.loadError).toBe(false);
    expect(pageInstance.data.list).toEqual([]);
  });

  test('loadMore appends the next page', async () => {
    seenCardService.getReceived.mockResolvedValueOnce({ list: [card('1')], total: 2 });
    await pageInstance.loadFirstPage();
    expect(pageInstance.data.hasMore).toBe(true);
    seenCardService.getReceived.mockResolvedValueOnce({ list: [card('2')], total: 2 });
    await pageInstance.loadMore();
    expect(seenCardService.getReceived).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
    expect(pageInstance.data.list).toHaveLength(2);
    expect(pageInstance.data.hasMore).toBe(false);
  });

  test('tapping a card opens the checkin in course detail', () => {
    pageInstance.handleCardTap({ currentTarget: { dataset: { sectionId: 's1', checkinId: 'c1' } } });
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/course-detail/course-detail?id=s1&checkinId=c1&focus=comments'
    });
  });

  test('does not load when social guard rejects', () => {
    const { guardSocialPage } = require('../../utils/social-access');
    guardSocialPage.mockReturnValueOnce(false);
    pageInstance.onShow();
    expect(seenCardService.getReceived).not.toHaveBeenCalled();
  });
});
