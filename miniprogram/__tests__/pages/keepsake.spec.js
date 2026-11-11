jest.mock('../../services/keepsake.service', () => ({ getPeriodKeepsake: jest.fn() }));
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
});
