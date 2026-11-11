jest.mock('../../services/keepsake.service', () => ({ getPeriodKeepsake: jest.fn() }));
jest.mock('../../services/completion-report.service', () => ({ getReportDetail: jest.fn(() => Promise.resolve(null)) }));
jest.mock('../../utils/require-login', () => ({ requireLogin: jest.fn(() => true) }));
jest.mock('../../utils/brand', () => ({ getBrandName: () => '晨读营' }));

describe('keepsake page', () => {
  let page;
  let service;

  beforeEach(() => {
    jest.resetModules();
    let config;
    global.Page = jest.fn(c => { config = c; });
    global.wx = { navigateBack: jest.fn(), redirectTo: jest.fn(), switchTab: jest.fn() };
    global.getCurrentPages = jest.fn(() => [{}, {}]);
    service = require('../../services/keepsake.service');
    service.getPeriodKeepsake.mockReset();
    require('../../pages/keepsake/keepsake');
    page = {
      ...config,
      data: JSON.parse(JSON.stringify(config.data)),
      setData(u) { this.data = { ...this.data, ...u }; }
    };
  });

  const full = {
    ready: true,
    period: { name: '第十期晨读营', totalDays: 21 },
    nickname: '小明',
    checkinDays: 20,
    totalWords: 3000,
    readingMinutes: 100,
    earliestCheckin: { time: '05:30', date: '2026-11-12' },
    moods: [{ date: '2026-11-12', mood: 'happy' }],
    topCheckin: { id: 'c1', excerpt: 'x', likeCount: 1 },
    companions: [],
    insightExcerpt: null,
    highlights: [],
    letter: null
  };

  it('未结营时展示剩余天数', async () => {
    service.getPeriodKeepsake.mockResolvedValue({ ready: false, daysLeft: 5, period: { name: 'P' } });
    page.onLoad({ periodId: 'p1' });
    await Promise.resolve(); await Promise.resolve();
    expect(page.data.ready).toBe(false);
    expect(page.data.daysLeft).toBe(5);
  });

  it('没有数据的页自动跳过，首字作印章', async () => {
    service.getPeriodKeepsake.mockResolvedValue(full);
    page.onLoad({ periodId: 'p1' });
    await Promise.resolve(); await Promise.resolve();
    const keys = page.data.keepsake.pages.map(p => p.key);
    expect(keys).toEqual(['cover', 'numbers', 'earliest', 'moods', 'top', 'end']);
    expect(page.data.keepsake.sealChar).toBe('第');
    expect(page.data.keepsake.moods[0].name).toBe('晴');
  });

  it('接口失败显示重试提示', async () => {
    service.getPeriodKeepsake.mockRejectedValue(new Error('x'));
    page.onLoad({ periodId: 'p1' });
    await Promise.resolve(); await Promise.resolve();
    expect(page.data.error).toBeTruthy();
  });

  it('分享标题带品牌名与天数', async () => {
    service.getPeriodKeepsake.mockResolvedValue(full);
    page.onLoad({ periodId: 'p1' });
    await Promise.resolve(); await Promise.resolve();
    expect(page.onShareAppMessage().title).toBe('我在晨读营的 21 天');
  });

  it('没有 totalDays 时用起止日期算，再没有则省略天数', async () => {
    service.getPeriodKeepsake.mockResolvedValue({ ...full, period: { name: 'P', startDate: '2026-10-01', endDate: '2026-10-23' } });
    page.onLoad({ periodId: 'p1' });
    await Promise.resolve(); await Promise.resolve();
    expect(page.data.totalDays).toBe(23);
    page.setData({ totalDays: 0 });
    expect(page.onShareAppMessage().title).toBe('我在晨读营的晨读纪念册');
  });

  it('能返回就 navigateBack，否则 redirectTo 课程列表', () => {
    page.data.periodId = 'p1';
    page.onBackToCourse();
    expect(wx.navigateBack).toHaveBeenCalled();
    global.getCurrentPages = jest.fn(() => [{}]);
    page.onBackToCourse();
    expect(wx.redirectTo.mock.calls[0][0].url).toBe('/pages/courses/courses?periodId=p1');
  });

  test('adds a report page before the end only when a report exists, and a seen page when seenCount is above zero', async () => {
    const reportService = require('../../services/completion-report.service');
    service.getPeriodKeepsake.mockResolvedValue({ ...full, seenCount: 3 });
    reportService.getReportDetail.mockResolvedValueOnce({ hasReport: true, title: '分享实录' });
    page.data.periodId = 'p1';
    await page.loadKeepsake();
    await Promise.resolve();
    await Promise.resolve();
    expect(reportService.getReportDetail).toHaveBeenCalledWith('p1', { suppressError: true });
    const keys = page.data.keepsake.pages.map(item => item.key);
    expect(keys.slice(-3)).toEqual(['seen', 'report', 'end']);

    reportService.getReportDetail.mockRejectedValueOnce(new Error('x'));
    service.getPeriodKeepsake.mockResolvedValue(full);
    await page.loadKeepsake();
    await Promise.resolve();
    await Promise.resolve();
    expect(page.data.keepsake.pages.map(item => item.key)).not.toContain('report');

    global.wx.navigateTo = jest.fn();
    page.onOpenReport();
    expect(global.wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/completion-report-detail/completion-report-detail?periodId=p1'
    });
  });

  test('lays the booklet out in chapters, each chapter named on its first page only', async () => {
    service.getPeriodKeepsake.mockResolvedValue({
      ...full,
      finished: false,
      daysLeft: 4,
      days: [{ checkinId: 'c1', sectionId: 's1', date: '2026-11-12', sectionTitle: '第一课', excerpt: 'x' }],
      seenCount: 2,
      buddy: { nickname: '阿泰', avatarUrl: '', days: 9, active: true },
      letter: { content: '给自己', reply: '' },
      practices: [{ weekIndex: 1, text: '先听完再说', loggedDays: 3, doneDays: 2 }],
      insights: [{ id: 'i1', title: '第一封', date: '2026-11-13', excerpt: 'y' }]
    });
    page.data.periodId = 'p1';
    await page.loadKeepsake();
    const pages = page.data.keepsake.pages;
    expect(pages.map(item => item.key)).toEqual([
      'cover', 'numbers', 'earliest', 'moods', 'top', 'days', 'seen', 'buddy', 'letter', 'practices', 'insights', 'end'
    ]);
    expect(pages.filter(item => item.chapter).map(item => `${item.key}:${item.chapter}`)).toEqual([
      'numbers:我写下的', 'days:每一天', 'seen:同行的人', 'letter:写给自己的', 'insights:小凡的话'
    ]);
    expect(page.data.keepsake.finished).toBe(false);
    expect(page.data.keepsake.days[0].dateText).toBe('11.12');
    expect(page.data.keepsake.insights[0].dateText).toBe('11.13');

    global.wx.navigateTo = jest.fn();
    page.onOpenDay({ currentTarget: { dataset: { sectionId: 's1', checkinId: 'c1' } } });
    expect(global.wx.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/course-detail/course-detail?id=s1&checkinId=c1' });
    page.onOpenInsight({ currentTarget: { dataset: { id: 'i1' } } });
    expect(global.wx.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/insight-detail/insight-detail?id=i1' });
  });

  test('older api payloads still work: one insight excerpt becomes a single letter and the booklet counts as finished', async () => {
    service.getPeriodKeepsake.mockResolvedValue({ ...full, insightExcerpt: { id: 'i9', title: '旧', excerpt: 'z' } });
    page.data.periodId = 'p1';
    await page.loadKeepsake();
    expect(page.data.keepsake.finished).toBe(true);
    expect(page.data.keepsake.insights).toHaveLength(1);
    expect(page.data.keepsake.pages.map(item => item.key)).toContain('insights');
  });

  test('shows a not-started message before the period begins', async () => {
    service.getPeriodKeepsake.mockResolvedValue({ ready: false, notStarted: true, daysLeft: 9, period: { name: 'P' } });
    page.data.periodId = 'p1';
    await page.loadKeepsake();
    expect(page.data.ready).toBe(false);
    expect(page.data.notStarted).toBe(true);
  });
});
