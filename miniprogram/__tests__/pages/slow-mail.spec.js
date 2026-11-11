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
    expect(page.data.prompt).toBe('23 天后，你希望自己有什么不一样？');
  });

  test('窗口已过且没写显示信箱已关', async () => {
    letterService.getPeriodLetter.mockResolvedValue({ status: 'none', canWrite: false });
    await page.onLoad({ periodId: 'p1' });
    expect(page.data.view).toBe('closed');
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
    page.onSeal();
    wx.showModal.mock.calls[0][0].success({ confirm: true });
    await new Promise(r => setImmediate(r));
    expect(letterService.saveDraft).toHaveBeenCalledWith('p1', { content: '你好', stamp: 'leaf' });
    expect(page.data.view).toBe('sealed');
  });

  test('回信成功后显示回信', async () => {
    page.setData({ letter: { id: 'l1' }, replyText: ' 谢谢 ' });
    letterService.reply.mockResolvedValue({ id: 'l1', status: 'opened', reply: '谢谢' });
    await page.onReply();
    expect(letterService.reply).toHaveBeenCalledWith('l1', '谢谢');
    expect(page.data.letter.reply).toBe('谢谢');
  });
});
