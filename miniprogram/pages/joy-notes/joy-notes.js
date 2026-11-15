const service = require('./joy-notes.service');
const appDialog = require('../../utils/dialog');
const { requireLogin } = require('../../utils/require-login');
const { tenantStorage } = require('../../utils/storage');
const constants = require('../../config/constants');

const PAGE_SIZE = 20;
// 一条记录超过这个字数就先折叠，点「展开」看全文
const FOLD_LENGTH = 90;
// 剩余字数不多时才提示，平时不打扰
const CONTENT_MAX = 3000;
const COUNTER_SHOW_AT = 2700;
// 离开页面再回来，30 秒内不重复向服务器要列表
const RELOAD_AFTER_MS = 30 * 1000;
const DRAFT_KEY = 'joyNoteDraft';
const LAST_SOURCE_KEY = 'joyNoteLastSource';
const NONE = { id: '', name: '暂不关联期次' };
const ALL = { id: '', name: '全部期次' };

function sectionLabel(section) {
  const day = section.day === null || section.day === undefined ? NaN : Number(section.day);
  const dayText = Number.isFinite(day) ? (day === 0 ? '开篇' : `第 ${day} 天`) : '';
  return [dayText, section.title || ''].filter(Boolean).join(' · ');
}

function dateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const year = date.getFullYear() === now.getFullYear() ? '' : `${date.getFullYear()}年`;
  return `${year}${date.getMonth() + 1}月${date.getDate()}日`;
}

function sourceLabel(item) {
  if (item.sourceUnavailable) return '关联的期次当前不可用';
  const parts = [];
  if (item.periodName) parts.push(item.periodName);
  if (item.sectionTitle) parts.push(sectionLabel({ day: item.day, title: item.sectionTitle }));
  else if (item.sectionUnavailable) parts.push('课程当前不可用');
  return parts.join(' · ') || '未关联期次或课程';
}

function readStore(key) {
  try {
    return tenantStorage.get(`${key}:${currentIdentity()}`) || null;
  } catch (error) {
    return null;
  }
}

function writeStore(key, value) {
  try {
    const name = `${key}:${currentIdentity()}`;
    if (value) tenantStorage.set(name, value);
    else tenantStorage.remove(name);
  } catch (error) {
    // 本地存储不可用时，只是少了草稿恢复，不影响记录
  }
}

function currentIdentity() {
  const user = tenantStorage.get(constants.STORAGE_KEYS.USER_INFO);
  return (user && (user._id || user.id || user.userId))
    || tenantStorage.get(constants.STORAGE_KEYS.TOKEN) || '';
}

Page({
  data: {
    needLogin: false,
    loading: true,
    listError: false,
    loadingMore: false,
    list: [],
    page: 1,
    hasMore: false,
    periods: [],
    periodsLoaded: false,
    periodsLoading: false,
    periodsError: false,
    filterOptions: [ALL],
    filterIndex: 0,
    activePeriodId: '',
    keyword: '',
    content: '',
    remaining: CONTENT_MAX,
    showCounter: false,
    lastSource: null,
    editingId: '',
    draftPeriodId: '',
    draftSectionId: '',
    draftSource: '',
    saving: false,
    sheetOpen: false,
    sheetPeriodOptions: [NONE],
    sheetPeriodIndex: 0,
    sheetPeriodId: '',
    sheetSectionId: '',
    sheetSections: [],
    sheetLoading: false,
    sheetError: false
  },

  // 从沉静阅读长按「记一条随喜」进来：带着引用的那句话和当前课程
  onLoad(options = {}) {
    const decode = value => {
      try {
        return decodeURIComponent(value || '');
      } catch (error) {
        return String(value || '');
      }
    };
    const periodId = decode(options.periodId);
    if (periodId) {
      this._prefill = {
        periodId,
        sectionId: decode(options.sectionId),
        source: decode(options.source),
        quote: decode(options.quote).slice(0, 80)
      };
    }
  },

  // 把阅读页带来的引用和课程放进输入区（已经有草稿时只补上关联，不覆盖正在写的话）
  applyPrefill() {
    const prefill = this._prefill;
    if (!prefill) return;
    this._prefill = null;
    const patch = { draftPeriodId: prefill.periodId, draftSectionId: prefill.sectionId, draftSource: prefill.source };
    if (!this.data.content && !this.data.editingId && prefill.quote) {
      const content = `「${prefill.quote}」\n`;
      patch.content = content;
      patch.remaining = CONTENT_MAX - Array.from(content).length;
      patch.showCounter = patch.remaining <= CONTENT_MAX - COUNTER_SHOW_AT;
      writeStore(DRAFT_KEY, content);
    }
    this.setData(patch);
  },

  onShow() {
    const loggedIn = requireLogin('登录后可以记录和回看你的随喜记');
    const identity = loggedIn ? currentIdentity() : '';
    if (!loggedIn || (this.activeIdentity && this.activeIdentity !== identity)) {
      this.clearPrivateState();
    }
    this.activeIdentity = identity;
    this.setData({ needLogin: !loggedIn });
    if (!loggedIn) return;
    this.restoreDraft();
    this.applyPrefill();
    // 刚加载过就不重复请求，免得每次切回来都闪一下
    const fresh = this._loadedAt && Date.now() - this._loadedAt < RELOAD_AFTER_MS && this.data.list.length > 0;
    if (fresh) return;
    this.loadPeriods();
    this.loadList(true);
  },

  // 写到一半离开（接电话、切去读书），回来时文字还在
  restoreDraft() {
    const lastSource = readStore(LAST_SOURCE_KEY);
    const patch = { lastSource: lastSource && lastSource.label ? lastSource : null };
    if (!this.data.content && !this.data.editingId) {
      const draft = readStore(DRAFT_KEY);
      if (typeof draft === 'string' && draft) {
        patch.content = draft;
        patch.remaining = CONTENT_MAX - Array.from(draft).length;
        patch.showCounter = patch.remaining <= CONTENT_MAX - COUNTER_SHOW_AT;
      }
    }
    this.setData(patch);
  },

  onPullDownRefresh() {
    if (this.data.needLogin) {
      if (typeof wx.stopPullDownRefresh === 'function') wx.stopPullDownRefresh();
      return;
    }
    Promise.all([this.loadPeriods(), this.loadList(true)]).then(() => {
      if (typeof wx.stopPullDownRefresh === 'function') wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore && !this.data.listError) this.loadList(false);
  },

  onUnload() {
    this.listSequence = (this.listSequence || 0) + 1;
    this.periodSequence = (this.periodSequence || 0) + 1;
    this.sectionSequence = (this.sectionSequence || 0) + 1;
    this.saveSequence = (this.saveSequence || 0) + 1;
    this.deleteSequence = (this.deleteSequence || 0) + 1;
  },

  clearPrivateState() {
    this.listSequence = (this.listSequence || 0) + 1;
    this.periodSequence = (this.periodSequence || 0) + 1;
    this.sectionSequence = (this.sectionSequence || 0) + 1;
    this.saveSequence = (this.saveSequence || 0) + 1;
    this.deleteSequence = (this.deleteSequence || 0) + 1;
    this.setData({
      loading: true,
      listError: false,
      loadingMore: false,
      list: [],
      keyword: '',
      page: 1,
      hasMore: false,
      periods: [],
      periodsLoaded: false,
      periodsLoading: false,
      periodsError: false,
      filterOptions: [ALL],
      filterIndex: 0,
      activePeriodId: '',
      content: '',
      editingId: '',
      draftPeriodId: '',
      draftSectionId: '',
      draftSource: '',
      saving: false,
      sheetOpen: false,
      sheetPeriodOptions: [NONE],
      sheetPeriodIndex: 0,
      sheetPeriodId: '',
      sheetSectionId: '',
      sheetSections: [],
      sheetLoading: false,
      sheetError: false
    });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  async loadPeriods() {
    this.periodSequence = (this.periodSequence || 0) + 1;
    const sequence = this.periodSequence;
    this.setData({ periodsLoading: true, periodsError: false });
    try {
      const result = await service.getPeriods();
      if (sequence !== this.periodSequence) return;
      const periods = (result.list || []).map(item => ({ id: String(item.id), name: item.name }));
      const filterOptions = [ALL, ...periods];
      const filterIndex = filterOptions.findIndex(item => item.id === this.data.activePeriodId);
      const previousPeriodId = this.data.activePeriodId;
      this.setData({
        periods,
        periodsLoaded: true,
        periodsLoading: false,
        periodsError: false,
        filterOptions,
        filterIndex: Math.max(filterIndex, 0),
        activePeriodId: filterIndex < 0 ? '' : previousPeriodId,
        sheetPeriodOptions: [NONE, ...periods]
      });
      if (filterIndex < 0 && previousPeriodId) this.loadList(true);
    } catch (error) {
      if (sequence !== this.periodSequence) return;
      this.setData({ periodsLoading: false, periodsError: true });
    }
  },

  async loadList(reset) {
    const page = reset ? 1 : this.data.page + 1;
    this.listSequence = (this.listSequence || 0) + 1;
    const sequence = this.listSequence;
    this.setData(reset
      ? { loading: this.data.list.length === 0, listError: false }
      : { loadingMore: true, listError: false });
    try {
      const params = { page, limit: PAGE_SIZE };
      if (this.data.activePeriodId) params.periodId = this.data.activePeriodId;
      if (this.data.keyword.trim()) params.q = this.data.keyword.trim();
      const result = await service.getMine(params);
      if (sequence !== this.listSequence) return;
      this._loadedAt = Date.now();
      const items = (result.list || []).map(item => ({
        ...item,
        _id: String(item._id || item.id),
        periodId: item.periodId ? String(item.periodId) : '',
        sectionId: item.sectionId ? String(item.sectionId) : '',
        dateLabel: dateLabel(item.createdAt),
        sourceLabel: sourceLabel(item),
        foldable: Array.from(item.content || '').length > FOLD_LENGTH || String(item.content || '').split('\n').length > 4,
        expanded: false
      }));
      const list = reset ? items : this.data.list.concat(items);
      this.setData({
        list,
        page,
        hasMore: list.length < (result.total || 0),
        loading: false,
        loadingMore: false,
        listError: false
      });
    } catch (error) {
      if (sequence !== this.listSequence) return;
      this.setData({ loading: false, loadingMore: false, listError: true });
    }
  },

  retryList() {
    this.loadList(true);
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value || '' });
  },

  // 按关键词找自己的记录；清空后回到全部
  onSearch() {
    this.setData({ list: [], page: 1, hasMore: false }, () => this.loadList(true));
  },

  clearSearch() {
    if (!this.data.keyword) return;
    this.setData({ keyword: '', list: [], page: 1, hasMore: false }, () => this.loadList(true));
  },

  // 把一条随喜记做成日签：不超过 120 字才能放进一张卡
  makeCard(event) {
    const item = this.data.list.find(row => row._id === event.currentTarget.dataset.id);
    if (!item) return;
    const quote = String(item.content || '').trim();
    if (Array.from(quote).length > 120) {
      wx.showToast({ title: '这条有点长，先编辑到 120 字以内再做日签', icon: 'none' });
      return;
    }
    const enc = value => encodeURIComponent(value === undefined || value === null ? '' : String(value));
    const day = Number(item.day);
    wx.navigateTo({
      url:
        `/pages/daily-card/daily-card?quote=${enc(quote)}` +
        `&source=${enc(item.sectionTitle || '')}` +
        `&periodName=${enc(item.periodName || '')}` +
        `&day=${enc(Number.isFinite(day) && day > 0 ? day : '')}`
    });
  },

  onFilterChange(event) {
    const index = Number(event.detail.value);
    const selected = this.data.filterOptions[index];
    if (!selected || selected.id === this.data.activePeriodId) return;
    this.setData({
      filterIndex: index,
      activePeriodId: selected.id,
      list: [],
      page: 1,
      hasMore: false
    }, () => this.loadList(true));
  },

  onContentInput(event) {
    const content = event.detail.value;
    const remaining = CONTENT_MAX - Array.from(content).length;
    this.setData({ content, remaining, showCounter: remaining <= CONTENT_MAX - COUNTER_SHOW_AT });
    // 新写的内容自动存草稿；编辑旧记录时不存，免得覆盖草稿
    if (!this.data.editingId) writeStore(DRAFT_KEY, content);
  },

  // 沿用上次关联的期次和课程，一键带上
  useLastSource() {
    const last = this.data.lastSource;
    if (!last) return;
    this.setData({ draftPeriodId: last.periodId || '', draftSectionId: last.sectionId || '', draftSource: last.label });
  },

  toggleExpand(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ list: this.data.list.map(item => (item._id === id ? { ...item, expanded: !item.expanded } : item)) });
  },

  copyNote(event) {
    const item = this.data.list.find(row => row._id === event.currentTarget.dataset.id);
    if (item) wx.setClipboardData({ data: item.content });
  },

  startEdit(event) {
    if (this.data.saving) return;
    const item = this.data.list.find(row => row._id === event.currentTarget.dataset.id);
    if (!item) return;
    this.setData({
      editingId: item._id,
      content: item.content,
      draftPeriodId: item.periodId || '',
      draftSectionId: item.sectionId || '',
      draftSource: item.periodId ? item.sourceLabel : ''
    });
    if (typeof wx.pageScrollTo === 'function') wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },

  cancelEdit() {
    if (this.data.saving) return;
    this.setData({ editingId: '', content: '', remaining: CONTENT_MAX, showCounter: false, draftPeriodId: '', draftSectionId: '', draftSource: '' });
  },

  async save() {
    if (this.data.saving) return;
    const content = this.data.content.trim();
    if (!content) {
      wx.showToast({ title: '先写下一句话吧', icon: 'none' });
      return;
    }
    this.saveSequence = (this.saveSequence || 0) + 1;
    const sequence = this.saveSequence;
    this.setData({ saving: true });
    try {
      const data = {
        content,
        periodId: this.data.draftPeriodId || null,
        sectionId: this.data.draftSectionId || null
      };
      if (this.data.editingId) await service.update(this.data.editingId, data);
      else await service.create(data);
      if (sequence !== this.saveSequence) return;
      // 记住这次关联的期次和课程，下次一键沿用；草稿清掉
      const savedSource = this.data.draftPeriodId && this.data.draftSource
        ? { periodId: this.data.draftPeriodId, sectionId: this.data.draftSectionId, label: this.data.draftSource }
        : null;
      if (savedSource) writeStore(LAST_SOURCE_KEY, savedSource);
      writeStore(DRAFT_KEY, '');
      this.setData({
        content: '',
        remaining: CONTENT_MAX,
        showCounter: false,
        lastSource: savedSource || this.data.lastSource,
        editingId: '',
        draftPeriodId: '',
        draftSectionId: '',
        draftSource: '',
        activePeriodId: '',
        filterIndex: 0,
        saving: false
      });
      this._loadedAt = 0;
      wx.showToast({ title: '记下来了', icon: 'success' });
      await this.loadList(true);
    } catch (error) {
      if (sequence !== this.saveSequence) return;
      this.setData({ saving: false });
      wx.showToast({ title: error?.message || '没存上，再试一次', icon: 'none' });
    }
  },

  confirmDelete(event) {
    if (this.data.saving) return;
    const id = event.currentTarget.dataset.id;
    appDialog.showModal({
      title: '删掉这条随喜记？',
      content: '删掉之后就找不回来了',
      confirmText: '删除',
      success: result => {
        if (result.confirm) this.deleteNote(id);
      }
    });
  },

  async deleteNote(id) {
    this.deleteSequence = (this.deleteSequence || 0) + 1;
    const sequence = this.deleteSequence;
    try {
      await service.remove(id);
      if (sequence !== this.deleteSequence) return;
      if (this.data.editingId === id) this.cancelEdit();
      wx.showToast({ title: '已删除', icon: 'success' });
      await this.loadList(true);
    } catch (error) {
      if (sequence !== this.deleteSequence) return;
      wx.showToast({ title: error?.message || '没删掉，再试一次', icon: 'none' });
    }
  },

  async openAssociation() {
    if (this.data.saving) return;
    this.setData({ sheetOpen: true });
    if (!this.data.periodsLoaded) await this.loadPeriods();
    if (!this.data.sheetOpen) return;
    const index = this.data.sheetPeriodOptions.findIndex(item => item.id === this.data.draftPeriodId);
    const selected = this.data.sheetPeriodOptions[Math.max(index, 0)] || NONE;
    this.setData({
      sheetPeriodIndex: Math.max(index, 0),
      sheetPeriodId: selected.id,
      sheetSectionId: selected.id ? this.data.draftSectionId : '',
      sheetSections: [],
      sheetError: false
    });
    if (selected.id) this.loadSections(selected.id);
  },

  closeAssociation() {
    this.sectionSequence = (this.sectionSequence || 0) + 1;
    this.setData({ sheetOpen: false, sheetLoading: false });
  },

  onSheetPeriodChange(event) {
    const index = Number(event.detail.value);
    const selected = this.data.sheetPeriodOptions[index];
    if (!selected) return;
    this.sectionSequence = (this.sectionSequence || 0) + 1;
    this.setData({
      sheetPeriodIndex: index,
      sheetPeriodId: selected.id,
      sheetSectionId: '',
      sheetSections: [],
      sheetLoading: false,
      sheetError: false
    });
    if (selected.id) this.loadSections(selected.id);
  },

  async loadSections(periodId) {
    this.sectionSequence = (this.sectionSequence || 0) + 1;
    const sequence = this.sectionSequence;
    this.setData({ sheetLoading: true, sheetError: false });
    try {
      const result = await service.getSections(periodId);
      if (sequence !== this.sectionSequence || periodId !== this.data.sheetPeriodId) return;
      const sections = (result.list || []).map(section => ({
        id: String(section.id),
        label: sectionLabel(section)
      }));
      const selectedExists = sections.some(item => item.id === this.data.sheetSectionId);
      this.setData({
        sheetSections: sections,
        sheetSectionId: selectedExists ? this.data.sheetSectionId : '',
        sheetLoading: false
      });
    } catch (error) {
      if (sequence !== this.sectionSequence) return;
      this.setData({ sheetLoading: false, sheetError: true });
    }
  },

  retrySections() {
    if (this.data.sheetPeriodId) this.loadSections(this.data.sheetPeriodId);
  },

  selectSection(event) {
    this.setData({ sheetSectionId: event.currentTarget.dataset.id || '' });
  },

  finishAssociation() {
    if (this.data.sheetLoading || this.data.sheetError) return;
    const period = this.data.sheetPeriodOptions[this.data.sheetPeriodIndex] || NONE;
    const section = this.data.sheetSections.find(item => item.id === this.data.sheetSectionId);
    this.setData({
      draftPeriodId: period.id,
      draftSectionId: section ? section.id : '',
      draftSource: [period.id ? period.name : '', section?.label || ''].filter(Boolean).join(' · ')
    });
    this.closeAssociation();
  },

  noop() {}
});
