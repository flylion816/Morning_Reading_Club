jest.mock('../../services/newcomer-lead.service', () => ({
  getLanding: jest.fn(),
  submit: jest.fn()
}));
jest.mock('../../services/daily-card-share.service', () => ({
  resolve: jest.fn()
}));
jest.mock('../../utils/request', () => ({ post: jest.fn() }));
jest.mock('../../pages/landing/silent-login', () => ({ ensureLoggedIn: jest.fn(() => Promise.resolve(true)) }));

let pageConfig;
let page;
let service;
let shareService;
let request;
let silentLogin;

const INVITER = '507f1f77bcf86cd799439011';

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

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
};

const landingResponse = (viewer = {}) => ({
  inviter: { _id: INVITER, nickname: '阿泰', avatarUrl: '' },
  viewer: { isLoggedIn: false, isMember: false, lead: null, ...viewer },
  contactWithinDays: 3
});

describe('landing page', () => {
  beforeEach(() => {
    jest.resetModules();
    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });
    global.getApp = jest.fn(() => ({ globalData: { userInfo: null } }));
    service = require('../../services/newcomer-lead.service');
    shareService = require('../../services/daily-card-share.service');
    request = require('../../utils/request');
    silentLogin = require('../../pages/landing/silent-login');
    service.getLanding.mockReset();
    service.submit.mockReset();
    shareService.resolve.mockReset();
    request.post.mockReset();
    silentLogin.ensureLoggedIn.mockClear();
    wx.switchTab = jest.fn();
    wx.navigateTo = jest.fn();
    require('../../pages/landing/landing');
    page = createPage();
  });

  afterEach(() => {
    delete global.Page;
    delete global.getApp;
  });

  test('带分享人进入：展示分享人，访客状态', async () => {
    service.getLanding.mockResolvedValue(landingResponse());
    page.onLoad({ inviterId: INVITER, src: 'daily_card', date: '2026-11-14' });
    await flush();
    expect(service.getLanding).toHaveBeenCalledWith(INVITER, { view: true, src: 'daily_card' });
    expect(page.data.loading).toBe(false);
    expect(page.data.mode).toBe('visitor');
    expect(page.data.inviterLabel).toContain('阿泰');
    expect(page.data.dateInfo.dayNumber).toBe('14');
  });

  test('没有分享人：文案回退到品牌', async () => {
    service.getLanding.mockResolvedValue({ inviter: null, viewer: {} });
    page.onLoad({});
    await flush();
    expect(page.data.inviter).toBe(null);
    expect(page.data.inviterLabel).toContain('晨读日签');
  });

  test('已在营里的老书友走 member 状态', async () => {
    service.getLanding.mockResolvedValue(landingResponse({ isLoggedIn: true, isMember: true }));
    page.onLoad({ inviterId: INVITER });
    await flush();
    expect(page.data.mode).toBe('member');
  });

  test('留过言的人看到状态和联系期限', async () => {
    service.getLanding.mockResolvedValue(
      landingResponse({
        isLoggedIn: true,
        lead: { status: 'pending', contactBy: '2026-11-17T04:00:00Z', reason: '想找人一起读' }
      })
    );
    page.onLoad({ inviterId: INVITER });
    await flush();
    expect(page.data.mode).toBe('lead');
    expect(page.data.leadStatusText).toBe('待联系');
    expect(page.data.contactByText).toBe('11 月 17 日');
  });

  test('加载失败进入兜底页，可以重试', async () => {
    service.getLanding.mockRejectedValue(new Error('network'));
    page.onLoad({ inviterId: INVITER });
    await flush();
    expect(page.data.loadError).toBe(true);

    service.getLanding.mockResolvedValue(landingResponse());
    page.handleRetry();
    await flush();
    expect(page.data.loadError).toBe(false);
  });

  test('扫码短码读取完整日签快照，再加载分享人资料', async () => {
    const quote = '晨读🌅'.repeat(40);
    shareService.resolve.mockResolvedValue({
      inviterId: INVITER,
      sourceType: 'daily_card',
      quote,
      note: '我的话',
      lessonName: '第三天',
      periodName: '连接之力',
      dayNumber: 3,
      dateStr: '2026-11-17',
      variant: 'paper'
    });
    service.getLanding.mockResolvedValue(landingResponse());

    page.onLoad({ scene: encodeURIComponent('c=abcd2345') });
    await flush();

    expect(shareService.resolve).toHaveBeenCalledWith('abcd2345');
    expect(page.data.quote).toBe(quote);
    expect(page.data.note).toBe('我的话');
    expect(page.data.lessonLine).toBe('连接之力 · 第 3 天');
    expect(page.data.sourceLine).toBe('第三天');
    expect(page.data.variant).toBe('paper');
    expect(page.data.hasSharedCard).toBe(true);
    expect(service.getLanding).toHaveBeenCalledWith(INVITER, { view: true, src: 'daily_card' });
    expect(page.data.loadError).toBe(false);
  });

  test('扫码读取失败时显示兜底页，不用默认句假装成功，重试可恢复', async () => {
    shareService.resolve.mockRejectedValue(new Error('network'));
    page.onLoad({ scene: 'c=abcd2345' });
    await flush();
    expect(page.data.loadError).toBe(true);
    expect(page.data.quote).toBe('');
    expect(service.getLanding).not.toHaveBeenCalled();

    shareService.resolve.mockResolvedValue({
      inviterId: INVITER,
      sourceType: 'daily_card',
      quote: '恢复后的正文',
      lessonName: '第三天',
      dateStr: '2026-11-17',
      variant: 'blank'
    });
    service.getLanding.mockResolvedValue(landingResponse());
    await page.handleRetry();
    await flush();
    expect(page.data.loadError).toBe(false);
    expect(page.data.quote).toBe('恢复后的正文');
    expect(page.data.variant).toBe('blank');
  });

  test('快照读取成功但访客资料暂时失败时仍显示日签正文', async () => {
    shareService.resolve.mockResolvedValue({
      inviterId: INVITER,
      sourceType: 'daily_card',
      quote: '先把这一段读完',
      dateStr: '2026-11-17',
      variant: 'dawn'
    });
    service.getLanding.mockRejectedValue(new Error('profile offline'));
    page.onLoad({ scene: 'c=abcd2345' });
    await flush();
    expect(page.data.loading).toBe(false);
    expect(page.data.loadError).toBe(false);
    expect(page.data.quote).toBe('先把这一段读完');
  });

  describe('留言', () => {
    beforeEach(async () => {
      service.getLanding.mockResolvedValue(landingResponse());
      page.onLoad({ inviterId: INVITER, src: 'daily_card' });
      await flush();
      page.handleOpenSheet();
    });

    test('缺原因、手机号、授权时不提交，也不登录', async () => {
      await page.handleSubmit();
      expect(page.data.formError).toContain('原因');
      page.setData({ selectedReason: '想找人一起读' });
      await page.handleSubmit();
      expect(page.data.formError).toContain('手机号');
      page.setData({ phone: '13800000000' });
      await page.handleSubmit();
      expect(page.data.formError).toContain('授权');
      expect(silentLogin.ensureLoggedIn).not.toHaveBeenCalled();
      expect(service.submit).not.toHaveBeenCalled();
    });

    test('提交时才静默登录，并带上分享人、来源和授权版本', async () => {
      service.submit.mockResolvedValue({
        lead: { status: 'pending', phoneMasked: '138****0000', contactBy: '2026-11-17T04:00:00Z' }
      });
      page.setData({ selectedReason: '想找人一起读', phone: '13800000000', agreed: true });
      await page.handleSubmit();

      expect(silentLogin.ensureLoggedIn).toHaveBeenCalledTimes(1);
      expect(service.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: '想找人一起读',
          phone: '13800000000',
          agreed: true,
          consentVersion: 'newcomer-consent-v1',
          inviterId: INVITER,
          sourceType: 'daily_card'
        })
      );
      expect(page.data.submitted).toBe(true);
      expect(page.data.maskedPhone).toBe('138****0000');
      expect(page.data.sheetVisible).toBe(false);
    });

    test('提交失败时保留表单并提示，可以再试', async () => {
      service.submit.mockRejectedValue(new Error('服务器开小差了'));
      page.setData({ selectedReason: '想找人一起读', phone: '13800000000', agreed: true });
      await page.handleSubmit();
      expect(page.data.submitted).toBe(false);
      expect(page.data.sheetVisible).toBe(true);
      expect(page.data.submitting).toBe(false);
      expect(page.data.formError).toBeTruthy();
    });

    test('提交时发现已经是老书友：收起弹层，切到 member', async () => {
      service.submit.mockRejectedValue(new Error('你已经在营里了'));
      page.setData({ selectedReason: '想找人一起读', phone: '13800000000', agreed: true });
      await page.handleSubmit();
      expect(page.data.mode).toBe('member');
      expect(page.data.sheetVisible).toBe(false);
    });

    test('微信手机号授权被拒绝：改为手动输入，不报错', async () => {
      await page.handleGetPhoneNumber({ detail: { errMsg: 'getPhoneNumber:fail user deny' } });
      expect(page.data.phoneManual).toBe(true);
      expect(request.post).not.toHaveBeenCalled();
    });

    test('微信手机号授权成功：先登录再换号码并回填', async () => {
      request.post.mockResolvedValue({ phone: '13900001111' });
      await page.handleGetPhoneNumber({ detail: { code: 'abc' } });
      expect(silentLogin.ensureLoggedIn).toHaveBeenCalled();
      expect(request.post).toHaveBeenCalledWith('/auth/phone', { code: 'abc' });
      expect(page.data.phone).toBe('13900001111');
    });

    test('手机号输入只保留数字、最多 11 位', () => {
      page.handlePhoneInput({ detail: { value: '138-0000 00001234' } });
      expect(page.data.phone).toBe('13800000000');
    });
  });

  test('转发时分享人换成自己；没登录则保留原分享人', async () => {
    service.getLanding.mockResolvedValue(landingResponse());
    page.onLoad({ inviterId: INVITER, src: 'daily_card' });
    await flush();

    let share = page.onShareAppMessage();
    expect(share.path).toContain(`inviterId=${INVITER}`);

    const myId = '507f1f77bcf86cd799439022';
    global.getApp = jest.fn(() => ({ globalData: { userInfo: { _id: myId } } }));
    share = page.onShareAppMessage();
    expect(share.path).toContain(`inviterId=${myId}`);
    expect(share.path).not.toContain(`inviterId=${INVITER}`);
  });
  describe('统计、朋友圈、单页模式', () => {
    test('只有第一次打开计一次访问；静默刷新和重试不重复计', async () => {
      service.getLanding.mockResolvedValue(landingResponse());
      page.onLoad({ inviterId: INVITER, src: 'daily_card' });
      await flush();
      expect(service.getLanding.mock.calls[0][1].view).toBe(true);
      page.onShow();
      await flush();
      page.handleRetry();
      await flush();
      expect(service.getLanding.mock.calls.slice(1).every(call => call[1].view === false)).toBe(true);
    });

    test('分享到朋友圈：带上分享人的参数，没有路径', () => {
      global.getApp = jest.fn(() => ({ globalData: { userInfo: { _id: INVITER } } }));
      page.onLoad({ inviterId: '507f1f77bcf86cd799439099', src: 'daily_card', quote: encodeURIComponent('由内而外') });
      const share = page.onShareTimeline();
      expect(share.query).toContain(`inviterId=${INVITER}`);
      expect(share.query).toContain('src=daily_card');
      expect(share.query).not.toContain('/pages');
      expect(share.title).toContain('晨读日签');
    });

    test('朋友圈单页模式：不请求接口，只展示内容并引导去小程序', async () => {
      wx.getLaunchOptionsSync = jest.fn(() => ({ scene: 1154 }));
      page.onLoad({ inviterId: INVITER, quote: encodeURIComponent('由内而外') });
      await flush();
      expect(service.getLanding).not.toHaveBeenCalled();
      expect(page.data.singlePage).toBe(true);
      expect(page.data.loading).toBe(false);
      expect(page.data.quote).toBe('由内而外');
      delete wx.getLaunchOptionsSync;
    });

    test('朋友圈紧凑参数保留长正文和模板，并使用对应封面', async () => {
      const { buildLandingQuery } = require('../../utils/landing-share');
      const quote = '晨读🌅'.repeat(40);
      const query = buildLandingQuery({
        inviterId: INVITER,
        sourceType: 'daily_card',
        dateStr: '2026-11-17',
        lessonName: '第三天',
        periodName: '连接之力',
        dayNumber: 3,
        quote,
        variant: 'blank'
      });
      const options = Object.fromEntries(query.split('&').map(pair => pair.split('=')));
      wx.getLaunchOptionsSync = jest.fn(() => ({ scene: 1154 }));
      page.onLoad(options);
      await flush();
      expect(service.getLanding).not.toHaveBeenCalled();
      expect(page.data.quote).toBe(quote);
      expect(page.data.variant).toBe('blank');
      expect(page.onShareAppMessage().imageUrl).toBe('/assets/images/daily-card-cover-blank.png');
      delete wx.getLaunchOptionsSync;
    });

    test('进入时开放朋友圈分享菜单', () => {
      wx.showShareMenu = jest.fn();
      service.getLanding.mockResolvedValue(landingResponse());
      page.onLoad({});
      expect(wx.showShareMenu).toHaveBeenCalledWith(expect.objectContaining({ menus: ['shareAppMessage', 'shareTimeline'] }));
    });
  });
});
