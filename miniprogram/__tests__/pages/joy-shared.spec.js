jest.mock('../../pages/joy-notes/share.service', () => ({ read: jest.fn(), open: jest.fn(), revoke: jest.fn(), qrcode: jest.fn(), status: jest.fn() }));

describe('收到分享的一页', () => {
  let config;
  let page;
  let service;
  let tenantStorage;
  let constants;

  const share = (extra = {}) => ({
    code: 'abcd2345',
    isOwner: false,
    audience: 'period',
    kind: 'joy',
    title: '',
    content: '一句触动的话',
    contentHtml: '',
    awareness: null,
    author: { nickname: '狮子', avatarUrl: '', avatar: '' },
    periodName: '第 12 期',
    sectionTitle: '知彼解己',
    day: 5,
    createdAt: new Date(2026, 10, 16, 7, 40).toISOString(),
    ...extra
  });

  const awareness = (extra = {}) => ({
    facts: '孩子磨蹭，我提高了声音。',
    factsHtml: '<p>孩子磨蹭，<span style="color:#dc2626">我提高了声音</span></p>',
    feelings: ['着急', '委屈'],
    bodyAreas: ['胸口'],
    feelingNote: '有点累',
    asks: [
      { level: 1, question: '那一刻，我有没有先听懂对方？', answer: '没有', answerHtml: '' },
      { level: 2, question: '如果我是 TA，我在经历什么？', answer: '想画完那页', answerHtml: '<p><strong>想画完那页</strong></p>' }
    ],
    choice: '明天提前十分钟叫他',
    choiceHtml: '',
    followUps: [{ content: '这周做到了三天', createdAt: new Date(2026, 10, 23).toISOString() }],
    ...extra
  });

  const mount = async (options = { code: 'abcd2345' }) => {
    page = {
      ...config,
      data: JSON.parse(JSON.stringify(config.data)),
      setData(update, callback) {
        this.data = { ...this.data, ...update };
        if (callback) callback();
      }
    };
    page.onLoad(options);
    await new Promise(resolve => setImmediate(resolve));
    return page;
  };

  beforeEach(() => {
    jest.resetModules();
    global.Page = jest.fn(value => { config = value; });
    wx.__storage = {};
    wx.showToast = jest.fn();
    wx.switchTab = jest.fn(options => options.success && options.success());
    wx.reLaunch = jest.fn();
    wx.navigateTo = jest.fn();
    wx.hideShareMenu = jest.fn();
    wx.getLaunchOptionsSync = jest.fn(() => ({ scene: 1007 }));
    service = require('../../pages/joy-notes/share.service');
    service.read.mockReset();
    service.read.mockResolvedValue(share());
    tenantStorage = require('../../utils/storage').tenantStorage;
    constants = require('../../config/constants');
    tenantStorage.set(constants.STORAGE_KEYS.TOKEN, 'token');
    require('../../pages/joy-notes/shared/shared');
  });

  afterEach(() => {
    delete global.Page;
  });

  describe('进来：没登录或打不开就回首页', () => {
    test('没登录：不请求内容，直接回首页并提示', async () => {
      tenantStorage.remove(constants.STORAGE_KEYS.TOKEN);
      await mount();
      expect(service.read).not.toHaveBeenCalled();
      expect(wx.switchTab).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/index/index' }));
      expect(wx.showToast).toHaveBeenCalledWith({ title: '登录后才能查看这一页', icon: 'none' });
    });

    test('没有分享码：回首页', async () => {
      await mount({});
      expect(service.read).not.toHaveBeenCalled();
      expect(wx.switchTab).toHaveBeenCalled();
      await mount({ code: 'not-valid' });
      expect(service.read).not.toHaveBeenCalled();
    });

    test.each([
      [401, undefined, '登录后才能查看这一页'],
      [403, '这一页只对本期书友开放', '这一页只对本期书友开放'],
      [403, undefined, '这一页暂时没法给你看'],
      [404, '这个分享已经停止了', '这个分享已经停止了'],
      [500, undefined, '这一页暂时打不开']
    ])('请求返回 %s：回首页，提示「%s」', async (status, message, toast) => {
      service.read.mockRejectedValue({ statusCode: status, message });
      await mount();
      expect(wx.switchTab).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/index/index' }));
      expect(wx.showToast).toHaveBeenCalledWith({ title: toast, icon: 'none' });
    });

    test('网络错误（没有状态码）也回首页', async () => {
      service.read.mockRejectedValue(new Error('offline'));
      await mount();
      expect(wx.switchTab).toHaveBeenCalled();
    });

    test('首页切换失败时改用 reLaunch；只回一次首页', async () => {
      wx.switchTab = jest.fn(options => options.fail && options.fail());
      service.read.mockRejectedValue({ statusCode: 404 });
      await mount();
      expect(wx.reLaunch).toHaveBeenCalledWith({ url: '/pages/index/index' });
      page.goHome('再来一次');
      expect(wx.switchTab).toHaveBeenCalledTimes(1);
    });

    test('点转发卡片（code）和扫小程序码（scene=s=…）都能进来；码格式不对的不请求', async () => {
      await mount({ code: 'abcd2345' });
      expect(service.read).toHaveBeenLastCalledWith('abcd2345');
      await mount({ scene: encodeURIComponent('s=wxyz6789') });
      expect(service.read).toHaveBeenLastCalledWith('wxyz6789');
      await mount({ scene: 's=ABCD2345' });
      expect(service.read).toHaveBeenLastCalledWith('abcd2345');
      service.read.mockClear();
      await mount({ scene: 's=short' });
      expect(service.read).not.toHaveBeenCalled();
    });

    test('收到的人不能再转发：隐藏转发和朋友圈菜单，页面也没有转发处理函数', async () => {
      await mount();
      expect(wx.hideShareMenu).toHaveBeenCalledWith({ menus: ['shareAppMessage', 'shareTimeline'] });
      expect(config.onShareAppMessage).toBeUndefined();
      expect(config.onShareTimeline).toBeUndefined();
    });

    test('朋友圈单页模式不能请求接口：只提示前往小程序', async () => {
      wx.getLaunchOptionsSync = jest.fn(() => ({ scene: 1154 }));
      await mount();
      expect(service.read).not.toHaveBeenCalled();
      expect(page.data).toMatchObject({ singlePage: true, loading: false });
      expect(wx.switchTab).not.toHaveBeenCalled();
    });
  });

  describe('展示', () => {
    test('随喜：作者、日期、来源、标题、正文', async () => {
      service.read.mockResolvedValue(share({ title: '一页标题' }));
      await mount();
      expect(page.data.loading).toBe(false);
      expect(page.data.view).toMatchObject({
        kind: 'joy', isOwner: false, title: '一页标题', content: '一句触动的话', contentNodes: '',
        dateLabel: '11月16日 清晨', sourceLabel: '第 12 期 · 第 5 天 · 知彼解己'
      });
      expect(page.data.view.author.nickname).toBe('狮子');
      expect(page.data.view.awareness).toBe(null);
    });

    test('随喜带格式：交给 rich-text 展示', async () => {
      service.read.mockResolvedValue(share({ contentHtml: '<p>今天<span style="color:#dc2626">重点</span></p>' }));
      await mount();
      expect(page.data.view.contentNodes).toContain('color:#dc2626');
    });

    test('觉察：看感问择后来排成一条线，格式保留，没有回访状态', async () => {
      service.read.mockResolvedValue(share({ kind: 'awareness', awareness: awareness() }));
      await mount();
      const view = page.data.view.awareness;
      expect(page.data.view.kind).toBe('awareness');
      expect(view.facts).toBe('孩子磨蹭，我提高了声音。');
      expect(view.factsNodes).toContain('color:#dc2626');
      expect(view.feelings).toEqual(['着急', '委屈']);
      expect(view.bodyText).toBe('胸口');
      expect(view.asks.map(ask => ask.label)).toEqual(['一叩', '再叩']);
      expect(view.asks[0].answerNodes).toBe('');
      expect(view.asks[1].answerNodes).toContain('<strong>');
      expect(view.choice).toBe('明天提前十分钟叫他');
      expect(view.followUps).toEqual([{ content: '这周做到了三天', dateLabel: '11月23日' }]);
    });

    test('范围是「所有登录的书友」时没有期次名：不显示来源；作者自己看会有提示', async () => {
      service.read.mockResolvedValue(share({ periodName: '', sectionTitle: '', day: null, isOwner: true }));
      await mount();
      expect(page.data.view.sourceLabel).toBe('');
      expect(page.data.view.isOwner).toBe(true);
    });

    test('开篇（第 0 天）显示「开篇」', async () => {
      service.read.mockResolvedValue(share({ day: 0 }));
      await mount();
      expect(page.data.view.sourceLabel).toBe('第 12 期 · 开篇 · 知彼解己');
    });
  });

  describe('底部', () => {
    test('我也来记一记：去觉察日记；回到首页', async () => {
      await mount();
      page.goWrite();
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/joy-notes/joy-notes' });
      page.backHome();
      expect(wx.switchTab).toHaveBeenLastCalledWith({ url: '/pages/index/index' });
    });

    test('页面用全局的头像组件，只读、没有输入框', () => {
      const fs = require('fs');
      const path = require('path');
      const wxml = fs.readFileSync(path.join(__dirname, '../../pages/joy-notes/shared/shared.wxml'), 'utf8');
      expect(wxml).toContain('<user-avatar');
      expect(wxml).not.toMatch(/<(textarea|input|editor|rich-input)\b/);
      expect(wxml).not.toContain('open-type="share"');
    });
  });
});
