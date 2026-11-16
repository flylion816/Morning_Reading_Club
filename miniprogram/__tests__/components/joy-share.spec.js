jest.mock('../../pages/joy-notes/share.service', () => ({
  open: jest.fn(),
  revoke: jest.fn(),
  qrcode: jest.fn(),
  status: jest.fn(),
  read: jest.fn()
}));
jest.mock('../../pages/joy-notes/share-poster', () => ({
  buildPosterModel: jest.fn(() => ({ kind: 'joy', sections: [] })),
  renderPoster: jest.fn(() => ({ width: 900, height: 1200, scale: 2, truncated: false }))
}));

describe('随喜 / 觉察分享面板', () => {
  let config;
  let service;
  let poster;
  let instance;
  let canvas;
  let images;

  const payload = (extra = {}) => ({
    id: 'n1', kind: 'joy', title: '', authorName: '狮子', dateLabel: '11月16日 清晨', sourceLabel: '', periodLinked: true, content: '一句话', contentHtml: '', awareness: null, ...extra
  });

  const make = () => {
    const component = {
      ...config.methods,
      data: JSON.parse(JSON.stringify(config.data)),
      events: [],
      setData(update, callback) {
        this.data = { ...this.data, ...update };
        if (callback) callback();
      },
      triggerEvent(name, detail) {
        this.events.push([name, detail]);
      }
    };
    return component;
  };

  const flush = () => new Promise(resolve => setImmediate(resolve));

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    global.Component = jest.fn(value => { config = value; });
    wx.showToast = jest.fn();
    wx.showModal = jest.fn();
    wx.previewImage = jest.fn();
    wx.saveImageToPhotosAlbum = jest.fn();
    wx.showShareImageMenu = jest.fn();
    wx.env = { USER_DATA_PATH: '/tmp/user' };
    wx.getWindowInfo = jest.fn(() => ({ pixelRatio: 3 }));
    wx.getFileSystemManager = jest.fn(() => ({ writeFile: jest.fn(options => options.success()) }));
    wx.canvasToTempFilePath = jest.fn(options => options.success({ tempFilePath: '/tmp/poster.png' }));
    images = [];
    canvas = {
      createImage() {
        const image = {
          set src(value) {
            image._src = value;
            images.push(value);
            setImmediate(() => (image.failFor && image.failFor(value) ? image.onerror() : image.onload()));
          }
        };
        return image;
      }
    };
    wx.createSelectorQuery = jest.fn(() => ({
      in() { return this; },
      select() { return this; },
      fields() { return this; },
      exec(callback) { callback([{ node: canvas }]); }
    }));
    service = require('../../pages/joy-notes/share.service');
    Object.values(service).forEach(mock => mock.mockReset());
    service.open.mockResolvedValue({ code: 'abcd2345', audience: 'period', created: true, periodLinked: true });
    service.revoke.mockResolvedValue({ active: false });
    service.qrcode.mockResolvedValue({ imageBase64: 'AAAA', contentType: 'image/png' });
    poster = require('../../pages/joy-notes/share-poster');
    poster.buildPosterModel.mockClear();
    poster.renderPoster.mockClear();
    require('../../pages/joy-notes/components/joy-share/joy-share');
    instance = make();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.Component;
  });

  describe('打开面板', () => {
    test('开启（或取回）这条记录的分享，面板显示分享方式和谁能看', async () => {
      await instance.open(payload());
      expect(service.open).toHaveBeenCalledWith('n1');
      expect(instance.data).toMatchObject({ visible: true, phase: 'menu', loading: false, audience: 'period' });
      expect(instance.data.share.code).toBe('abcd2345');
    });

    test('这条记录早就在分享中：可以直接「停止分享」；刚新开的在用过之前不显示', async () => {
      await instance.open(payload());
      expect(instance.data.canStop).toBe(false);
      service.open.mockResolvedValue({ code: 'abcd2345', audience: 'login', created: false, periodLinked: true });
      await instance.open(payload());
      expect(instance.data.canStop).toBe(true);
    });

    test('开启失败：面板收起，提示稍后再试', async () => {
      service.open.mockRejectedValue({ message: '记录不存在' });
      await instance.open(payload());
      expect(instance.data.visible).toBe(false);
      expect(wx.showToast).toHaveBeenCalledWith({ title: '记录不存在', icon: 'none' });
    });

    test('没有记录 ID 时什么都不做', async () => {
      await instance.open({});
      expect(service.open).not.toHaveBeenCalled();
      expect(instance.data.visible).toBe(false);
    });
  });

  describe('谁能看', () => {
    test('关联了期次可以改成「所有登录的书友」，换范围不会把「新开启」的状态弄丢', async () => {
      await instance.open(payload());
      service.open.mockResolvedValue({ code: 'abcd2345', audience: 'login', created: false, periodLinked: true });
      await instance.chooseAudience({ currentTarget: { dataset: { value: 'login' } } });
      expect(service.open).toHaveBeenLastCalledWith('n1', 'login');
      expect(instance.data.audience).toBe('login');
      expect(instance._share.created).toBe(true);
    });

    test('点已选的范围不重复请求；失败时提示', async () => {
      await instance.open(payload());
      service.open.mockClear();
      await instance.chooseAudience({ currentTarget: { dataset: { value: 'period' } } });
      expect(service.open).not.toHaveBeenCalled();
      service.open.mockRejectedValue({ message: '分享范围不正确' });
      await instance.chooseAudience({ currentTarget: { dataset: { value: 'login' } } });
      expect(wx.showToast).toHaveBeenCalledWith({ title: '分享范围不正确', icon: 'none' });
      expect(instance.data.audience).toBe('period');
    });
  });

  describe('发给微信好友', () => {
    test('转发卡片：标题带昵称和这一页的标题，路径直达分享页', async () => {
      await instance.open(payload({ title: '孩子磨蹭的早晨', kind: 'awareness' }));
      const config1 = instance.getShareConfig();
      expect(config1.title).toBe('狮子 的一次觉察：孩子磨蹭的早晨');
      expect(config1.path).toBe('/pages/joy-notes/shared/shared?code=abcd2345');
      expect(config1.imageUrl).toBe('/assets/images/awareness-share-cover.png');
      await instance.open(payload());
      expect(instance.getShareConfig().title).toBe('狮子 的一句随喜');
      expect(instance.getShareConfig().imageUrl).not.toBe('/assets/images/awareness-share-cover.png');
    });

    test('标题最多 40 个字；没有开启分享时没有转发信息', async () => {
      expect(instance.getShareConfig()).toBe(null);
      await instance.open(payload({ title: '长'.repeat(60) }));
      expect(Array.from(instance.getShareConfig().title).length).toBe(40);
    });

    test('点「发给微信好友」：记为已使用，稍后收起面板，不会撤销分享', async () => {
      await instance.open(payload());
      instance.onForwardTap();
      expect(instance._used).toBe(true);
      jest.advanceTimersByTime(400);
      expect(instance.data.visible).toBe(false);
      expect(service.revoke).not.toHaveBeenCalled();
      // 关闭之后微信才来取转发信息，仍然取得到
      expect(instance.getShareConfig().path).toContain('abcd2345');
    });
  });

  describe('关闭面板', () => {
    test('这次新开启、却没有转发也没有生成长图：自动撤销', async () => {
      await instance.open(payload());
      instance.close();
      expect(service.revoke).toHaveBeenCalledWith('n1');
      expect(instance.data.visible).toBe(false);
      expect(instance.getShareConfig()).toBe(null);
    });

    test('早就在分享中：关面板不撤销', async () => {
      service.open.mockResolvedValue({ code: 'abcd2345', audience: 'period', created: false, periodLinked: true });
      await instance.open(payload());
      instance.close();
      expect(service.revoke).not.toHaveBeenCalled();
    });

    test('取过转发信息或生成过长图之后关面板：不撤销', async () => {
      await instance.open(payload());
      instance.getShareConfig();
      instance.close();
      expect(service.revoke).not.toHaveBeenCalled();
      await instance.open(payload());
      await instance.generatePoster();
      instance.close();
      expect(service.revoke).not.toHaveBeenCalled();
    });

    test('撤销失败也不报错、不影响关闭', async () => {
      service.revoke.mockRejectedValue(new Error('offline'));
      await instance.open(payload());
      expect(() => instance.close()).not.toThrow();
      await flush();
    });
  });

  describe('长图', () => {
    test('生成：用专属小程序码，画完导出，进入预览；清晰度跟屏幕但最多 2 倍', async () => {
      await instance.open(payload());
      await instance.generatePoster();
      expect(service.qrcode).toHaveBeenCalledWith('abcd2345');
      expect(images[0]).toBe('/tmp/user/joy-share-qr.png');
      const args = poster.renderPoster.mock.calls[0][0];
      expect(args).toMatchObject({ qrPrecise: true, dpr: 2 });
      expect(args.qrImage).toBeTruthy();
      expect(wx.canvasToTempFilePath).toHaveBeenCalledWith(expect.objectContaining({ width: 900, height: 1200, destWidth: 1800, destHeight: 2400, fileType: 'png' }));
      expect(instance.data).toMatchObject({ phase: 'poster', generating: false, posterPath: '/tmp/poster.png', posterError: '' });
    });

    test('专属小程序码生成失败：退回通用小程序码，长图照常生成', async () => {
      service.qrcode.mockRejectedValue({ message: '小程序码暂时生成不了' });
      await instance.open(payload());
      await instance.generatePoster();
      expect(poster.renderPoster.mock.calls[0][0]).toMatchObject({ qrPrecise: false });
      expect(images.some(src => src.includes('mini-program-code'))).toBe(true);
      expect(instance.data.posterPath).toBe('/tmp/poster.png');
    });

    test('专属小程序码超过 6 秒也退回通用码', async () => {
      service.qrcode.mockReturnValue(new Promise(() => {}));
      await instance.open(payload());
      const pending = instance.generatePoster();
      await flush();
      jest.advanceTimersByTime(6100);
      await pending;
      expect(poster.renderPoster.mock.calls[0][0].qrPrecise).toBe(false);
    });

    test('通用码也加载不出来：不带小程序码也能生成', async () => {
      service.qrcode.mockRejectedValue(new Error('x'));
      await instance.open(payload());
      const original = canvas.createImage;
      canvas.createImage = () => {
        const image = original();
        image.failFor = () => true;
        return image;
      };
      await instance.generatePoster();
      expect(poster.renderPoster.mock.calls[0][0].qrImage).toBe(null);
      expect(instance.data.posterPath).toBe('/tmp/poster.png');
    });

    test('画不出来或导出失败：提示再试一次，可以重试', async () => {
      await instance.open(payload());
      poster.renderPoster.mockImplementationOnce(() => { throw new Error('canvas error'); });
      await instance.generatePoster();
      expect(instance.data.posterError).toBe('长图没生成出来，再试一次');
      expect(instance.data.generating).toBe(false);
      await instance.generatePoster();
      expect(instance.data.posterPath).toBe('/tmp/poster.png');
      expect(instance.data.posterError).toBe('');
    });

    test('生成中不重复生成；返回菜单后可以再看', async () => {
      await instance.open(payload());
      instance.setData({ generating: true });
      await instance.generatePoster();
      expect(poster.renderPoster).not.toHaveBeenCalled();
      instance.setData({ generating: false });
      await instance.generatePoster();
      instance.backToMenu();
      expect(instance.data.phase).toBe('menu');
    });

    test('长内容被截断时提示扫码查看完整的', async () => {
      poster.renderPoster.mockReturnValueOnce({ width: 900, height: 7000, scale: 1.2, truncated: true });
      await instance.open(payload());
      await instance.generatePoster();
      expect(instance.data.truncated).toBe(true);
    });

    test('保存到相册、预览、发给好友', async () => {
      await instance.open(payload());
      await instance.generatePoster();
      wx.saveImageToPhotosAlbum.mockImplementation(options => options.success());
      instance.savePoster();
      expect(wx.saveImageToPhotosAlbum).toHaveBeenCalledWith(expect.objectContaining({ filePath: '/tmp/poster.png' }));
      expect(wx.showToast).toHaveBeenCalledWith({ title: '已保存', icon: 'success' });
      wx.saveImageToPhotosAlbum.mockImplementation(options => options.fail());
      instance.savePoster();
      expect(wx.showToast).toHaveBeenLastCalledWith({ title: '没保存上，请允许保存到相册后再试', icon: 'none' });
      instance.previewPoster();
      expect(wx.previewImage).toHaveBeenCalledWith({ urls: ['/tmp/poster.png'], current: '/tmp/poster.png' });
      instance.sharePosterToFriend();
      expect(wx.showShareImageMenu).toHaveBeenCalledWith(expect.objectContaining({ path: '/tmp/poster.png' }));
      const menu = wx.showShareImageMenu;
      delete wx.showShareImageMenu;
      instance.sharePosterToFriend();
      expect(wx.previewImage).toHaveBeenCalledTimes(2);
      wx.showShareImageMenu = menu;
    });

    test('还没生成长图时，保存、预览、发给好友都没有反应', () => {
      instance.savePoster();
      instance.previewPoster();
      instance.sharePosterToFriend();
      expect(wx.saveImageToPhotosAlbum).not.toHaveBeenCalled();
      expect(wx.previewImage).not.toHaveBeenCalled();
    });
  });

  describe('停止分享', () => {
    test('确认之后停止：旧链接失效，面板收起，通知页面', async () => {
      service.open.mockResolvedValue({ code: 'abcd2345', audience: 'period', created: false, periodLinked: true });
      await instance.open(payload());
      // 组件自带的 app-dialog：点取消不停止，点确认才停止
      const answers = [{ confirm: false }, { confirm: true }];
      const open = jest.fn(() => Promise.resolve(answers.shift()));
      instance.selectComponent = jest.fn(() => ({ open }));
      instance.confirmStop();
      await flush();
      expect(open).toHaveBeenCalledWith(expect.objectContaining({ title: '停止分享这一页？', confirmText: '停止分享', danger: true }));
      expect(service.revoke).not.toHaveBeenCalled();
      instance.confirmStop();
      await flush();
      expect(service.revoke).toHaveBeenCalledWith('n1');
      expect(instance.data.visible).toBe(false);
      expect(instance.events).toContainEqual(['revoked', { id: 'n1' }]);
      expect(instance.getShareConfig()).toBe(null);
    });

    test('取不到组件自带的弹窗时，退回系统确认框', async () => {
      service.open.mockResolvedValue({ code: 'abcd2345', audience: 'period', created: false, periodLinked: true });
      await instance.open(payload());
      instance.selectComponent = jest.fn(() => null);
      instance.confirmStop();
      const dialog = wx.showModal.mock.calls[0][0];
      expect(dialog.title).toBe('停止分享这一页？');
      dialog.success({ confirm: true });
      await flush();
      expect(service.revoke).toHaveBeenCalledWith('n1');
    });

    test('停止失败：面板留着，提示再试', async () => {
      service.open.mockResolvedValue({ code: 'abcd2345', audience: 'period', created: false, periodLinked: true });
      await instance.open(payload());
      service.revoke.mockRejectedValue({ message: '没停掉' });
      await instance.stopSharing();
      expect(instance.data.visible).toBe(true);
      expect(wx.showToast).toHaveBeenCalledWith({ title: '没停掉', icon: 'none' });
    });
  });
});
