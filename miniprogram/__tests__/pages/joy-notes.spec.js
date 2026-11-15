jest.mock('../../pages/joy-notes/joy-notes.service', () => ({
  getPeriods: jest.fn(),
  getSections: jest.fn(),
  getMine: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn()
}));
jest.mock('../../utils/require-login', () => ({ requireLogin: jest.fn(() => true) }));

describe('随喜记页面', () => {
  let page;
  let service;

  beforeEach(() => {
    jest.resetModules();
    let config;
    global.Page = jest.fn(value => { config = value; });
    service = require('../../pages/joy-notes/joy-notes.service');
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
    expect(service.update).toHaveBeenCalledWith('n1', { content: '新文字', periodId: 'p1', sectionId: 's1' });
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
      expect(page.data.lastSource).toEqual({ periodId: 'p1', sectionId: 's1', label: '连接之力 · 第 1 天' });
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
});
