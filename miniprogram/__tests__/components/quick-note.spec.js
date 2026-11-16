jest.mock('../../services/joy-note.service', () => ({ create: jest.fn() }));

describe('随喜速记条', () => {
  let config;
  let service;
  let store;
  let instance;

  const make = (properties = {}) => {
    const ctx = {
      ...config.methods,
      properties: { visible: false, periodId: '', sectionId: '', source: '', quote: '', ...properties },
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
    return ctx;
  };

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    global.Component = jest.fn(value => { config = value; });
    wx.__storage = {};
    wx.showToast = jest.fn();
    service = require('../../services/joy-note.service');
    service.create.mockReset();
    service.create.mockResolvedValue({});
    store = require('../../utils/joy-note-store');
    require('../../components/quick-note/quick-note');
    instance = make();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.Component;
  });

  const open = (props) => {
    instance = make({ ...props, visible: true });
    instance.onVisibleChange(true);
    jest.advanceTimersByTime(100);
    return instance;
  };

  test('打开后聚焦输入框；没有草稿也没有引用时是空的', () => {
    open();
    expect(instance.data.content).toBe('');
    expect(instance.data.focus).toBe(true);
    expect(instance.data.placeholder).not.toBe('');
  });

  test('带着长按的那一段打开：放进引用（最多 80 字），并写入草稿', () => {
    open({ quote: `  ${'长'.repeat(100)}  ` });
    expect(instance.data.content).toBe(`「${'长'.repeat(80)}」\n`);
    expect(store.readJoyDraft().content).toBe(`「${'长'.repeat(80)}」\n`);
  });

  test('已有草稿时接着写，不用引用覆盖', () => {
    store.write(store.KEYS.joyDraft, '写到一半的话');
    open({ quote: '课文里的一句' });
    expect(instance.data.content).toBe('写到一半的话');
  });

  test('输入自动存草稿；没保存就收起，草稿保留', () => {
    open();
    instance.onInput({ detail: { value: '听到的一句话' } });
    instance.close();
    expect(instance.events).toContainEqual(['close', undefined]);
    expect(store.readJoyDraft().content).toBe('听到的一句话');
    const next = make({ visible: true });
    next.onVisibleChange(true);
    expect(next.data.content).toBe('听到的一句话');
  });

  test('保存：带上今天这一课，记住上次关联，清草稿，提示可以再记一句', async () => {
    open({ periodId: 'p1', sectionId: 's1', source: '第 12 期 · 第 7 天 知彼解己' });
    instance.onInput({ detail: { value: '  阿梅说：理解不是同意  ' } });
    await instance.save();
    expect(service.create).toHaveBeenCalledWith({ content: '阿梅说：理解不是同意', periodId: 'p1', sectionId: 's1' });
    expect(instance.data.content).toBe('');
    expect(instance.data.toastVisible).toBe(true);
    expect(instance.events.map(item => item[0])).toEqual(['saved', 'close']);
    expect(store.readJoyDraft()).toEqual({ title: '', content: '', html: '' });
    expect(store.read(store.KEYS.lastSource)).toEqual({ periodId: 'p1', sectionId: 's1', label: '第 12 期 · 第 7 天 知彼解己', savedAt: expect.any(Number) });
    jest.advanceTimersByTime(3100);
    expect(instance.data.toastVisible).toBe(false);
  });

  test('点「再记一句」收起提示并通知页面重新打开', async () => {
    open();
    instance.onInput({ detail: { value: '一句' } });
    await instance.save();
    instance.again();
    expect(instance.data.toastVisible).toBe(false);
    expect(instance.events.map(item => item[0])).toContain('again');
  });

  test('取消关联后保存，不带期次和课程，也不记住上次关联', async () => {
    open({ periodId: 'p1', sectionId: 's1', source: '第 12 期' });
    instance.toggleAssociation();
    instance.onInput({ detail: { value: '不想关联' } });
    await instance.save();
    expect(service.create).toHaveBeenCalledWith({ content: '不想关联', periodId: null, sectionId: null });
    expect(store.read(store.KEYS.lastSource)).toBe(null);
  });

  test('保存失败：文字、草稿和关联都保留，可以重试', async () => {
    open({ periodId: 'p1', sectionId: 's1', source: '第 12 期' });
    instance.onInput({ detail: { value: '想保留的话' } });
    service.create.mockRejectedValue({ message: '只能关联已报名且有权限的期次' });
    await instance.save();
    expect(instance.data.content).toBe('想保留的话');
    expect(instance.data.assocOn).toBe(true);
    expect(instance.data.saving).toBe(false);
    expect(instance.data.toastVisible).toBe(false);
    expect(instance.events).toHaveLength(0);
    expect(store.readJoyDraft().content).toBe('想保留的话');
    expect(wx.showToast).toHaveBeenCalledWith({ title: '只能关联已报名且有权限的期次', icon: 'none' });
  });

  test('空白内容不能保存，保存中不重复提交', async () => {
    open();
    instance.onInput({ detail: { value: '   ' } });
    await instance.save();
    expect(service.create).not.toHaveBeenCalled();
    instance.onInput({ detail: { value: '有内容' } });
    let release;
    service.create.mockReturnValue(new Promise(resolve => { release = resolve; }));
    const first = instance.save();
    await instance.save();
    expect(service.create).toHaveBeenCalledTimes(1);
    release({});
    await first;
  });

  test('键盘弹起时记录高度，让半屏条贴着键盘；关闭时归零', () => {
    open();
    instance.onKeyboardHeight({ detail: { height: 300 } });
    expect(instance.data.keyboardHeight).toBe(300);
    instance.onVisibleChange(false);
    expect(instance.data.keyboardHeight).toBe(0);
    expect(instance.data.focus).toBe(false);
  });

  describe('标题与富文本', () => {
    test('标题选填：输入时和正文一起存草稿；保存时只在有标题时才带上', async () => {
      open({ periodId: 'p1', sectionId: 's1', source: '第 12 期' });
      instance.onTitleInput({ detail: { value: '  阿梅说的话  ' } });
      instance.onInput({ detail: { text: '理解不是同意', html: '' } });
      expect(store.readJoyDraft()).toEqual({ title: '  阿梅说的话  ', content: '理解不是同意', html: '' });
      await instance.save();
      expect(service.create).toHaveBeenCalledWith({ title: '阿梅说的话', content: '理解不是同意', periodId: 'p1', sectionId: 's1' });
      expect(instance.data.title).toBe('');
      expect(store.readJoyDraft()).toEqual({ title: '', content: '', html: '' });
    });

    test('点 Aa 设置了颜色：保存时带上 contentHtml；没有格式时不带', async () => {
      open();
      instance.onInput({ detail: { text: '重点在这', html: '<p><span style="color:#dc2626">重点</span>在这</p>' } });
      expect(store.readJoyDraft().html).toContain('color:#dc2626');
      await instance.save();
      expect(service.create).toHaveBeenLastCalledWith({
        content: '重点在这',
        contentHtml: '<p><span style="color:#dc2626">重点</span>在这</p>',
        periodId: null,
        sectionId: null
      });
      expect(instance.data.html).toBe('');
      service.create.mockClear();
      open();
      instance.onInput({ detail: { text: '普通', html: '' } });
      await instance.save();
      expect(service.create.mock.calls[0][0]).not.toHaveProperty('contentHtml');
    });

    test('再次打开时恢复标题、正文和格式；旧版草稿（纯文本字符串）也能恢复', () => {
      store.writeJoyDraft({ title: '没写完', content: '半截', html: '<p><strong>半截</strong></p>' });
      open();
      expect(instance.data).toMatchObject({ title: '没写完', content: '半截', html: '<p><strong>半截</strong></p>' });
      store.write(store.KEYS.joyDraft, '旧版本留下的草稿');
      open();
      expect(instance.data).toMatchObject({ title: '', content: '旧版本留下的草稿', html: '' });
    });

    test('只写了标题、没写正文时不能保存', async () => {
      open();
      instance.onTitleInput({ detail: { value: '只有标题' } });
      await instance.save();
      expect(service.create).not.toHaveBeenCalled();
      expect(wx.showToast).toHaveBeenCalledWith({ title: '先写下一句话吧', icon: 'none' });
    });

    test('键盘：打开时开始监听全局键盘高度，让半屏条贴着键盘；关闭时取消监听', () => {
      const listeners = [];
      wx.onKeyboardHeightChange = jest.fn(handler => listeners.push(handler));
      wx.offKeyboardHeightChange = jest.fn();
      open();
      expect(wx.onKeyboardHeightChange).toHaveBeenCalledTimes(1);
      listeners[0]({ height: 280 });
      expect(instance.data.keyboardHeight).toBe(280);
      instance.onVisibleChange(false);
      expect(wx.offKeyboardHeightChange).toHaveBeenCalledWith(listeners[0]);
      expect(instance.data.keyboardHeight).toBe(0);
      delete wx.onKeyboardHeightChange;
      delete wx.offKeyboardHeightChange;
    });
  });
});
