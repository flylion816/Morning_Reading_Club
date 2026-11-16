const service = require('../../services/joy-note.service');
const checkinService = require('../../services/checkin.service');
const appDialog = require('../../utils/dialog');
const { requireLogin } = require('../../utils/require-login');
const store = require('../../utils/joy-note-store');
const richNote = require('../../utils/rich-note');
const sharePoster = require('./share-poster');
const awarenessText = require('./awareness-text');
const { getDefaultShareTitle, getDefaultShareImage } = require('../../utils/brand');
const { pickDoorLine, detectHabit, pickJoyPlaceholder } = require('../../utils/awareness-questions');

const PAGE_SIZE = 20;
// 一条记录超过这个字数就先折叠，点「展开」看全文
const FOLD_LENGTH = 90;
// 剩余字数不多时才提示，平时不打扰
const CONTENT_MAX = 3000;
const COUNTER_SHOW_AT = 2700;
// 离开页面再回来，30 秒内不重复向服务器要列表
const RELOAD_AFTER_MS = 30 * 1000;
const DRAFT_KEY = store.KEYS.joyDraft;
const LAST_SOURCE_KEY = store.KEYS.lastSource;
// 「上次关联」只在最近几天内用来给觉察静室推荐课程，免得带着很久以前的课
const SOURCE_FRESH_MS = 3 * 24 * 60 * 60 * 1000;
const CHECKIN_PAGE_SIZE = 20;
const KIND_TABS = [
  { key: 'all', name: '全部' },
  { key: 'joy', name: '随喜' },
  { key: 'awareness', name: '觉察' },
  { key: 'checkin', name: '打卡' }
];
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

const readStore = store.read;
const writeStore = store.write;
const currentIdentity = store.currentIdentity;

function dayKeyOf(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function excerpt(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : text;
}

function monthDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

// 觉察卡片底部那句：回访什么时候来、写了几条后来
function revisitText(awareness) {
  if (!awareness) return '';
  const followUps = (awareness.followUps || []).length;
  const status = (awareness.revisit && awareness.revisit.status) || 'none';
  if (status === 'pending') return `${monthDay(awareness.revisit.dueAt)} 来信回访`;
  if (status === 'delivered') return '回访来信已送到，等你写一句后来';
  if (followUps > 0) return `已写 ${followUps} 条后来`;
  return '';
}

// 觉察卡片上露出的内容：事实、最深的那句回答、择
function awarenessView(awareness) {
  if (!awareness) return null;
  const asks = awareness.asks || [];
  return {
    feelings: awareness.feelings || [],
    facts: excerpt(awareness.facts, 44),
    keyAsk: excerpt(asks.length ? asks[asks.length - 1].answer : '', 56),
    choice: excerpt(awareness.choice, 80),
    revisitText: revisitText(awareness)
  };
}

function checkinExcerpt(note) {
  return excerpt(String(note || '').replace(/<[^>]*>/g, ' '), 90);
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
    title: '',
    content: '',
    // 带格式（颜色、加粗…）时才有值
    contentHtml: '',
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
    sheetError: false,
    // 页签：全部 / 随喜 / 觉察 / 打卡
    kindTab: 'all',
    kindTabs: KIND_TABS,
    // 觉察的门：每天换一句
    doorLine: '',
    placeholder: '',
    // 「打卡」页签：只列出本人的打卡
    checkins: [],
    checkinsLoading: false,
    checkinsError: false,
    checkinsPage: 1,
    checkinsHasMore: false
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
      patch.contentHtml = '';
      patch.remaining = CONTENT_MAX - Array.from(content).length;
      patch.showCounter = patch.remaining <= CONTENT_MAX - COUNTER_SHOW_AT;
      store.writeJoyDraft({ title: this.data.title, content, html: '' });
    }
    this.setData(patch);
  },

  onShow() {
    // 这一页是私人的：右上角的转发菜单不转发这一页，只有分享面板里的按钮才能把某一条分享出去
    if (typeof wx.hideShareMenu === 'function') wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
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
    this.refreshDoor();
    // 刚加载过就不重复请求，免得每次切回来都闪一下
    const fresh = this._loadedAt && Date.now() - this._loadedAt < RELOAD_AFTER_MS && this.data.list.length > 0;
    if (fresh) return;
    this.loadPeriods();
    this.loadList(true);
  },

  // 觉察的门：推荐一个课程（输入框里关联的，或最近几天记过的），门上的那句话跟着这几天读的习惯走
  doorSource() {
    const { draftPeriodId, draftSectionId, draftSource, lastSource } = this.data;
    if (draftPeriodId && draftSource) return { periodId: draftPeriodId, sectionId: draftSectionId, label: draftSource };
    if (lastSource && lastSource.periodId && lastSource.savedAt && Date.now() - lastSource.savedAt < SOURCE_FRESH_MS) {
      return { periodId: lastSource.periodId, sectionId: lastSource.sectionId || '', label: lastSource.label };
    }
    return { periodId: '', sectionId: '', label: '' };
  },

  refreshDoor() {
    const source = this.doorSource();
    const dayKey = dayKeyOf();
    this.setData({
      doorLine: pickDoorLine(detectHabit(source.label), dayKey),
      placeholder: pickJoyPlaceholder(dayKey)
    });
  },

  // 推开门，坐下来：把推荐的课程带进静室
  openDoor() {
    const source = this.doorSource();
    wx.navigateTo({ url: this.buildAwarenessUrl({ source }) });
  },

  buildAwarenessUrl({ source = {}, seed = '' } = {}) {
    const enc = value => encodeURIComponent(value === undefined || value === null ? '' : String(value));
    const parts = [];
    if (source.periodId) {
      parts.push(`periodId=${enc(source.periodId)}`, `sectionId=${enc(source.sectionId || '')}`, `source=${enc(source.label || '')}`);
    }
    if (seed) parts.push(`seed=${enc(seed)}`);
    return `/pages/joy-notes/awareness/awareness${parts.length ? `?${parts.join('&')}` : ''}`;
  },

  // 长按一条随喜 →「从这句开始觉察」：这句话成为第一问的内容，原随喜保持不变
  startAwarenessFrom(item) {
    const source = item.periodId && item.sourceLabel && !item.sourceUnavailable
      ? { periodId: item.periodId, sectionId: item.sectionId || '', label: item.sourceLabel }
      : {};
    const seed = Array.from(String(item.content || '').trim()).slice(0, 300).join('');
    wx.navigateTo({ url: this.buildAwarenessUrl({ source, seed }) });
  },

  // 写到一半离开（接电话、切去读书），回来时文字还在
  restoreDraft() {
    const lastSource = readStore(LAST_SOURCE_KEY);
    const patch = { lastSource: lastSource && lastSource.label ? lastSource : null };
    if (!this.data.content && !this.data.editingId) {
      const draft = store.readJoyDraft();
      if (draft.content || draft.title) {
        patch.title = draft.title;
        patch.content = draft.content;
        patch.contentHtml = draft.html;
        patch.remaining = CONTENT_MAX - Array.from(draft.content).length;
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
    if (this.data.kindTab === 'checkin') {
      if (this.data.checkinsHasMore && !this.data.checkinsLoading && !this.data.checkinsError) this.loadCheckins(false);
      return;
    }
    if (this.data.hasMore && !this.data.loadingMore && !this.data.listError) this.loadList(false);
  },

  onUnload() {
    this.listSequence = (this.listSequence || 0) + 1;
    this.periodSequence = (this.periodSequence || 0) + 1;
    this.sectionSequence = (this.sectionSequence || 0) + 1;
    this.saveSequence = (this.saveSequence || 0) + 1;
    this.deleteSequence = (this.deleteSequence || 0) + 1;
    this.checkinSequence = (this.checkinSequence || 0) + 1;
  },

  clearPrivateState() {
    this.listSequence = (this.listSequence || 0) + 1;
    this.periodSequence = (this.periodSequence || 0) + 1;
    this.sectionSequence = (this.sectionSequence || 0) + 1;
    this.saveSequence = (this.saveSequence || 0) + 1;
    this.deleteSequence = (this.deleteSequence || 0) + 1;
    this.checkinSequence = (this.checkinSequence || 0) + 1;
    this.setData({
      kindTab: 'all',
      checkins: [],
      checkinsLoading: false,
      checkinsError: false,
      checkinsPage: 1,
      checkinsHasMore: false,
      doorLine: '',
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
      title: '',
      content: '',
      contentHtml: '',
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
      if (this.data.kindTab === 'joy' || this.data.kindTab === 'awareness') params.kind = this.data.kindTab;
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
        kind: item.kind === 'awareness' ? 'awareness' : 'joy',
        title: item.title || '',
        // 随喜带格式时用 rich-text 展示（折叠时仍显示纯文本摘要）
        richNodes: item.contentHtml ? richNote.toDisplayHtml(item.contentHtml) : '',
        view: awarenessView(item.awareness),
        // 觉察卡片只露出要点，不折叠
        foldable: item.kind !== 'awareness'
          && (Array.from(item.content || '').length > FOLD_LENGTH || String(item.content || '').split('\n').length > 4),
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
    // 觉察用「择」（要做的小动作）做日签，随喜用整段文字
    const quote = String(item.kind === 'awareness' ? (item.awareness && item.awareness.choice) || '' : item.content || '').trim();
    if (!quote) {
      wx.showToast({ title: '这条觉察没有写下小动作，先去详情里看看', icon: 'none' });
      return;
    }
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

  // 输入框（普通输入框或富文本编辑器）：普通输入给 { value }，输入框组件给 { text, html }
  onContentInput(event) {
    const detail = event.detail || {};
    const content = detail.text !== undefined ? detail.text : detail.value || '';
    const html = detail.html || '';
    const remaining = CONTENT_MAX - Array.from(content).length;
    this.setData({ content, contentHtml: html, remaining, showCounter: remaining <= CONTENT_MAX - COUNTER_SHOW_AT });
    // 新写的内容自动存草稿；编辑旧记录时不存，免得覆盖草稿
    if (!this.data.editingId) store.writeJoyDraft({ title: this.data.title, content, html });
  },

  // 标题：选填，最多 40 字
  onTitleInput(event) {
    const title = event.detail.value || '';
    this.setData({ title });
    if (!this.data.editingId) store.writeJoyDraft({ title, content: this.data.content, html: this.data.contentHtml });
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
    if (item) wx.setClipboardData({ data: item.title ? `${item.title}\n${item.content}` : item.content });
  },

  startEdit(event) {
    if (this.data.saving) return;
    const item = this.data.list.find(row => row._id === event.currentTarget.dataset.id);
    if (!item) return;
    this.setData({
      editingId: item._id,
      title: item.title || '',
      content: item.content,
      contentHtml: item.contentHtml || '',
      remaining: CONTENT_MAX - Array.from(item.content || '').length,
      draftPeriodId: item.periodId || '',
      draftSectionId: item.sectionId || '',
      draftSource: item.periodId ? item.sourceLabel : ''
    });
    if (typeof wx.pageScrollTo === 'function') wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },

  cancelEdit() {
    if (this.data.saving) return;
    this.setData({ editingId: '', title: '', content: '', contentHtml: '', remaining: CONTENT_MAX, showCounter: false, draftPeriodId: '', draftSectionId: '', draftSource: '' });
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
      const title = this.data.title.trim();
      if (this.data.contentHtml) data.contentHtml = this.data.contentHtml;
      if (this.data.editingId) {
        // 修改时标题一定带上（清空标题也要告诉服务端）
        data.title = title;
        await service.update(this.data.editingId, data);
      } else {
        if (title) data.title = title;
        await service.create(data);
      }
      if (sequence !== this.saveSequence) return;
      // 记住这次关联的期次和课程，下次一键沿用；草稿清掉
      const savedSource = this.data.draftPeriodId && this.data.draftSource
        ? { periodId: this.data.draftPeriodId, sectionId: this.data.draftSectionId, label: this.data.draftSource, savedAt: Date.now() }
        : null;
      if (savedSource) writeStore(LAST_SOURCE_KEY, savedSource);
      store.writeJoyDraft({});
      this.setData({
        title: '',
        content: '',
        contentHtml: '',
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
    const item = this.data.list.find(row => row._id === id);
    const isAwareness = Boolean(item && item.kind === 'awareness');
    const pendingRevisit = Boolean(item && item.awareness && item.awareness.revisit && item.awareness.revisit.status === 'pending');
    appDialog.showModal({
      title: isAwareness ? '删掉这条觉察？' : '删掉这条随喜？',
      content: pendingRevisit ? '删掉之后就找不回来了，一周后的回访来信也不会再送' : '删掉之后就找不回来了',
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

  // ---- 页签 ----
  onKindTab(event) {
    const tab = event.currentTarget.dataset.tab;
    if (!tab || tab === this.data.kindTab) return;
    this.listSequence = (this.listSequence || 0) + 1;
    this.checkinSequence = (this.checkinSequence || 0) + 1;
    this.setData(
      {
        kindTab: tab,
        list: [],
        page: 1,
        hasMore: false,
        loading: tab !== 'checkin',
        listError: false,
        checkins: [],
        checkinsPage: 1,
        checkinsHasMore: false,
        checkinsError: false
      },
      () => (tab === 'checkin' ? this.loadCheckins(true) : this.loadList(true))
    );
  },

  // 「打卡」页签：只列出本人的打卡，点开去打卡详情（不复制进觉察日记）
  async loadCheckins(reset) {
    const page = reset ? 1 : this.data.checkinsPage + 1;
    this.checkinSequence = (this.checkinSequence || 0) + 1;
    const sequence = this.checkinSequence;
    this.setData({ checkinsLoading: true, checkinsError: false });
    try {
      const options = { page, limit: CHECKIN_PAGE_SIZE };
      if (this.data.activePeriodId) options.periodId = this.data.activePeriodId;
      const result = await checkinService.getUserCheckinsWithStats(options);
      if (sequence !== this.checkinSequence) return;
      const rows = (result && result.list) || [];
      const items = rows.map(row => {
        const section = row.sectionId && typeof row.sectionId === 'object' ? row.sectionId : {};
        const period = row.periodId && typeof row.periodId === 'object' ? row.periodId : {};
        return {
          _id: String(row._id || row.id),
          sectionId: String(section._id || row.sectionId || ''),
          periodId: String(period._id || row.periodId || ''),
          dateLabel: dateLabel(row.checkinDate || row.createdAt),
          excerpt: checkinExcerpt(row.note),
          isPublic: row.isPublic !== false,
          sourceLabel: [period.name || period.title || '', section.title ? sectionLabel({ day: section.day, title: section.title }) : '']
            .filter(Boolean)
            .join(' · ')
        };
      });
      const checkins = reset ? items : this.data.checkins.concat(items);
      const total = (result && result.pagination && result.pagination.total) || 0;
      this.setData({
        checkins,
        checkinsPage: page,
        checkinsHasMore: checkins.length < total,
        checkinsLoading: false,
        checkinsError: false
      });
    } catch (error) {
      if (sequence !== this.checkinSequence) return;
      this.setData({ checkinsLoading: false, checkinsError: true });
    }
  },

  retryCheckins() {
    this.loadCheckins(true);
  },

  openCheckin(event) {
    const { id, section, period } = event.currentTarget.dataset;
    if (!id || !section) {
      wx.showToast({ title: '这条打卡没打开，稍后再试', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${section}&checkinId=${id}${period ? `&periodId=${period}` : ''}`
    });
  },

  // ---- 觉察详情 ----
  openDetail(event) {
    const id = (event && event.currentTarget && event.currentTarget.dataset.id) || (typeof event === 'string' ? event : '');
    if (!id) return;
    wx.navigateTo({ url: `/pages/joy-notes/detail/detail?id=${encodeURIComponent(id)}` });
  },

  // ---- 长按（或点 ⋯）出菜单：操作收进菜单，卡片更安静 ----
  openNoteMenu(event) {
    if (this.data.saving) return;
    const id = event.currentTarget.dataset.id;
    const item = this.data.list.find(row => row._id === id);
    if (!item) return;
    const fake = { currentTarget: { dataset: { id } } };
    const actions = item.kind === 'awareness'
      ? [
          { label: '查看', run: () => this.openDetail(fake) },
          { label: '分享', run: () => this.shareNote(item) },
          { label: '做成日签', run: () => this.makeCard(fake), hidden: !(item.awareness && item.awareness.choice) },
          { label: '复制', run: () => this.copyNote(fake) },
          { label: '删除', danger: true, run: () => this.confirmDelete(fake) }
        ]
      : [
          { label: '分享', run: () => this.shareNote(item) },
          { label: '做成日签', run: () => this.makeCard(fake) },
          { label: '复制', run: () => this.copyNote(fake) },
          { label: '编辑', run: () => this.startEdit(fake) },
          { label: '从这句开始觉察', run: () => this.startAwarenessFrom(item) },
          { label: '删除', danger: true, run: () => this.confirmDelete(fake) }
        ];
    const visible = actions.filter(action => !action.hidden);
    appDialog.showActionSheet({
      itemList: visible.map(action => (action.danger ? { label: action.label, danger: true } : action.label)),
      success: result => {
        const action = visible[result && result.tapIndex];
        if (action) action.run();
      }
    });
  },

  // ---- 分享：打开分享面板（转发、长图、谁能看、停止分享）----
  shareNote(item) {
    const sheet = this.selectComponent && this.selectComponent('#joy-share');
    if (!sheet || !item) return;
    const payload = sharePoster.payloadFromNote(item, {
      authorName: awarenessText.authorName(),
      sourceLabel: item.periodId && !item.sourceUnavailable ? item.sourceLabel : ''
    });
    sheet.open(payload);
  },

  // 面板里的「发给微信好友」按钮会触发这里；取不到分享信息时只转发首页，不会带出任何私人内容
  onShareAppMessage() {
    const sheet = this.selectComponent && this.selectComponent('#joy-share');
    const config = sheet && sheet.getShareConfig && sheet.getShareConfig();
    return config || { title: getDefaultShareTitle(), path: '/pages/index/index', imageUrl: getDefaultShareImage() };
  },

  noop() {}
});
