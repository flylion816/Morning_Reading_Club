jest.mock('../../services/joy-note.service', () => ({
  getOne: jest.fn(),
  addFollowUp: jest.fn(),
  update: jest.fn(),
  remove: jest.fn()
}));
jest.mock('../../utils/require-login', () => ({ requireLogin: jest.fn(() => true) }));

describe('觉察详情', () => {
  let config;
  let page;
  let service;

  const note = (extra = {}) => ({
    id: 'a1',
    kind: 'awareness',
    createdAt: new Date(2026, 10, 16, 7, 58).toISOString(),
    periodName: '连接之力',
    sectionTitle: '知彼解己',
    day: 5,
    awareness: {
      facts: '孩子磨蹭，我提高了声音。',
      feelings: ['着急', '委屈'],
      bodyAreas: ['胸口', '肩颈'],
      feelingNote: '有点累',
      asks: [
        { level: 1, question: '那一刻，我有没有先听懂对方？', answer: '没有' },
        { level: 2, question: '如果我是 TA，那一刻我在经历什么？', answer: '想画完那页' }
      ],
      choice: '明天提前十分钟叫他',
      followUps: [{ content: '这周有三天做到了', createdAt: new Date(2026, 10, 23).toISOString() }],
      revisit: { enabled: true, status: 'pending', dueAt: new Date(2026, 10, 23, 6).toISOString() }
    },
    ...extra
  });

  const mount = async (options = { id: 'a1' }) => {
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
    wx.showToast = jest.fn();
    wx.navigateTo = jest.fn();
    wx.navigateBack = jest.fn();
    wx.redirectTo = jest.fn();
    wx.showModal = jest.fn();
    wx.showActionSheet = jest.fn();
    wx.setClipboardData = jest.fn();
    global.getCurrentPages = jest.fn(() => []);
    service = require('../../services/joy-note.service');
    Object.values(service).forEach(mock => mock.mockReset());
    service.getOne.mockResolvedValue(note());
    require('../../utils/require-login').requireLogin.mockReturnValue(true);
    require('../../pages/joy-notes/detail/detail');
  });

  afterEach(() => {
    delete global.Page;
    delete global.getCurrentPages;
  });

  test('把看、感、问、择、后来排成一条线，来源带上期次和课程', async () => {
    await mount();
    expect(service.getOne).toHaveBeenCalledWith('a1');
    const view = page.data.view;
    expect(view.dateLabel).toBe('11月16日 清晨');
    expect(view.sourceLabel).toBe('连接之力 · 第 5 天 · 知彼解己');
    expect(view.feelings).toEqual(['着急', '委屈']);
    expect(view.bodyText).toBe('胸口、肩颈');
    expect(view.asks.map(ask => ask.label)).toEqual(['一叩', '再叩']);
    expect(view.asks[0]).toMatchObject({ question: '那一刻，我有没有先听懂对方？', answer: '没有' });
    expect(view.choice).toBe('明天提前十分钟叫他');
    expect(view.followUps).toEqual([{ content: '这周有三天做到了', dateLabel: '11月23日' }]);
    expect(view.revisitLine).toBe('11月23日 早上 6:00，来信问问你做得怎样');
  });

  test('回访说明：已送到时提示写后来；写过或跳过后不再提示', async () => {
    service.getOne.mockResolvedValue(note({ awareness: { ...note().awareness, revisit: { status: 'delivered' } } }));
    await mount();
    expect(page.data.view.revisitLine).toBe('回访来信已经送到，写一句后来吧');
    service.getOne.mockResolvedValue(note({ awareness: { ...note().awareness, revisit: { status: 'answered' } } }));
    await mount();
    expect(page.data.view.revisitLine).toBe('');
  });

  test('从来信的回访卡片进来（focus=1）：直接打开「后来」输入框', async () => {
    await mount({ id: 'a1', focus: '1' });
    expect(page.data.followUpOpen).toBe(true);
    await mount({ id: 'a1' });
    expect(page.data.followUpOpen).toBe(false);
  });

  test('写一句后来：更新时间线，让日记页重新读列表', async () => {
    const journal = { route: 'pages/joy-notes/joy-notes', _loadedAt: 99 };
    global.getCurrentPages = jest.fn(() => [journal, {}]);
    await mount();
    page.toggleFollowUp();
    page.onFollowUpInput({ detail: { value: '  他说：今天你没催我  ' } });
    const updated = note();
    updated.awareness.followUps.push({ content: '他说：今天你没催我', createdAt: new Date(2026, 10, 24).toISOString() });
    service.addFollowUp.mockResolvedValue(updated);
    await page.saveFollowUp();
    expect(service.addFollowUp).toHaveBeenCalledWith('a1', '他说：今天你没催我');
    expect(page.data.view.followUps).toHaveLength(2);
    expect(page.data.followUpText).toBe('');
    expect(page.data.followUpOpen).toBe(false);
    expect(journal._loadedAt).toBe(0);
  });

  test('后来不能为空；失败时保留输入', async () => {
    await mount();
    page.onFollowUpInput({ detail: { value: '   ' } });
    await page.saveFollowUp();
    expect(service.addFollowUp).not.toHaveBeenCalled();
    expect(wx.showToast).toHaveBeenCalledWith({ title: '先写一句，再记下', icon: 'none' });
    page.onFollowUpInput({ detail: { value: '想保留的话' } });
    service.addFollowUp.mockRejectedValue({ message: '「后来」已经写满了' });
    await page.saveFollowUp();
    expect(page.data.followUpText).toBe('想保留的话');
    expect(page.data.saving).toBe(false);
    expect(wx.showToast).toHaveBeenLastCalledWith({ title: '「后来」已经写满了', icon: 'none' });
  });

  test('记录已经不在了：显示说明，可以回到日记；其他错误可以重试', async () => {
    service.getOne.mockRejectedValue({ code: 404, message: '记录不存在' });
    await mount();
    expect(page.data.gone).toBe(true);
    service.getOne.mockRejectedValue(new Error('offline'));
    await mount();
    expect(page.data.error).toBe(true);
    service.getOne.mockResolvedValue(note());
    await page.load();
    expect(page.data.error).toBe(false);
    expect(page.data.view).not.toBe(null);
  });

  test('随喜记录或没有 id 时不显示觉察详情', async () => {
    service.getOne.mockResolvedValue({ id: 'j1', kind: 'joy', content: '随喜' });
    await mount();
    expect(page.data.gone).toBe(true);
    await mount({});
    expect(page.data.gone).toBe(true);
  });

  test('菜单：复制全文（含后来）、做成日签、删除', async () => {
    await mount();
    page.openMenu();
    const options = wx.showActionSheet.mock.calls[0][0];
    expect(options.itemList.map(item => item.label || item)).toEqual(['起个标题', '分享', '复制全文', '做成日签', '删除']);
    options.success({ tapIndex: 2 });
    expect(wx.setClipboardData.mock.calls[0][0].data).toBe(
      ['看：孩子磨蹭，我提高了声音。', '感：着急、委屈。有点累', '身：胸口、肩颈', '问：没有', '问：想画完那页', '择：明天提前十分钟叫他', '后来：这周有三天做到了'].join('\n')
    );
    options.success({ tapIndex: 3 });
    expect(wx.navigateTo).toHaveBeenCalledWith({ url: `/pages/daily-card/daily-card?quote=${encodeURIComponent('明天提前十分钟叫他')}` });
  });

  test('删除：确认后删除并回到日记页，回访还没送出时会提醒也会取消', async () => {
    const journal = { route: 'pages/joy-notes/joy-notes', _loadedAt: 5 };
    global.getCurrentPages = jest.fn(() => [journal, {}]);
    await mount();
    service.remove.mockResolvedValue({});
    page.confirmDelete();
    const dialog = wx.showModal.mock.calls[0][0];
    expect(dialog.title).toBe('删掉这条觉察？');
    expect(dialog.content).toContain('回访来信也不会再送');
    dialog.success({ confirm: false });
    expect(service.remove).not.toHaveBeenCalled();
    dialog.success({ confirm: true });
    await new Promise(resolve => setImmediate(resolve));
    expect(service.remove).toHaveBeenCalledWith('a1');
    expect(journal._loadedAt).toBe(0);
    expect(wx.navigateBack).toHaveBeenCalled();
  });

  describe('标题与富文本', () => {
    test('有标题时显示标题；带格式的「看」「问」「择」交给 rich-text，没有格式的仍是纯文本', async () => {
      service.getOne.mockResolvedValue(note({
        title: '孩子磨蹭的早晨',
        awareness: {
          ...note().awareness,
          factsHtml: '<p>孩子磨蹭，<span style="color:#dc2626">我提高了声音</span></p>',
          asks: [
            { level: 1, question: '问一', answer: '答一', answerHtml: '<p><strong>答一</strong></p>' },
            { level: 2, question: '问二', answer: '答二', answerHtml: '' }
          ],
          choiceHtml: '<p><u>明天提前十分钟叫他</u></p>'
        }
      }));
      await mount();
      const view = page.data.view;
      expect(view.title).toBe('孩子磨蹭的早晨');
      expect(view.factsNodes).toContain('color:#dc2626');
      expect(view.asks[0].answerNodes).toContain('<strong>答一</strong>');
      expect(view.asks[1].answerNodes).toBe('');
      expect(view.choiceNodes).toContain('<u>');
      expect(page.data.view.facts).toBe('孩子磨蹭，我提高了声音。');
    });

    test('没有标题、没有格式时，和以前一样', async () => {
      await mount();
      expect(page.data.view.title).toBe('');
      expect(page.data.view.factsNodes).toBe('');
      expect(page.data.view.choiceNodes).toBe('');
    });

    test('改标题：菜单里点「起个标题」，保存后更新页面并让日记页重新读列表', async () => {
      const journal = { route: 'pages/joy-notes/joy-notes', _loadedAt: 8 };
      global.getCurrentPages = jest.fn(() => [journal, {}]);
      await mount();
      page.openMenu();
      wx.showActionSheet.mock.calls[0][0].success({ tapIndex: 0 });
      expect(page.data.titleEditing).toBe(true);
      expect(page.data.titleDraft).toBe('');
      page.onTitleInput({ detail: { value: '  新的名字 ' } });
      service.update.mockResolvedValue({ id: 'a1', title: '新的名字' });
      await page.saveTitle();
      expect(service.update).toHaveBeenCalledWith('a1', { title: '新的名字' });
      expect(page.data.titleEditing).toBe(false);
      expect(page.data.view.title).toBe('新的名字');
      // 来源（期次、课程）沿用页面上已有的
      expect(page.data.view.sourceLabel).toBe('连接之力 · 第 5 天 · 知彼解己');
      expect(journal._loadedAt).toBe(0);
    });

    test('有标题时菜单显示「改标题」；清空标题也能保存', async () => {
      service.getOne.mockResolvedValue(note({ title: '旧名字' }));
      await mount();
      page.openMenu();
      expect(wx.showActionSheet.mock.calls[0][0].itemList[0]).toBe('改标题');
      page.startRename();
      expect(page.data.titleDraft).toBe('旧名字');
      page.onTitleInput({ detail: { value: '   ' } });
      service.update.mockResolvedValue({ id: 'a1', title: '' });
      await page.saveTitle();
      expect(service.update).toHaveBeenCalledWith('a1', { title: '' });
      expect(page.data.view.title).toBe('');
    });

    test('改标题失败：留在编辑状态，提示再试；取消就收起', async () => {
      await mount();
      page.startRename();
      page.onTitleInput({ detail: { value: '想改' } });
      service.update.mockRejectedValue({ message: '标题最多 40 字' });
      await page.saveTitle();
      expect(page.data.titleEditing).toBe(true);
      expect(page.data.saving).toBe(false);
      expect(wx.showToast).toHaveBeenCalledWith({ title: '标题最多 40 字', icon: 'none' });
      page.cancelRename();
      expect(page.data.titleEditing).toBe(false);
    });

    test('复制全文：标题放在第一行', async () => {
      service.getOne.mockResolvedValue(note({ title: '一页标题' }));
      await mount();
      page.copyAll();
      expect(wx.setClipboardData.mock.calls[0][0].data.split('\n')[0]).toBe('一页标题');
    });
  });

  describe('分享', () => {
    test('顶部的「分享」和菜单里的「分享」都打开分享面板，带上标题、来源和后来', async () => {
      global.getApp = jest.fn(() => ({ globalData: { userInfo: { nickname: '狮子' } } }));
      service.getOne.mockResolvedValue(note({ title: '孩子磨蹭的早晨' }));
      await mount();
      const panel = { open: jest.fn(), getShareConfig: jest.fn(() => null) };
      page.selectComponent = jest.fn(() => panel);
      page.shareNote();
      expect(panel.open).toHaveBeenCalledWith(expect.objectContaining({
        id: 'a1', kind: 'awareness', title: '孩子磨蹭的早晨', authorName: '狮子', sourceLabel: '连接之力 · 第 5 天 · 知彼解己'
      }));
      expect(panel.open.mock.calls[0][0].awareness.followUps).toHaveLength(1);
      page.openMenu();
      const { itemList, success } = wx.showActionSheet.mock.calls[0][0];
      success({ tapIndex: itemList.findIndex(item => (item.label || item) === '分享') });
      expect(panel.open).toHaveBeenCalledTimes(2);
      const wxml = require('fs').readFileSync(require('path').join(__dirname, '../../pages/joy-notes/detail/detail.wxml'), 'utf8');
      expect(wxml).toContain('bindtap="shareNote"');
      expect(wxml).toContain('<joy-share id="joy-share"');
      delete global.getApp;
    });

    test('还没加载出内容时不打开面板；转发只取面板里的分享信息，取不到就是首页', async () => {
      await mount();
      const panel = { open: jest.fn(), getShareConfig: jest.fn(() => ({ title: 't', path: '/pages/joy-notes/shared/shared?code=abcd2345' })) };
      page.selectComponent = jest.fn(() => panel);
      expect(page.onShareAppMessage().path).toContain('abcd2345');
      panel.getShareConfig.mockReturnValue(null);
      expect(page.onShareAppMessage().path).toBe('/pages/index/index');
      page.data.view = null;
      page.shareNote();
      expect(panel.open).not.toHaveBeenCalled();
    });

    test('进来就隐藏右上角的转发菜单', async () => {
      wx.hideShareMenu = jest.fn();
      await mount();
      expect(wx.hideShareMenu).toHaveBeenCalledWith({ menus: ['shareAppMessage', 'shareTimeline'] });
    });
  });
});
