jest.mock('../../services/joy-note.service', () => ({
  getPeriods: jest.fn(),
  getSections: jest.fn(),
  getMine: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn()
}));
jest.mock('../../services/checkin.service', () => ({ getUserCheckinsWithStats: jest.fn() }));
jest.mock('../../utils/require-login', () => ({ requireLogin: jest.fn(() => true) }));

describe('随喜记页面', () => {
  let page;
  let service;

  beforeEach(() => {
    jest.resetModules();
    let config;
    global.Page = jest.fn(value => { config = value; });
    service = require('../../services/joy-note.service');
    Object.values(service).forEach(mock => mock.mockReset());
    service.getPeriods.mockResolvedValue({ list: [{ id: 'p1', name: '连接之力' }] });
    service.getSections.mockResolvedValue({ list: [{ id: 's1', day: 1, title: '品德成功论' }] });
    service.getMine.mockResolvedValue({ list: [], total: 0 });
    service.create.mockResolvedValue({});
    service.update.mockResolvedValue({});
    service.remove.mockResolvedValue({});
    wx.showToast = jest.fn();
    wx.showModal = jest.fn();
    wx.pageScrollTo = jest.fn();
    require('../../pages/joy-notes/joy-notes');
    page = {
      ...config,
      data: JSON.parse(JSON.stringify(config.data)),
      setData(update, callback) {
        this.data = { ...this.data, ...update };
        if (callback) callback();
      }
    };
  });

  test('直接保存无关联的文字，之后刷新列表', async () => {
    page.onContentInput({ detail: { value: '  听到的一句话  ' } });
    await page.save();
    expect(service.create).toHaveBeenCalledWith({ content: '听到的一句话', periodId: null, sectionId: null });
    expect(page.data.content).toBe('');
    expect(service.getMine).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  test('空白内容不能保存；失败时保留文字和关联', async () => {
    page.data.content = '  ';
    await page.save();
    expect(service.create).not.toHaveBeenCalled();
    page.setData({ content: '想保留的文字', draftPeriodId: 'p1', draftSectionId: 's1' });
    service.create.mockRejectedValue({ message: '只能关联已报名且有权限的期次' });
    await page.save();
    expect(page.data.content).toBe('想保留的文字');
    expect(page.data.draftPeriodId).toBe('p1');
    expect(page.data.saving).toBe(false);
    expect(wx.showToast).toHaveBeenCalledWith({ title: '只能关联已报名且有权限的期次', icon: 'none' });
  });

  test('重复点击保存只提交一次', async () => {
    let resolve;
    service.create.mockImplementation(() => new Promise(r => { resolve = r; }));
    page.data.content = '一句话';
    const first = page.save();
    await page.save();
    expect(service.create).toHaveBeenCalledTimes(1);
    resolve({});
    await first;
  });

  test('关联面板只展示服务端返回的期次并加载所选期次的课程', async () => {
    await page.openAssociation();
    expect(page.data.sheetPeriodOptions.map(item => item.name)).toEqual(['暂不关联期次', '连接之力']);
    page.onSheetPeriodChange({ detail: { value: '1' } });
    await Promise.resolve();
    await Promise.resolve();
    expect(service.getSections).toHaveBeenCalledWith('p1');
    expect(page.data.sheetSections).toEqual([{ id: 's1', label: '第 1 天 · 品德成功论' }]);
    page.selectSection({ currentTarget: { dataset: { id: 's1' } } });
    page.finishAssociation();
    expect(page.data.draftPeriodId).toBe('p1');
    expect(page.data.draftSectionId).toBe('s1');
    expect(page.data.draftSource).toBe('连接之力 · 第 1 天 · 品德成功论');
    expect(page.data.sheetOpen).toBe(false);
  });

  test('切换期次时丢弃上一期较晚返回的课程', async () => {
    let resolveFirst;
    service.getPeriods.mockResolvedValue({ list: [{ id: 'p1', name: '一期' }, { id: 'p2', name: '二期' }] });
    service.getSections.mockImplementationOnce(() => new Promise(r => { resolveFirst = r; }));
    service.getSections.mockResolvedValueOnce({ list: [{ id: 's2', day: 2, title: '二期课程' }] });
    await page.openAssociation();
    page.onSheetPeriodChange({ detail: { value: '1' } });
    page.onSheetPeriodChange({ detail: { value: '2' } });
    await Promise.resolve();
    resolveFirst({ list: [{ id: 's1', day: 1, title: '一期课程' }] });
    await Promise.resolve();
    await Promise.resolve();
    expect(page.data.sheetPeriodId).toBe('p2');
    expect(page.data.sheetSections.map(item => item.id)).toEqual(['s2']);
  });

  test('课程加载失败不能悄悄清除原有选择', async () => {
    await page.openAssociation();
    service.getSections.mockRejectedValue(new Error('offline'));
    page.onSheetPeriodChange({ detail: { value: '1' } });
    await Promise.resolve();
    await Promise.resolve();
    expect(page.data.sheetError).toBe(true);
    page.finishAssociation();
    expect(page.data.sheetOpen).toBe(true);
  });

  test('列表渲染来源、筛选和失效关联提示', async () => {
    service.getMine.mockResolvedValue({
      list: [
        { id: 'n1', content: '第一条', periodId: 'p1', sectionId: 's1', periodName: '连接之力', day: 1, sectionTitle: '品德成功论' },
        { id: 'n2', content: '第二条', periodId: 'p2', sourceUnavailable: true }
      ],
      total: 2
    });
    await page.loadPeriods();
    await page.loadList(true);
    expect(page.data.list[0].sourceLabel).toBe('连接之力 · 第 1 天 · 品德成功论');
    expect(page.data.list[1].sourceLabel).toBe('关联的期次当前不可用');
    page.onFilterChange({ detail: { value: '1' } });
    await Promise.resolve();
    expect(service.getMine).toHaveBeenLastCalledWith({ page: 1, limit: 20, periodId: 'p1' });
  });

  test('编辑本人记录时保留原有关联；删除须确认', async () => {
    page.data.list = [{
      _id: 'n1', content: '原文', periodId: 'p1', sectionId: 's1', sourceLabel: '一期 · 第一课'
    }];
    page.startEdit({ currentTarget: { dataset: { id: 'n1' } } });
    page.onContentInput({ detail: { value: '新文字' } });
    await page.save();
    // 修改时标题一定会带上（清空标题也要告诉服务端）
    expect(service.update).toHaveBeenCalledWith('n1', { content: '新文字', periodId: 'p1', sectionId: 's1', title: '' });
    page.confirmDelete({ currentTarget: { dataset: { id: 'n1' } } });
    expect(service.remove).not.toHaveBeenCalled();
    wx.showModal.mock.calls[0][0].success({ confirm: true });
    await Promise.resolve();
    expect(service.remove).toHaveBeenCalledWith('n1');
  });

  test('列表加载失败后允许重试且不会清空正在写的内容', async () => {
    page.data.content = '先写下来的文字';
    service.getMine.mockRejectedValueOnce(new Error('offline'));
    await page.loadList(true);
    expect(page.data.listError).toBe(true);
    expect(page.data.content).toBe('先写下来的文字');
    await page.loadList(true);
    expect(page.data.listError).toBe(false);
    expect(page.data.content).toBe('先写下来的文字');
  });

  test('切换期次后加载失败，不显示上一期的记录', async () => {
    page.data.list = [{ _id: 'old', content: '上一期的记录' }];
    page.data.filterOptions = [{ id: '', name: '全部期次' }, { id: 'p1', name: '一期' }];
    service.getMine.mockRejectedValueOnce(new Error('offline'));
    page.onFilterChange({ detail: { value: '1' } });
    await Promise.resolve();
    await Promise.resolve();
    expect(page.data.list).toEqual([]);
    expect(page.data.listError).toBe(true);
  });

  test('切换账号时清除上一个人的记录和未提交内容', async () => {
    const { tenantStorage } = require('../../utils/storage');
    const { STORAGE_KEYS } = require('../../config/constants');
    tenantStorage.set(STORAGE_KEYS.USER_INFO, { _id: 'user-a' });
    page.onShow();
    await Promise.resolve();
    await Promise.resolve();
    page.setData({ list: [{ _id: 'private', content: '前一位用户的记录' }], content: '前一位用户的草稿' });
    tenantStorage.set(STORAGE_KEYS.USER_INFO, { _id: 'user-b' });
    service.getMine.mockImplementationOnce(() => new Promise(() => {}));
    page.onShow();
    expect(page.data.list).toEqual([]);
    expect(page.data.content).toBe('');
  });

  describe('体验优化', () => {
    const note = (overrides = {}) => ({ _id: 'n1', id: 'n1', content: '短短一句', createdAt: new Date().toISOString(), ...overrides });

    test('长内容默认折叠，点展开/收起切换；短内容不折叠', async () => {
      service.getMine.mockResolvedValue({ list: [note(), note({ _id: 'n2', content: '很'.repeat(120) }), note({ _id: 'n3', content: '1\n2\n3\n4\n5' })], total: 3 });
      await page.loadList(true);
      expect(page.data.list.map(i => i.foldable)).toEqual([false, true, true]);
      expect(page.data.list.every(i => i.expanded === false)).toBe(true);
      page.toggleExpand({ currentTarget: { dataset: { id: 'n2' } } });
      expect(page.data.list[1].expanded).toBe(true);
      page.toggleExpand({ currentTarget: { dataset: { id: 'n2' } } });
      expect(page.data.list[1].expanded).toBe(false);
    });

    test('复制一条记录的内容', async () => {
      wx.setClipboardData = jest.fn();
      service.getMine.mockResolvedValue({ list: [note()], total: 1 });
      await page.loadList(true);
      page.copyNote({ currentTarget: { dataset: { id: 'n1' } } });
      expect(wx.setClipboardData).toHaveBeenCalledWith({ data: '短短一句' });
    });

    test('字数接近上限才提示剩余字数', () => {
      page.onContentInput({ detail: { value: '好' } });
      expect(page.data.showCounter).toBe(false);
      page.onContentInput({ detail: { value: '字'.repeat(2800) } });
      expect(page.data.showCounter).toBe(true);
      expect(page.data.remaining).toBe(200);
    });

    test('写到一半离开，再回来草稿还在；保存后草稿清除，并记住这次的关联', async () => {
      page.onContentInput({ detail: { value: '写到一半' } });
      page.setData({ content: '' });
      page.restoreDraft();
      expect(page.data.content).toBe('写到一半');

      page.setData({ draftPeriodId: 'p1', draftSectionId: 's1', draftSource: '连接之力 · 第 1 天' });
      await page.save();
      expect(page.data.content).toBe('');
      expect(page.data.lastSource).toEqual({ periodId: 'p1', sectionId: 's1', label: '连接之力 · 第 1 天', savedAt: expect.any(Number) });
      page.restoreDraft();
      expect(page.data.content).toBe('');
      page.useLastSource();
      expect(page.data.draftPeriodId).toBe('p1');
      expect(page.data.draftSource).toBe('连接之力 · 第 1 天');
    });

    test('编辑旧记录时不覆盖草稿', () => {
      page.onContentInput({ detail: { value: '新草稿' } });
      page.setData({ editingId: 'n1' });
      page.onContentInput({ detail: { value: '改旧记录' } });
      page.setData({ editingId: '', content: '' });
      page.restoreDraft();
      expect(page.data.content).toBe('新草稿');
    });
  });

  describe('搜索、做成日签、从阅读页进来', () => {
    test('搜索：带上关键词请求第一页，清除后回到全部', async () => {
      service.getMine.mockResolvedValue({ list: [], total: 0 });
      page.setData({ keyword: ' 触动 ' });
      page.onSearch();
      await Promise.resolve();
      expect(service.getMine).toHaveBeenLastCalledWith({ page: 1, limit: 20, q: '触动' });
      page.clearSearch();
      await Promise.resolve();
      expect(service.getMine).toHaveBeenLastCalledWith({ page: 1, limit: 20 });
      expect(page.data.keyword).toBe('');
    });

    test('搜索和期次筛选可以一起用', async () => {
      page.setData({ keyword: '原则', activePeriodId: 'p1' });
      await page.loadList(true);
      expect(service.getMine).toHaveBeenLastCalledWith({ page: 1, limit: 20, periodId: 'p1', q: '原则' });
    });

    test('做成日签：不超过 120 字带去日签页；太长要先编辑', async () => {
      wx.navigateTo = jest.fn();
      service.getMine.mockResolvedValue({
        list: [
          { _id: 'a', id: 'a', content: '由内而外', periodName: '连接之力', sectionTitle: '品德成功论', day: 1, createdAt: new Date().toISOString() },
          { _id: 'b', id: 'b', content: '长'.repeat(121), createdAt: new Date().toISOString() }
        ],
        total: 2
      });
      await page.loadList(true);
      page.makeCard({ currentTarget: { dataset: { id: 'a' } } });
      const url = wx.navigateTo.mock.calls[0][0].url;
      expect(url).toContain('/pages/daily-card/daily-card?quote=' + encodeURIComponent('由内而外'));
      expect(url).toContain('source=' + encodeURIComponent('品德成功论'));
      expect(url).toContain('periodName=' + encodeURIComponent('连接之力'));
      expect(url).toContain('day=1');

      page.makeCard({ currentTarget: { dataset: { id: 'b' } } });
      expect(wx.navigateTo).toHaveBeenCalledTimes(1);
      expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('120') }));
    });

    test('从阅读页进来：带上引用和课程；已有草稿时只补关联、不覆盖', () => {
      page.onLoad({ periodId: 'p1', sectionId: 's1', source: encodeURIComponent('连接之力 · 第 1 天'), quote: encodeURIComponent('由内而外') });
      page.applyPrefill();
      expect(page.data.content).toBe('「由内而外」\n');
      expect(page.data.draftPeriodId).toBe('p1');
      expect(page.data.draftSectionId).toBe('s1');
      expect(page.data.draftSource).toBe('连接之力 · 第 1 天');

      page.setData({ content: '我正在写的话' });
      page.onLoad({ periodId: 'p2', sectionId: 's2', source: encodeURIComponent('另一期'), quote: encodeURIComponent('别的引用') });
      page.applyPrefill();
      expect(page.data.content).toBe('我正在写的话');
      expect(page.data.draftPeriodId).toBe('p2');
    });

    test('没有带参数进来时不改动输入区', () => {
      page.onLoad({});
      page.applyPrefill();
      expect(page.data.content).toBe('');
      expect(page.data.draftPeriodId).toBe('');
    });
  });

  describe('觉察日记：随喜之外的门、页签、菜单和打卡', () => {
    const awarenessNote = (extra = {}) => ({
      _id: 'a1',
      id: 'a1',
      kind: 'awareness',
      content: '看：孩子磨蹭\n择：明天提前十分钟',
      createdAt: '2026-11-16T00:00:00.000Z',
      periodId: 'p1',
      sectionId: 's1',
      periodName: '连接之力',
      sectionTitle: '知彼解己',
      day: 5,
      awareness: {
        facts: '孩子磨蹭，我提高了声音。',
        feelings: ['着急', '委屈'],
        asks: [
          { level: 1, question: 'q1', answer: '没有先听懂他' },
          { level: 2, question: 'q2', answer: '我只听见了时间，没听见他。' }
        ],
        choice: '明天提前十分钟叫他',
        followUps: [],
        revisit: { enabled: true, status: 'pending', dueAt: '2026-11-23T22:00:00.000Z' }
      },
      ...extra
    });

    test('觉察卡片露出事实、最深的一句和选择；觉察不折叠，随喜仍按长度折叠', async () => {
      service.getMine.mockResolvedValue({
        list: [awarenessNote(), { _id: 'j1', content: '长'.repeat(120), createdAt: '2026-11-15T00:00:00.000Z' }],
        total: 2
      });
      await page.loadList(true);
      const [aware, joy] = page.data.list;
      expect(aware.kind).toBe('awareness');
      expect(aware.foldable).toBe(false);
      expect(aware.view).toMatchObject({
        feelings: ['着急', '委屈'],
        facts: '孩子磨蹭，我提高了声音。',
        keyAsk: '我只听见了时间，没听见他。',
        choice: '明天提前十分钟叫他'
      });
      expect(aware.view.revisitText).toMatch(/^\d+月\d+日 来信回访$/);
      expect(joy.kind).toBe('joy');
      expect(joy.view).toBe(null);
      expect(joy.foldable).toBe(true);
    });

    test('回访说明：已送到等你写后来；写过后来显示条数', async () => {
      const delivered = awarenessNote({ awareness: { ...awarenessNote().awareness, revisit: { status: 'delivered' } } });
      const answered = awarenessNote({
        _id: 'a2',
        awareness: { ...awarenessNote().awareness, revisit: { status: 'answered' }, followUps: [{ content: 'x' }, { content: 'y' }] }
      });
      service.getMine.mockResolvedValue({ list: [delivered, answered], total: 2 });
      await page.loadList(true);
      expect(page.data.list[0].view.revisitText).toBe('回访来信已送到，等你写一句后来');
      expect(page.data.list[1].view.revisitText).toBe('已写 2 条后来');
    });

    test('页签：随喜和觉察带上 kind，全部不带；打卡页签不请求日记列表', async () => {
      await page.loadList(true);
      expect(service.getMine).toHaveBeenLastCalledWith({ page: 1, limit: 20 });
      page.onKindTab({ currentTarget: { dataset: { tab: 'awareness' } } });
      await new Promise(resolve => setImmediate(resolve));
      expect(service.getMine).toHaveBeenLastCalledWith({ page: 1, limit: 20, kind: 'awareness' });
      page.onKindTab({ currentTarget: { dataset: { tab: 'joy' } } });
      await new Promise(resolve => setImmediate(resolve));
      expect(service.getMine).toHaveBeenLastCalledWith({ page: 1, limit: 20, kind: 'joy' });
      service.getMine.mockClear();
      const checkinService = require('../../services/checkin.service');
      checkinService.getUserCheckinsWithStats.mockResolvedValue({ list: [], pagination: { total: 0 } });
      page.onKindTab({ currentTarget: { dataset: { tab: 'checkin' } } });
      await new Promise(resolve => setImmediate(resolve));
      expect(service.getMine).not.toHaveBeenCalled();
      expect(checkinService.getUserCheckinsWithStats).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });

    test('打卡页签：只列本人的打卡，带上期次筛选，点开去打卡详情，不复制进日记', async () => {
      const checkinService = require('../../services/checkin.service');
      checkinService.getUserCheckinsWithStats.mockResolvedValue({
        list: [
          {
            _id: 'c1',
            note: '<p>今天读到<b>影响圈</b></p>',
            isPublic: false,
            checkinDate: '2026-11-15T00:00:00.000Z',
            sectionId: { _id: 's1', title: '积极主动', day: 1 },
            periodId: { _id: 'p1', name: '连接之力' }
          }
        ],
        pagination: { total: 1 }
      });
      page.setData({ activePeriodId: 'p1' });
      page.onKindTab({ currentTarget: { dataset: { tab: 'checkin' } } });
      await new Promise(resolve => setImmediate(resolve));
      expect(checkinService.getUserCheckinsWithStats).toHaveBeenCalledWith({ page: 1, limit: 20, periodId: 'p1' });
      expect(page.data.checkins).toHaveLength(1);
      expect(page.data.checkins[0]).toMatchObject({
        _id: 'c1', sectionId: 's1', periodId: 'p1', isPublic: false, excerpt: '今天读到 影响圈'
      });
      expect(page.data.checkins[0].sourceLabel).toBe('连接之力 · 第 1 天 · 积极主动');
      wx.navigateTo = jest.fn();
      page.openCheckin({ currentTarget: { dataset: { id: 'c1', section: 's1', period: 'p1' } } });
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/course-detail/course-detail?id=s1&checkinId=c1&periodId=p1' });
      expect(service.create).not.toHaveBeenCalled();
    });

    test('打卡页签加载失败：显示重试，不影响日记列表', async () => {
      const checkinService = require('../../services/checkin.service');
      checkinService.getUserCheckinsWithStats.mockRejectedValue(new Error('offline'));
      page.onKindTab({ currentTarget: { dataset: { tab: 'checkin' } } });
      await new Promise(resolve => setImmediate(resolve));
      expect(page.data.checkinsError).toBe(true);
      expect(page.data.checkinsLoading).toBe(false);
      checkinService.getUserCheckinsWithStats.mockResolvedValue({ list: [], pagination: { total: 0 } });
      page.retryCheckins();
      await new Promise(resolve => setImmediate(resolve));
      expect(page.data.checkinsError).toBe(false);
    });

    test('觉察的门：门上那句话每天固定；输入框里有关联时用它推荐课程，最近用过的课程也可以', () => {
      page.refreshDoor();
      expect(page.data.doorLine).not.toBe('');
      expect(page.doorSource()).toEqual({ periodId: '', sectionId: '', label: '' });
      page.setData({ lastSource: { periodId: 'p1', sectionId: 's1', label: '连接之力 · 知彼解己', savedAt: Date.now() - 3600 * 1000 } });
      expect(page.doorSource()).toMatchObject({ periodId: 'p1', sectionId: 's1' });
      // 很久以前的课程不再推荐
      page.setData({ lastSource: { periodId: 'p1', sectionId: 's1', label: '旧', savedAt: Date.now() - 10 * 24 * 3600 * 1000 } });
      expect(page.doorSource().periodId).toBe('');
      // 输入框里手动关联的优先
      page.setData({ draftPeriodId: 'p2', draftSectionId: 's2', draftSource: '另一期 · 第 5 个习惯' });
      expect(page.doorSource()).toEqual({ periodId: 'p2', sectionId: 's2', label: '另一期 · 第 5 个习惯' });
    });

    test('推开门：把课程带进静室；没有课程也能进', () => {
      wx.navigateTo = jest.fn();
      page.openDoor();
      expect(wx.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/joy-notes/awareness/awareness' });
      page.setData({ draftPeriodId: 'p1', draftSectionId: 's1', draftSource: '连接之力 · 知彼解己' });
      page.openDoor();
      const url = wx.navigateTo.mock.calls[1][0].url;
      expect(url).toContain('/pages/joy-notes/awareness/awareness?periodId=p1&sectionId=s1');
      expect(decodeURIComponent(url.split('source=')[1])).toBe('连接之力 · 知彼解己');
    });

    test('从这句开始觉察：随喜的文字（最多 300 字）带进静室，课程一起带上，原随喜不变', () => {
      wx.navigateTo = jest.fn();
      page.startAwarenessFrom({ content: `  ${'字'.repeat(400)}  `, periodId: 'p1', sectionId: 's1', sourceLabel: '连接之力 · 知彼解己' });
      const url = wx.navigateTo.mock.calls[0][0].url;
      expect(url).toContain('periodId=p1&sectionId=s1');
      expect(decodeURIComponent(url.split('seed=')[1])).toBe('字'.repeat(300));
      wx.navigateTo.mockClear();
      page.startAwarenessFrom({ content: '没关联的', periodId: '', sectionId: '', sourceLabel: '未关联期次或课程' });
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/joy-notes/awareness/awareness?seed=%E6%B2%A1%E5%85%B3%E8%81%94%E7%9A%84' });
      expect(service.update).not.toHaveBeenCalled();
      expect(service.create).not.toHaveBeenCalled();
    });

    test('长按菜单：随喜有 分享 / 做成日签 / 复制 / 编辑 / 从这句开始觉察 / 删除；觉察有 查看 / 分享 / 做成日签 / 复制 / 删除', async () => {
      service.getMine.mockResolvedValue({
        list: [{ _id: 'j1', content: '一句话', createdAt: '2026-11-15T00:00:00.000Z' }, awarenessNote()],
        total: 2
      });
      await page.loadList(true);
      wx.showActionSheet = jest.fn();
      page.openNoteMenu({ currentTarget: { dataset: { id: 'j1' } } });
      let options = wx.showActionSheet.mock.calls[0][0];
      expect(options.itemList.map(item => item.label || item)).toEqual(['分享', '做成日签', '复制', '编辑', '从这句开始觉察', '删除']);
      expect(options.itemList[5]).toEqual({ label: '删除', danger: true });

      wx.showActionSheet.mockClear();
      page.openNoteMenu({ currentTarget: { dataset: { id: 'a1' } } });
      options = wx.showActionSheet.mock.calls[0][0];
      expect(options.itemList.map(item => item.label || item)).toEqual(['查看', '分享', '做成日签', '复制', '删除']);
    });

    test('长按菜单里选「编辑」和「从这句开始觉察」会走对应的动作', async () => {
      service.getMine.mockResolvedValue({
        list: [{ _id: 'j1', content: '一句话', createdAt: '2026-11-15T00:00:00.000Z' }],
        total: 1
      });
      await page.loadList(true);
      wx.showActionSheet = jest.fn();
      wx.navigateTo = jest.fn();
      page.openNoteMenu({ currentTarget: { dataset: { id: 'j1' } } });
      const { success } = wx.showActionSheet.mock.calls[0][0];
      success({ tapIndex: 3 });
      expect(page.data.editingId).toBe('j1');
      page.setData({ editingId: '' });
      success({ tapIndex: 4 });
      expect(wx.navigateTo.mock.calls[0][0].url).toContain('/pages/joy-notes/awareness/awareness?seed=');
    });

    test('没有写「择」的觉察不提供做成日签；有「择」时用它做日签', async () => {
      const noChoice = awarenessNote({ awareness: { ...awarenessNote().awareness, choice: '' } });
      service.getMine.mockResolvedValue({ list: [noChoice], total: 1 });
      await page.loadList(true);
      wx.showActionSheet = jest.fn();
      page.openNoteMenu({ currentTarget: { dataset: { id: 'a1' } } });
      expect(wx.showActionSheet.mock.calls[0][0].itemList).not.toContain('做成日签');
      wx.showToast = jest.fn();
      wx.navigateTo = jest.fn();
      page.makeCard({ currentTarget: { dataset: { id: 'a1' } } });
      expect(wx.navigateTo).not.toHaveBeenCalled();
      expect(wx.showToast).toHaveBeenCalled();

      service.getMine.mockResolvedValue({ list: [awarenessNote()], total: 1 });
      await page.loadList(true);
      page.makeCard({ currentTarget: { dataset: { id: 'a1' } } });
      const url = wx.navigateTo.mock.calls[0][0].url;
      expect(decodeURIComponent(url.split('quote=')[1].split('&')[0])).toBe('明天提前十分钟叫他');
    });

    test('点觉察卡片去详情页', () => {
      wx.navigateTo = jest.fn();
      page.openDetail({ currentTarget: { dataset: { id: 'a1' } } });
      expect(wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/joy-notes/detail/detail?id=a1' });
    });

    test('删除觉察：确认文字区别于随喜；回访还没送出时提醒也会取消', async () => {
      service.getMine.mockResolvedValue({ list: [awarenessNote()], total: 1 });
      await page.loadList(true);
      wx.showModal = jest.fn();
      page.confirmDelete({ currentTarget: { dataset: { id: 'a1' } } });
      const options = wx.showModal.mock.calls[0][0];
      expect(options.title).toBe('删掉这条觉察？');
      expect(options.content).toContain('回访来信也不会再送');
    });
  });

  describe('标题与富文本重点颜色', () => {
    const store = () => require('../../utils/joy-note-store');

    test('新记：标题和正文一起存草稿，保存时只在有标题、有格式时才带上', async () => {
      page.onTitleInput({ detail: { value: '  晨读里的一句  ' } });
      page.onContentInput({ detail: { text: '重点在这', html: '<p><span style="color:#dc2626">重点</span>在这</p>' } });
      expect(store().readJoyDraft()).toEqual({ title: '  晨读里的一句  ', content: '重点在这', html: '<p><span style="color:#dc2626">重点</span>在这</p>' });
      await page.save();
      expect(service.create).toHaveBeenCalledWith({
        title: '晨读里的一句',
        content: '重点在这',
        contentHtml: '<p><span style="color:#dc2626">重点</span>在这</p>',
        periodId: null,
        sectionId: null
      });
      expect(page.data).toMatchObject({ title: '', content: '', contentHtml: '' });
      expect(store().readJoyDraft()).toEqual({ title: '', content: '', html: '' });
    });

    test('没有标题、没有格式时保持原来的请求内容（不多带字段）', async () => {
      page.onContentInput({ detail: { text: '普通一句', html: '' } });
      await page.save();
      expect(service.create).toHaveBeenCalledWith({ content: '普通一句', periodId: null, sectionId: null });
    });

    test('再回来时恢复标题、正文和格式；旧版草稿（纯文本）也能恢复', () => {
      store().writeJoyDraft({ title: '没写完的标题', content: '半截话', html: '<p><strong>半截话</strong></p>' });
      page.restoreDraft();
      expect(page.data).toMatchObject({ title: '没写完的标题', content: '半截话', contentHtml: '<p><strong>半截话</strong></p>' });
      page.setData({ title: '', content: '', contentHtml: '' });
      store().write(store().KEYS.joyDraft, '旧版草稿');
      page.restoreDraft();
      expect(page.data).toMatchObject({ title: '', content: '旧版草稿', contentHtml: '' });
    });

    test('编辑旧记录：带出标题和格式；保存时更新；取消后清空', async () => {
      page.data.list = [{
        _id: 'n1', title: '原标题', content: '原文重点', contentHtml: '<p>原文<span style="color:#dc2626">重点</span></p>', periodId: '', sectionId: ''
      }];
      page.startEdit({ currentTarget: { dataset: { id: 'n1' } } });
      expect(page.data).toMatchObject({ editingId: 'n1', title: '原标题', contentHtml: '<p>原文<span style="color:#dc2626">重点</span></p>' });
      page.onTitleInput({ detail: { value: '新标题' } });
      await page.save();
      expect(service.update).toHaveBeenCalledWith('n1', {
        content: '原文重点',
        contentHtml: '<p>原文<span style="color:#dc2626">重点</span></p>',
        periodId: null,
        sectionId: null,
        title: '新标题'
      });
      // 编辑时不动草稿
      expect(store().readJoyDraft()).toEqual({ title: '', content: '', html: '' });
      page.data.list = [{ _id: 'n2', title: 'x', content: 'y', contentHtml: '', periodId: '', sectionId: '' }];
      page.startEdit({ currentTarget: { dataset: { id: 'n2' } } });
      page.cancelEdit();
      expect(page.data).toMatchObject({ editingId: '', title: '', content: '', contentHtml: '' });
    });

    test('列表：显示标题；有格式的随喜用 rich-text 展示，没有格式的仍是纯文本', async () => {
      service.getMine.mockResolvedValue({
        list: [
          { _id: 'j1', title: '标题甲', content: '重点', contentHtml: '<p><span style="color:#dc2626">重点</span></p>', createdAt: '2026-11-15T00:00:00.000Z' },
          { _id: 'j2', content: '普通', createdAt: '2026-11-14T00:00:00.000Z' }
        ],
        total: 2
      });
      await page.loadList(true);
      const [rich, plain] = page.data.list;
      expect(rich.title).toBe('标题甲');
      expect(rich.richNodes).toContain('color:#dc2626');
      expect(rich.richNodes).toContain('font-size:inherit');
      expect(plain.title).toBe('');
      expect(plain.richNodes).toBe('');
    });

    test('复制：有标题时标题放在第一行', () => {
      wx.setClipboardData = jest.fn();
      page.data.list = [{ _id: 'j1', title: '标题', content: '正文' }, { _id: 'j2', title: '', content: '只有正文' }];
      page.copyNote({ currentTarget: { dataset: { id: 'j1' } } });
      page.copyNote({ currentTarget: { dataset: { id: 'j2' } } });
      expect(wx.setClipboardData).toHaveBeenNthCalledWith(1, { data: '标题\n正文' });
      expect(wx.setClipboardData).toHaveBeenNthCalledWith(2, { data: '只有正文' });
    });

    test('觉察卡片也带标题', async () => {
      service.getMine.mockResolvedValue({
        list: [{ _id: 'a1', kind: 'awareness', title: '孩子磨蹭的早晨', content: '看：x', awareness: { facts: 'x', feelings: [], asks: [], followUps: [], revisit: {} }, createdAt: '2026-11-15T00:00:00.000Z' }],
        total: 1
      });
      await page.loadList(true);
      expect(page.data.list[0].title).toBe('孩子磨蹭的早晨');
    });

    test('页面声明了输入框组件，写字区用 rich-input、标题是单独一行输入', () => {
      const fs = require('fs');
      const path = require('path');
      const json = JSON.parse(fs.readFileSync(path.join(__dirname, '../../pages/joy-notes/joy-notes.json'), 'utf8'));
      expect(json.usingComponents['rich-input']).toBe('/components/rich-input/rich-input');
      const wxml = fs.readFileSync(path.join(__dirname, '../../pages/joy-notes/joy-notes.wxml'), 'utf8');
      expect(wxml).toContain('<rich-input');
      expect(wxml).toContain('placeholder="标题（可选）"');
    });
  });

  describe('分享', () => {
    const sheet = () => ({ open: jest.fn(), getShareConfig: jest.fn(() => null) });

    test('分享一条随喜：打开分享面板，署名用昵称，关联了课程时带上来源', async () => {
      global.getApp = jest.fn(() => ({ globalData: { userInfo: { nickname: '狮子' } } }));
      const panel = sheet();
      page.selectComponent = jest.fn(() => panel);
      service.getMine.mockResolvedValue({
        list: [{
          _id: 'j1', title: '标题', content: '一句话', contentHtml: '<p><strong>粗</strong></p>', createdAt: '2026-11-15T00:00:00.000Z',
          periodId: 'p1', sectionId: 's1', periodName: '连接之力', sectionTitle: '知彼解己', day: 5
        }],
        total: 1
      });
      await page.loadList(true);
      page.shareNote(page.data.list[0]);
      expect(page.selectComponent).toHaveBeenCalledWith('#joy-share');
      expect(panel.open).toHaveBeenCalledWith(expect.objectContaining({
        id: 'j1', kind: 'joy', title: '标题', authorName: '狮子', content: '一句话', contentHtml: '<p><strong>粗</strong></p>',
        periodLinked: true, sourceLabel: '连接之力 · 第 5 天 · 知彼解己'
      }));
      delete global.getApp;
    });

    test('失效的关联不带来源；没有昵称时署名「书友」', async () => {
      global.getApp = jest.fn(() => ({ globalData: { userInfo: { nickname: '微信用户' } } }));
      const panel = sheet();
      page.selectComponent = jest.fn(() => panel);
      service.getMine.mockResolvedValue({
        list: [{ _id: 'j1', content: '一句话', createdAt: '2026-11-15T00:00:00.000Z', periodId: 'p1', sourceUnavailable: true }],
        total: 1
      });
      await page.loadList(true);
      page.shareNote(page.data.list[0]);
      expect(panel.open.mock.calls[0][0]).toMatchObject({ authorName: '书友', sourceLabel: '' });
      delete global.getApp;
    });

    test('分享一条觉察：带上看感问择和后来', async () => {
      const panel = sheet();
      page.selectComponent = jest.fn(() => panel);
      service.getMine.mockResolvedValue({
        list: [{
          _id: 'a1', kind: 'awareness', title: '早晨', content: '看：x', createdAt: '2026-11-15T00:00:00.000Z',
          awareness: { facts: '事实', feelings: ['着急'], asks: [{ level: 1, question: '问', answer: '答' }], choice: '择', followUps: [{ content: '后来', createdAt: '2026-11-23T00:00:00.000Z' }], revisit: {} }
        }],
        total: 1
      });
      await page.loadList(true);
      page.shareNote(page.data.list[0]);
      const payload = panel.open.mock.calls[0][0];
      expect(payload).toMatchObject({ id: 'a1', kind: 'awareness', title: '早晨' });
      expect(payload.awareness.asks[0]).toMatchObject({ label: '一叩', question: '问', answer: '答' });
      expect(payload.awareness.followUps[0]).toMatchObject({ content: '后来', dateLabel: '11月23日' });
    });

    test('长按菜单里选「分享」打开面板', async () => {
      const panel = sheet();
      page.selectComponent = jest.fn(() => panel);
      service.getMine.mockResolvedValue({ list: [{ _id: 'j1', content: '一句话', createdAt: '2026-11-15T00:00:00.000Z' }], total: 1 });
      await page.loadList(true);
      wx.showActionSheet = jest.fn();
      page.openNoteMenu({ currentTarget: { dataset: { id: 'j1' } } });
      const { itemList, success } = wx.showActionSheet.mock.calls[0][0];
      success({ tapIndex: itemList.findIndex(item => (item.label || item) === '分享') });
      expect(panel.open).toHaveBeenCalledTimes(1);
    });

    test('转发：面板里取到了分享信息就用它；取不到时只转发首页，不带出任何私人内容', () => {
      const panel = sheet();
      panel.getShareConfig.mockReturnValue({ title: '狮子 的一句随喜', path: '/pages/joy-notes/shared/shared?code=abcd2345' });
      page.selectComponent = jest.fn(() => panel);
      expect(page.onShareAppMessage()).toEqual({ title: '狮子 的一句随喜', path: '/pages/joy-notes/shared/shared?code=abcd2345' });
      panel.getShareConfig.mockReturnValue(null);
      const fallback = page.onShareAppMessage();
      expect(fallback.path).toBe('/pages/index/index');
      expect(JSON.stringify(fallback)).not.toContain('abcd2345');
      page.selectComponent = jest.fn(() => null);
      expect(page.onShareAppMessage().path).toBe('/pages/index/index');
    });

    test('这一页是私人的：进来就隐藏右上角的转发菜单；页面声明了分享面板组件', () => {
      wx.hideShareMenu = jest.fn();
      page.onShow();
      expect(wx.hideShareMenu).toHaveBeenCalledWith({ menus: ['shareAppMessage', 'shareTimeline'] });
      const fs = require('fs');
      const path = require('path');
      const json = JSON.parse(fs.readFileSync(path.join(__dirname, '../../pages/joy-notes/joy-notes.json'), 'utf8'));
      expect(json.usingComponents['joy-share']).toBe('/pages/joy-notes/components/joy-share/joy-share');
      expect(fs.readFileSync(path.join(__dirname, '../../pages/joy-notes/joy-notes.wxml'), 'utf8')).toContain('<joy-share id="joy-share"');
    });
  });
});
