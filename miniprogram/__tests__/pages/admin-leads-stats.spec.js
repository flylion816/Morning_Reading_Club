jest.mock('../../services/newcomer-lead.service', () => ({
  getStats: jest.fn(),
  listLeads: jest.fn(() => Promise.resolve({ list: [], counts: {}, pagination: {} })),
  claimLead: jest.fn()
}));

describe('接待组：落地页数据', () => {
  let page;
  let service;

  beforeEach(() => {
    jest.resetModules();
    let config;
    global.Page = jest.fn(value => { config = value; });
    global.getApp = jest.fn(() => ({ globalData: { userInfo: { _id: 'u1' } } }));
    service = require('../../services/newcomer-lead.service');
    service.getStats.mockReset();
    require('../../pages/admin-leads/admin-leads');
    page = {
      ...config,
      data: JSON.parse(JSON.stringify(config.data)),
      setData(update, cb) { this.data = { ...this.data, ...update }; if (cb) cb(); }
    };
  });

  afterEach(() => { delete global.Page; delete global.getApp; });

  test('显示近 30 天访问、留言、转化和带来留言最多的分享人', async () => {
    service.getStats.mockResolvedValue({ days: 30, views: 100, leads: 4, fromShares: 2, conversion: 4, topInviters: [{ nickname: '阿泰', leads: 2 }] });
    await page.loadStats();
    expect(service.getStats).toHaveBeenCalledWith(30);
    expect(page.data.statsText).toBe('近 30 天 访问 100 次 · 留言 4 条 · 转化 4% · 2 条来自分享');
    expect(page.data.topText).toBe('带来留言最多：阿泰 2');
  });

  test('没有访问时不写转化率；取不到统计时不显示也不报错', async () => {
    service.getStats.mockResolvedValue({ days: 30, views: 0, leads: 0, fromShares: 0, conversion: null, topInviters: [] });
    await page.loadStats();
    expect(page.data.statsText).toBe('近 30 天 访问 0 次 · 留言 0 条');
    expect(page.data.topText).toBe('');
    service.getStats.mockRejectedValue(new Error('x'));
    await page.loadStats();
    expect(page.data.statsText).toBe('');
  });
});
