let pageConfig;
let page;

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
    wx.showLoading = jest.fn();
    wx.hideLoading = jest.fn();
    wx.showToast = jest.fn();
    wx.showModal = jest.fn();
    wx.openSetting = jest.fn();
    wx.saveImageToPhotosAlbum = jest.fn();
  });

  afterEach(() => {
    delete global.Page;
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

  test('share falls back to default image when generation fails', async () => {
    page.onLoad({ quote: 'a' });
    page.generatePoster = jest.fn(() => Promise.reject(new Error('x')));
    const res = page.onShareAppMessage();
    const resolved = await res.promise;
    expect(resolved.imageUrl).toBe(res.imageUrl);
    page.generatePoster = jest.fn(() => Promise.resolve('/tmp/a.png'));
    const ok = await page.onShareAppMessage().promise;
    expect(ok.imageUrl).toBe('/tmp/a.png');
  });

  test('export draws the mini-program code and tolerates a missing image', async () => {
    page.onLoad({ quote: 'a' });
    const layout = page.buildLayout(true);
    const canvas = await page.getCanvasNode();
    const loadedImage = await page.loadMiniProgramCodeImage(canvas);
    expect(loadedImage).toBeTruthy();
    expect(global.__mockCanvasImageSrcs).toContain('/assets/images/mini-program-code.jpg');
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
