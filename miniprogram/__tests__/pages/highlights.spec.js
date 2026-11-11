jest.mock('../../services/highlight.service', () => ({
  getMine: jest.fn(),
  updateNote: jest.fn(),
  removeHighlight: jest.fn()
}));
jest.mock('../../utils/require-login', () => ({ requireLogin: jest.fn(() => true) }));

describe('highlights page', () => {
  let page;
  let service;

  const item = {
    _id: 'h1',
    text: '读书使人充实',
    note: '',
    periodName: '一期',
    day: 3,
    sectionTitle: '主动积极'
  };

  beforeEach(() => {
    jest.resetModules();
    let config;
    global.Page = jest.fn(c => {
      config = c;
    });
    service = require('../../services/highlight.service');
    service.getMine.mockReset();
    service.updateNote.mockReset().mockResolvedValue({});
    service.removeHighlight.mockReset().mockResolvedValue({});
    require('../../pages/highlights/highlights');
    page = {
      ...config,
      data: JSON.parse(JSON.stringify(config.data)),
      setData(update, cb) {
        this.data = { ...this.data, ...update };
        if (cb) cb();
      }
    };
    wx.navigateTo.mockClear();
    wx.showModal = jest.fn();
    wx.showToast = jest.fn();
  });

  test('加载列表并拼出来源小字与期次筛选', async () => {
    service.getMine.mockResolvedValue({
      list: [item],
      total: 1,
      periods: [{ id: 'p1', name: '一期', count: 1 }]
    });
    await page.loadList(true);
    expect(page.data.list[0].source).toBe('一期 · 第 3 天 · 主动积极');
    expect(page.data.periods).toHaveLength(1);
    expect(page.data.hasMore).toBe(false);
    expect(page.data.loading).toBe(false);
  });

  test('接口失败显示重试态', async () => {
    service.getMine.mockRejectedValue(new Error('x'));
    await page.loadList(true);
    expect(page.data.error).toBe(true);
  });

  test('空态', async () => {
    service.getMine.mockResolvedValue({ list: [], total: 0, periods: [] });
    await page.loadList(true);
    expect(page.data.list).toEqual([]);
    expect(page.data.error).toBe(false);
  });

  test('切换期次带 periodId 重新加载', async () => {
    service.getMine.mockResolvedValue({ list: [], total: 0, periods: [] });
    page.handleSelectPeriod({ currentTarget: { dataset: { id: 'p1' } } });
    await Promise.resolve();
    expect(service.getMine).toHaveBeenCalledWith({ page: 1, limit: 20, periodId: 'p1' });
  });

  test('编辑感想并保存', async () => {
    page.data.list = [{ ...item, source: 's' }];
    page.handleStartEdit({ currentTarget: { dataset: { id: 'h1' } } });
    page.handleNoteInput({ detail: { value: ' 好句子 ' } });
    await page.handleSaveNote();
    expect(service.updateNote).toHaveBeenCalledWith('h1', ' 好句子 ');
    expect(page.data.list[0].note).toBe('好句子');
    expect(page.data.editingId).toBe('');
  });

  test('删除需二次确认', async () => {
    page.data.list = [{ ...item, source: 's' }];
    service.getMine.mockResolvedValue({ list: [], total: 0, periods: [] });
    page.handleDelete({ currentTarget: { dataset: { id: 'h1' } } });
    expect(service.removeHighlight).not.toHaveBeenCalled();
    wx.showModal.mock.calls[0][0].success({ confirm: true });
    await Promise.resolve();
    expect(service.removeHighlight).toHaveBeenCalledWith('h1');
  });

  test('做成日签跳转并编码参数', () => {
    page.data.list = [{ ...item, source: '一期 · 第 3 天 · 主动积极' }];
    page.handleMakeCard({ currentTarget: { dataset: { id: 'h1' } } });
    const url = wx.navigateTo.mock.calls[0][0].url;
    expect(url).toBe(
      `/pages/daily-card/daily-card?quote=${encodeURIComponent('读书使人充实')}&source=${encodeURIComponent('一期 · 第 3 天 · 主动积极')}`
    );
  });

  test('丢弃过期响应', async () => {
    let resolveFirst;
    service.getMine.mockImplementationOnce(() => new Promise(r => { resolveFirst = r; }));
    service.getMine.mockResolvedValueOnce({ list: [{ ...item, _id: 'new' }], total: 1, periods: [] });
    const first = page.loadList(true);
    await page.loadList(true);
    resolveFirst({ list: [{ ...item, _id: 'old' }], total: 1, periods: [] });
    await first;
    expect(page.data.list[0]._id).toBe('new');
  });

  test('onShow 短时间内回来不重载，登录提示只弹一次', async () => {
    const { requireLogin } = require('../../utils/require-login');
    service.getMine.mockResolvedValue({ list: [], total: 0, periods: [] });
    page.onShow();
    await Promise.resolve();
    await Promise.resolve();
    page.onShow();
    expect(service.getMine).toHaveBeenCalledTimes(1);
    expect(requireLogin).toHaveBeenCalledTimes(1);
  });

  test('做成日签的原文截到 120 字', () => {
    page.data.list = [{ ...item, text: '读'.repeat(300), source: 's' }];
    page.handleMakeCard({ currentTarget: { dataset: { id: 'h1' } } });
    const url = wx.navigateTo.mock.calls[0][0].url;
    const quote = decodeURIComponent(url.split('quote=')[1].split('&')[0]);
    expect(quote).toHaveLength(120);
  });
});
