jest.mock('../../services/letter.service', () => ({
  getPeriodLetter: jest.fn(),
  saveDraft: jest.fn(),
  seal: jest.fn(),
  open: jest.fn(),
  reply: jest.fn()
}));
jest.mock('../../utils/storage', () => ({ tenantStorage: { get: jest.fn() } }));
jest.mock('../../config/constants', () => ({ STORAGE_KEYS: { TOKEN: 'token' } }));

let pageConfig;
let page;
let letterService;
let storage;

function createPage() {
  return {
    ...pageConfig,
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    setData(update, cb) {
      this.data = { ...this.data, ...update };
      if (typeof cb === 'function') cb();
    }
  };
}

describe('slow-mail page', () => {
  beforeEach(() => {
    jest.resetModules();
    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });
    wx.showModal = jest.fn();
    wx.showToast = jest.fn();
    wx.navigateTo = jest.fn();
    letterService = require('../../services/letter.service');
    storage = require('../../utils/storage');
    Object.values(letterService).forEach(fn => fn.mockReset());
    storage.tenantStorage.get.mockReturnValue('tok');
    require('../../pages/slow-mail/slow-mail');
    page = createPage();
  });

  afterEach(() => {
    delete global.Page;
  });

  test('未登录显示登录提示且不请求', async () => {
    storage.tenantStorage.get.mockReturnValue(null);
    await page.onLoad({ periodId: 'p1' });
    expect(page.data.needLogin).toBe(true);
    expect(letterService.getPeriodLetter).not.toHaveBeenCalled();
  });

  test('可以写时显示按期次天数的提示语', async () => {
    letterService.getPeriodLetter.mockResolvedValue({ status: 'none', canWrite: true, periodDays: 23 });
    await page.onLoad({ periodId: 'p1' });
    expect(page.data.view).toBe('write');
    expect(page.data.prompt).toBe('读完这 23 天，你希望自己有什么不一样？');
  });

  test('窗口已过且没写显示信箱已关', async () => {
    letterService.getPeriodLetter.mockResolvedValue({ status: 'none', canWrite: false });
    await page.onLoad({ periodId: 'p1' });
    expect(page.data.view).toBe('closed');
  });

  test('窗口已过但已有草稿仍显示草稿并可封存', async () => {
    letterService.getPeriodLetter.mockResolvedValue({
      status: 'draft',
      canWrite: false,
      content: '写给未来的我',
      stamp: 'leaf'
    });
    await page.onLoad({ periodId: 'p1' });
    expect(page.data.view).toBe('draft-closed');
    expect(page.data.content).toBe('写给未来的我');

    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    letterService.seal.mockResolvedValue({ status: 'sealed', canWrite: false });
    page.onSeal();
    wx.showModal.mock.calls[0][0].success({ confirm: true });
    await new Promise(r => setImmediate(r));
    expect(letterService.saveDraft).not.toHaveBeenCalled();
    expect(letterService.seal).toHaveBeenCalledWith('p1');
    jest.advanceTimersByTime(page.POST_MS);
    expect(page.data.view).toBe('sealed');
    jest.useRealTimers();
  });

  test('各状态映射到对应视图', async () => {
    for (const [status, view] of [['sealed', 'sealed'], ['delivered', 'delivered'], ['opened', 'opened']]) {
      letterService.getPeriodLetter.mockResolvedValue({ status, canWrite: false });
      await page.onLoad({ periodId: 'p1' });
      expect(page.data.view).toBe(view);
    }
  });

  test('接口失败显示重试', async () => {
    letterService.getPeriodLetter.mockRejectedValue(new Error('x'));
    await page.onLoad({ periodId: 'p1' });
    expect(page.data.loadError).toBe(true);
  });

  test('投递前二次确认，取消不请求', async () => {
    page.setData({ periodId: 'p1', content: '你好' });
    page.onSeal();
    expect(wx.showModal.mock.calls[0][0].content).toBe('投递后要到结营那天才能再打开，确定吗？');
    wx.showModal.mock.calls[0][0].success({ confirm: false });
    expect(letterService.seal).not.toHaveBeenCalled();
  });

  test('确认投递后先存草稿再封存并切到已封存', async () => {
    page.setData({ periodId: 'p1', content: '你好', stamp: 'leaf' });
    letterService.saveDraft.mockResolvedValue({});
    letterService.seal.mockResolvedValue({ status: 'sealed', canWrite: false, daysToDeliver: 20 });
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    const globalData = {};
    global.getApp = jest.fn(() => ({ globalData }));
    page.onSeal();
    wx.showModal.mock.calls[0][0].success({ confirm: true });
    await new Promise(r => setImmediate(r));
    expect(letterService.saveDraft).toHaveBeenCalledWith('p1', { content: '你好', stamp: 'leaf' });
    // 寄出后先演投递，演完才换成「信在路上」；首页的提醒被标记为要收起
    expect(page.data.posting).toBe(true);
    expect(page.data.view).not.toBe('sealed');
    expect(globalData.homeLetterDirty).toBe(true);
    jest.advanceTimersByTime(page.POST_MS - 100);
    expect(page.data.posting).toBe(true);
    jest.advanceTimersByTime(100);
    expect(page.data.view).toBe('sealed');
    expect(page.data.posting).toBe(false);
    expect(page.data.busy).toBe(false);
    jest.useRealTimers();
  });

  test('回信成功后显示回信', async () => {
    page.setData({ letter: { id: 'l1' }, replyText: ' 谢谢 ' });
    letterService.reply.mockResolvedValue({ id: 'l1', status: 'opened', reply: '谢谢' });
    await page.onReply();
    expect(letterService.reply).toHaveBeenCalledWith('l1', '谢谢');
    expect(page.data.letter.reply).toBe('谢谢');
  });

  test('拆信动画期间不会重复请求', async () => {
    jest.useFakeTimers();
    page.setData({ letter: { id: 'l1' }, view: 'delivered' });
    letterService.open.mockResolvedValue({ id: 'l1', status: 'opened', content: '信' });

    const first = page.onOpen();
    await Promise.resolve();
    const second = page.onOpen();
    expect(letterService.open).toHaveBeenCalledTimes(1);
    expect(page.data.busy).toBe(true);
    expect(page.data.opening).toBe(true);

    jest.advanceTimersByTime(page.UNSEAL_MS - 100);
    expect(page.data.opening).toBe(true);
    jest.advanceTimersByTime(100);
    await Promise.all([first, second]);
    expect(page.data.view).toBe('opened');
    expect(page.data.busy).toBe(false);
    expect(page.data.opening).toBe(false);
    jest.useRealTimers();
  });

  test('拆信后可以翻开这一期的纪念册', () => {
    global.wx.navigateTo = jest.fn();
    global.getCurrentPages = jest.fn(() => []);
    page.setData({ periodId: 'p1' });
    page.onOpenKeepsake();
    expect(global.wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/keepsake/keepsake?periodId=p1' });
  });

  test('从同一期纪念册进入邮局时返回已有的纪念册，不叠加页面', () => {
    global.wx.navigateBack = jest.fn();
    global.getCurrentPages = jest.fn(() => [
      { route: 'pages/keepsake/keepsake', data: { periodId: 'p1' } },
      { route: 'pages/slow-mail/slow-mail', data: { periodId: 'p1' } }
    ]);
    page.setData({ periodId: 'p1' });
    page.onOpenKeepsake();
    expect(global.wx.navigateBack).toHaveBeenCalledWith({ delta: 1 });
    expect(global.wx.navigateTo).not.toHaveBeenCalled();

    global.getCurrentPages = jest.fn(() => [
      { route: 'pages/keepsake/keepsake', data: { periodId: 'other' } },
      { route: 'pages/slow-mail/slow-mail', data: { periodId: 'p1' } }
    ]);
    page.onOpenKeepsake();
    expect(global.wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/keepsake/keepsake?periodId=p1' });
  });
});
