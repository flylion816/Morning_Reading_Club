jest.mock('../../pages/daily-card/daily-card-share.service', () => ({ create: jest.fn() }));

let pageConfig;
let page;
let shareService;

function makePage() {
  return {
    ...pageConfig,
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    setData(update, cb) {
      Object.keys(update).forEach(k => {
        if (k.includes('.')) {
          const [a, b] = k.split('.');
          this.data[a] = { ...this.data[a], [b]: update[k] };
        } else {
          this.data[k] = update[k];
        }
      });
      if (cb) cb();
    }
  };
}

describe('daily-card page', () => {
  beforeEach(() => {
    jest.resetModules();
    global.__mockCanvasImageSrcs.length = 0;
    global.__mockCanvasContext.drawImage.mockClear();
    global.Page = jest.fn(c => {
      pageConfig = c;
    });
    require('../../pages/daily-card/daily-card.js');
    page = makePage();
    shareService = require('../../pages/daily-card/daily-card-share.service');
    shareService.create.mockReset();
    shareService.create.mockResolvedValue({ code: 'abcd2345', imageBase64: 'cG5n' });
    wx.env = { USER_DATA_PATH: '/tmp' };
    wx.getFileSystemManager = jest.fn(() => ({ writeFile: ({ success }) => success() }));
    wx.showLoading = jest.fn();
    wx.hideLoading = jest.fn();
    wx.showToast = jest.fn();
    wx.showModal = jest.fn();
    wx.openSetting = jest.fn();
    wx.saveImageToPhotosAlbum = jest.fn();
  });

  afterEach(() => {
    delete global.Page;
    delete global.getApp;
    delete wx.getLaunchOptionsSync;
  });

  test('onLoad decodes params and builds preview', () => {
    page.onLoad({
      quote: encodeURIComponent('以终为始'),
      source: encodeURIComponent('第 7 天 · 以终为始'),
      day: '7',
      date: '2026-11-07'
    });
    expect(page.data.quote).toBe('以终为始');
    expect(page.data.source).toBe('第 7 天 · 以终为始');
    expect(page.data.dateStr).toBe('2026-11-07');
    expect(page.data.previewItems.some(i => i.text === '立冬')).toBe(true);
    expect(page.data.previewItems.some(i => i.src === '/assets/images/mini-program-code.jpg')).toBe(true);
    expect(page.data.previewHeightRpx).toBeGreaterThan(0);
  });

  test('without quote shows placeholder guidance', () => {
    page.onLoad({});
    expect(page.data.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(page.data.previewItems.some(i => i.placeholder && i.text === '写下今天想留下的一句话')).toBe(true);
  });

  test('switching variant and editing refresh preview', () => {
    page.onLoad({ quote: 'a', date: '2026-11-10' });
    const before = JSON.stringify(page.data.previewItems);
    page.handleSelectVariant({ currentTarget: { dataset: { value: 'paper' } } });
    expect(page.data.variant).toBe('paper');
    expect(JSON.stringify(page.data.previewItems)).not.toBe(before);

    page.handleEditNote();
    page.handleEditorInput({ detail: { value: '我的话' } });
    page.handleEditorConfirm();
    expect(page.data.note).toBe('我的话');
    expect(page.data.previewItems.some(i => i.text === '—— 我想说：我的话')).toBe(true);
    page.handleToggleNote();
    expect(page.data.previewItems.some(i => /我想说/.test(i.text))).toBe(false);
  });

  test('editor limits quote to 120 chars', () => {
    page.onLoad({});
    page.handleEditQuote();
    expect(page.data.editor.maxlength).toBe(120);
    page.handleEditorInput({ detail: { value: '字'.repeat(150) } });
    page.handleEditorConfirm();
    expect(Array.from(page.data.quote).length).toBe(120);
  });

  test('save failure to generate shows fallback toast', async () => {
    page.onLoad({ quote: 'a' });
    page.generatePoster = jest.fn(() => Promise.reject(new Error('x')));
    await page.handleSave();
    expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'none' }));
    expect(wx.saveImageToPhotosAlbum).not.toHaveBeenCalled();
    expect(page.data.generating).toBe(false);
  });

  test('album permission denied guides to settings', () => {
    page.handleSaveFail({ errMsg: 'saveImageToPhotosAlbum:fail auth deny' });
    expect(wx.showModal).toHaveBeenCalled();
    wx.showModal.mock.calls[0][0].success({ confirm: true });
    expect(wx.openSetting).toHaveBeenCalled();
  });

  test('分享路径保留完整 120 字、来源和分享人，手机与电脑可还原', () => {
    const { parseLandingOptions } = require('../../utils/landing-share');
    const myId = '507f1f77bcf86cd799439011';
    const quote = '晨读🌅'.repeat(40);
    global.getApp = jest.fn(() => ({ globalData: { userInfo: { _id: myId } } }));
    page.onLoad({ quote: encodeURIComponent(quote), source: encodeURIComponent('第三天'), periodName: encodeURIComponent('连接之力'), date: '2026-11-14', day: '3', note: '每天读十分钟' });
    const res = page.onShareAppMessage();
    const options = Object.fromEntries(res.path.split('?')[1].split('&').map(pair => pair.split('=')));
    const parsed = parseLandingOptions(options);
    expect(res.path.startsWith('/pages/landing/landing?')).toBe(true);
    expect(res.path.length).toBeLessThanOrEqual(900);
    expect(parsed).toMatchObject({ inviterId: myId, quote, lessonName: '第三天', periodName: '连接之力', dayNumber: 3, note: '每天读十分钟' });
  });

  test('未登录也能转发；隐藏的感想不会放进分享参数', () => {
    global.getApp = jest.fn(() => ({ globalData: { userInfo: null } }));
    page.onLoad({ quote: 'a', note: '只留给自己' });
    page.handleToggleNote();
    const res = page.onShareAppMessage();
    expect(res.path.startsWith('/pages/landing/landing?')).toBe(true);
    expect(res.path).not.toContain('inviterId');
    expect(res.path).not.toContain('note=');
  });

  test('三种模板使用各自的微信封面，而不是截取长图', () => {
    page.onLoad({ quote: 'a' });
    page.generatePoster = jest.fn();
    for (const variant of ['dawn', 'paper', 'blank']) {
      page.handleSelectVariant({ currentTarget: { dataset: { value: variant } } });
      expect(page.onShareAppMessage().imageUrl).toBe(`/assets/images/daily-card-cover-${variant}.png`);
      expect(page.onShareTimeline().imageUrl).toBe(`/assets/images/daily-card-cover-${variant}.png`);
    }
    expect(page.generatePoster).not.toHaveBeenCalled();
  });

  test('朋友圈单页打开日签时还原紧凑参数，不显示二维码和编辑占位', () => {
    const { buildLandingQuery } = require('../../utils/landing-share');
    const quote = '晨读🌅'.repeat(40);
    const query = buildLandingQuery({
      sourceType: 'daily_card',
      dateStr: '2026-11-17',
      lessonName: '第三天',
      periodName: '连接之力',
      dayNumber: 3,
      quote,
      variant: 'paper'
    });
    const options = Object.fromEntries(query.split('&').map(pair => pair.split('=')));
    wx.getLaunchOptionsSync = jest.fn(() => ({ scene: 1154 }));
    page.onLoad(options);
    expect(page.data.singlePage).toBe(true);
    expect(page.data.quote).toBe(quote);
    expect(page.data.variant).toBe('paper');
    expect(page.data.previewItems.some(item => item.src)).toBe(false);
    expect(page.data.previewItems.some(item => item.placeholder)).toBe(false);
  });

  test('二维码随快照变化重新生成，隐藏感想不会进入快照', async () => {
    page.onLoad({ quote: '完整原文', source: '第三天', periodName: '连接之力', day: '3', date: '2026-11-17', note: '我的话' });
    const first = await page.fetchInviteCodePath();
    await page.fetchInviteCodePath();
    expect(shareService.create).toHaveBeenCalledTimes(1);
    expect(shareService.create).toHaveBeenLastCalledWith(expect.objectContaining({ quote: '完整原文', note: '我的话', source: '第三天', periodName: '连接之力', day: 3 }));
    expect(first).toBe('/tmp/daily-card-code-abcd2345.png');
    page.handleToggleNote();
    await page.fetchInviteCodePath();
    expect(shareService.create).toHaveBeenCalledTimes(2);
    expect(shareService.create).toHaveBeenLastCalledWith(expect.objectContaining({ note: '' }));
  });

  test('生成二维码失败时不使用不含正文的通用码', async () => {
    page.onLoad({ quote: '完整原文' });
    shareService.create.mockRejectedValue(new Error('offline'));
    await expect(page.generatePoster()).rejects.toThrow('offline');
    expect(global.__mockCanvasImageSrcs).not.toContain('/assets/images/mini-program-code.jpg');
  });

  test('分享码接口被拒时保留真实原因，保存按钮提示分享码暂不可用且不写相册', async () => {
    page.onLoad({ quote: '完整原文' });
    shareService.create.mockRejectedValue({ statusCode: 404, code: 404, message: '请求的资源不存在' });
    await expect(page.generatePoster()).rejects.toMatchObject({
      code: 'DAILY_CARD_CODE_UNAVAILABLE',
      message: expect.stringContaining('HTTP 404')
    });
    await expect(page.generatePoster()).rejects.toThrow('请求的资源不存在');

    await page.handleSave();
    expect(wx.showToast).toHaveBeenCalledWith({ title: '分享码暂不可用，请稍后再试', icon: 'none' });
    expect(wx.saveImageToPhotosAlbum).not.toHaveBeenCalled();
    expect(page.data.generating).toBe(false);
  });

  test('请求没发出去（断网、超时）时也能从错误里看出原因', async () => {
    page.onLoad({ quote: '完整原文' });
    shareService.create.mockRejectedValue({ errMsg: 'request:fail timeout' });
    await expect(page.generatePoster()).rejects.toThrow('request:fail timeout');
  });

  test('export draws the mini-program code and tolerates a missing image', async () => {
    page.onLoad({ quote: 'a' });
    const layout = page.buildLayout(true);
    const canvas = await page.getCanvasNode();
    const loadedImage = await page.loadMiniProgramCodeImage(canvas);
    expect(loadedImage).toBeTruthy();
    expect(global.__mockCanvasImageSrcs).toContain('/tmp/daily-card-code-abcd2345.png');
    const ctx = canvas.getContext('2d');
    global.__mockCanvasContext.drawImage.mockClear();
    page.drawLayout(ctx, layout, {
      '/assets/images/mini-program-code.jpg': loadedImage
    });
    expect(global.__mockCanvasContext.drawImage).toHaveBeenCalledWith(
      loadedImage,
      expect.any(Number),
      expect.any(Number),
      116,
      116
    );

    global.__mockCanvasContext.drawImage.mockClear();
    page.drawLayout(ctx, layout, {});
    expect(global.__mockCanvasContext.drawImage).not.toHaveBeenCalled();
  });
});
