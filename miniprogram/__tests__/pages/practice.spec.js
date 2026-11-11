jest.mock('../../services/practice.service', () => ({
  getCurrent: jest.fn(),
  setCurrent: jest.fn(),
  logToday: jest.fn(),
  getHistory: jest.fn()
}));
jest.mock('../../utils/require-login', () => ({ requireLogin: jest.fn(() => true) }));

let pageConfig;
let service;
let requireLogin;

function create(options = { periodId: 'p1' }) {
  const page = {
    ...pageConfig,
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    setData(update) {
      this.data = { ...this.data, ...update };
    }
  };
  page.onLoad(options);
  return page;
}

const ready = {
  active: true,
  weekIndex: 2,
  weekRange: { from: '2026-11-09', to: '2026-11-15' },
  practice: { id: 'x', text: '先听完再开口' },
  today: { date: '2026-11-11', done: null, note: '' },
  logs: [
    { date: '2026-11-09', done: true, note: '' },
    { date: '2026-11-10', done: false, note: '' }
  ],
  suggestions: []
};

describe('practice page', () => {
  beforeEach(() => {
    jest.resetModules();
    global.Page = jest.fn(config => {
      pageConfig = config;
    });
    global.wx.showToast = jest.fn();
    service = require('../../services/practice.service');
    requireLogin = require('../../utils/require-login').requireLogin;
    requireLogin.mockReturnValue(true);
    require('../../pages/practice/practice');
  });

  it('未登录时不请求', () => {
    requireLogin.mockReturnValue(false);
    create().onShow();
    expect(service.getCurrent).not.toHaveBeenCalled();
  });

  it('期次未进行时显示安静说明状态', async () => {
    service.getCurrent.mockResolvedValue({ active: false });
    const page = create();
    await page.load();
    expect(page.data.status).toBe('inactive');
  });

  it('接口失败进入 error，可重试', async () => {
    service.getCurrent.mockRejectedValue(new Error('x'));
    const page = create();
    await page.load();
    expect(page.data.status).toBe('error');
  });

  it('未设定时带出建议，点击填入，确认后保存', async () => {
    service.getCurrent.mockResolvedValue({ ...ready, practice: null, logs: [], suggestions: ['睡前写三行'] });
    service.setCurrent.mockResolvedValue({});
    const page = create();
    await page.load();
    expect(page.data.suggestions).toEqual(['睡前写三行']);
    page.onPickSuggestion({ currentTarget: { dataset: { text: '睡前写三行' } } });
    expect(page.data.draft).toBe('睡前写三行');
    await page.onConfirmPractice();
    expect(service.setCurrent).toHaveBeenCalledWith('p1', '睡前写三行');
  });

  it('已设定时生成七个圆点，不含统计字段', async () => {
    service.getCurrent.mockResolvedValue(ready);
    const page = create();
    await page.load();
    expect(page.data.dots.map(d => d.state)).toEqual(['done', 'rest', 'empty', 'empty', 'empty', 'empty', 'empty']);
    expect(page.data.dots[2].isToday).toBe(true);
    expect(page.data).not.toHaveProperty('rate');
    expect(page.data).not.toHaveProperty('streak');
  });

  it('星期标签按实际日期算，末周被截短时只画到结束日', async () => {
    // 2026-11-11 是周三
    service.getCurrent.mockResolvedValue({
      ...ready,
      weekRange: { from: '2026-11-11', to: '2026-11-13' },
      logs: []
    });
    const page = create();
    await page.load();
    expect(page.data.dots.map(d => d.label)).toEqual(['三', '四', '五']);
    service.getCurrent.mockResolvedValue({ ...ready, weekRange: { from: '2026-11-08', to: '2026-11-14' }, logs: [] });
    await page.load();
    expect(page.data.dots.map(d => d.label)).toEqual(['日', '一', '二', '三', '四', '五', '六']);
  });

  it('记录今天：做到了 / 今天没有', async () => {
    service.getCurrent.mockResolvedValue(ready);
    service.logToday.mockResolvedValue({});
    const page = create();
    await page.load();
    page.onNoteInput({ detail: { value: ' 很累 ' } });
    await page.onChooseToday({ currentTarget: { dataset: { done: false } } });
    expect(service.logToday).toHaveBeenCalledWith('p1', false, '很累');
  });

  it('往周只读，排除本周', async () => {
    service.getCurrent.mockResolvedValue(ready);
    service.getHistory.mockResolvedValue({
      weeks: [
        { weekIndex: 2, weekRange: ready.weekRange, practice: { text: 'B' }, logs: [] },
        { weekIndex: 1, weekRange: { from: '2026-11-02', to: '2026-11-08' }, practice: { text: 'A' }, logs: [] }
      ]
    });
    const page = create();
    await page.load();
    await page.onToggleHistory();
    expect(page.data.history).toHaveLength(1);
    expect(page.data.history[0].text).toBe('A');
  });
});
