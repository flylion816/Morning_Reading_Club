jest.mock('../../services/buddy.service', () => ({
  getState: jest.fn(),
  join: jest.fn(),
  cancel: jest.fn(),
  nudge: jest.fn(),
  leave: jest.fn()
}));
jest.mock('../../utils/require-login', () => ({ requireLogin: jest.fn(() => true) }));

let pageConfig;
let page;
let buddyService;
let requireLogin;

function createPage() {
  return {
    ...pageConfig,
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    setData(update, cb) {
      this.data = { ...this.data, ...update };
      if (cb) cb();
    }
  };
}

const paired = {
  state: 'paired',
  buddy: { userId: 'u1', nickname: '小一', avatarUrl: '', readToday: false, checkedInToday: false },
  canNudge: true,
  nudgedToday: false,
  me: { readToday: true, checkedInToday: false }
};

describe('buddy page', () => {
  beforeEach(() => {
    jest.resetModules();
    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });
    buddyService = require('../../services/buddy.service');
    requireLogin = require('../../utils/require-login').requireLogin;
    requireLogin.mockReturnValue(true);
    Object.values(buddyService).forEach(fn => fn.mockReset());
    wx.showToast.mockClear();
    wx.showModal.mockClear();
    require('../../pages/buddy/buddy');
    page = createPage();
  });

  afterEach(() => {
    delete global.Page;
  });

  test('没有 periodId 时给出提示且不请求', () => {
    page.onLoad({});
    expect(buddyService.getState).not.toHaveBeenCalled();
    expect(page.data.loadError).toBeTruthy();
  });

  test('未登录时不请求', () => {
    requireLogin.mockReturnValue(false);
    page.onLoad({ periodId: 'p1' });
    expect(buddyService.getState).not.toHaveBeenCalled();
    expect(page.data.loading).toBe(false);
  });

  test('已配对时展示读伴与两个状态', async () => {
    buddyService.getState.mockResolvedValue(paired);
    page.onLoad({ periodId: 'p1' });
    await Promise.resolve();
    await Promise.resolve();
    expect(page.data.state).toBe('paired');
    expect(page.data.buddyInitial).toBe('小');
    expect(page.data.canNudge).toBe(true);
    expect(page.data.me.readToday).toBe(true);
  });

  test('加载失败显示页面内错误，重试会再次请求', async () => {
    buddyService.getState.mockRejectedValueOnce(new Error('网络不稳'));
    page.data.periodId = 'p1';
    await page.loadState();
    expect(page.data.loadError).toBe('网络不稳');
    buddyService.getState.mockResolvedValue({ state: 'none' });
    await page.loadState();
    expect(page.data.loadError).toBe('');
    expect(page.data.state).toBe('none');
  });

  test('申请读伴后用返回的状态更新页面', async () => {
    page.data.periodId = 'p1';
    buddyService.join.mockResolvedValue({ state: 'waiting' });
    await page.onJoin();
    await Promise.resolve();
    expect(buddyService.join).toHaveBeenCalledWith('p1');
    expect(page.data.state).toBe('waiting');
  });

  test('轻拍成功后按钮变成今天拍过了', async () => {
    page.data.periodId = 'p1';
    page.data.canNudge = true;
    buddyService.nudge.mockResolvedValue({ ...paired, canNudge: false, nudgedToday: true });
    await page.onNudge();
    await Promise.resolve();
    expect(page.data.nudgedToday).toBe(true);
    expect(page.data.canNudge).toBe(false);
  });

  test('不能轻拍时点击不发请求；轻拍失败提示并刷新', async () => {
    page.data.periodId = 'p1';
    page.data.canNudge = false;
    page.onNudge();
    expect(buddyService.nudge).not.toHaveBeenCalled();

    page.data.canNudge = true;
    buddyService.nudge.mockRejectedValue(new Error('TA 今天已经读过了'));
    buddyService.getState.mockResolvedValue(paired);
    await page.onNudge();
    await Promise.resolve();
    expect(wx.showToast).toHaveBeenCalledWith({ title: 'TA 今天已经读过了', icon: 'none' });
    expect(buddyService.getState).toHaveBeenCalled();
  });

  test('结束读伴需要二次确认', async () => {
    page.data.periodId = 'p1';
    buddyService.leave.mockResolvedValue({ state: 'ended' });
    wx.showModal.mockImplementationOnce(() => {});
    page.onLeave();
    expect(wx.showModal).toHaveBeenCalled();
    expect(buddyService.leave).not.toHaveBeenCalled();
    wx.showModal.mock.calls[0][0].success({ confirm: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(buddyService.leave).toHaveBeenCalledWith('p1');
    expect(page.data.state).toBe('ended');
  });

  test('canJoin 随接口返回写入页面，期次结束时为 false', async () => {
    page.data.periodId = 'p1';
    buddyService.getState.mockResolvedValue({ state: 'ended', canJoin: false });
    await page.loadState();
    expect(page.data.canJoin).toBe(false);
    buddyService.getState.mockResolvedValue({ state: 'ended', canJoin: true });
    await page.loadState();
    expect(page.data.canJoin).toBe(true);
  });

  test('取消等待', async () => {
    page.data.periodId = 'p1';
    buddyService.cancel.mockResolvedValue({ state: 'none' });
    await page.onCancel();
    await Promise.resolve();
    expect(page.data.state).toBe('none');
  });
});
