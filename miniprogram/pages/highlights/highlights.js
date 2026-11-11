const highlightService = require('../../services/highlight.service');
const { requireLogin } = require('../../utils/require-login');

const PAGE_SIZE = 20;
const REFRESH_INTERVAL_MS = 60 * 1000;
const MAX_QUOTE_LENGTH = 120;

function buildSource(item) {
  const parts = [];
  if (item.periodName) parts.push(item.periodName);
  if (item.day) parts.push(`第 ${item.day} 天`);
  if (item.sectionTitle) parts.push(item.sectionTitle);
  return parts.join(' · ');
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    error: false,
    list: [],
    periods: [],
    totalCount: 0,
    activePeriodId: '',
    page: 1,
    hasMore: false,
    editingId: '',
    editingNote: ''
  },

  onShow() {
    const loggedIn = this.loginPrompted ? this.hasToken() : requireLogin('登录后可以看到你的摘抄本');
    this.loginPrompted = true;
    if (!loggedIn) {
      this.setData({ loading: false });
      return;
    }
    // 首次进入，或离开超过一分钟再回来才整页刷新
    if (this.lastLoadedAt && Date.now() - this.lastLoadedAt < REFRESH_INTERVAL_MS) return;
    this.loadList(true);
  },

  hasToken() {
    const { tenantStorage } = require('../../utils/storage');
    const constants = require('../../config/constants');
    return !!tenantStorage.get(constants.STORAGE_KEYS.TOKEN);
  },

  onPullDownRefresh() {
    return Promise.resolve(this.loadList(true)).then(() => {
      if (typeof wx.stopPullDownRefresh === 'function') wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) this.loadList(false);
  },

  async loadList(reset) {
    const page = reset ? 1 : this.data.page + 1;
    this.requestSeq = (this.requestSeq || 0) + 1;
    const seq = this.requestSeq;
    this.setData(reset ? { loading: !this.data.list.length, error: false } : { loadingMore: true });
    try {
      const params = { page, limit: PAGE_SIZE };
      if (this.data.activePeriodId) params.periodId = this.data.activePeriodId;
      const data = (await highlightService.getMine(params)) || {};
      if (seq !== this.requestSeq) return;
      const items = (data.list || []).map(item => ({ ...item, source: buildSource(item) }));
      const list = reset ? items : this.data.list.concat(items);
      const total = data.total || 0;
      const update = {
        list,
        page,
        hasMore: list.length < total,
        loading: false,
        loadingMore: false,
        error: false
      };
      if (data.periods) {
        update.periods = data.periods;
        if (!this.data.activePeriodId) {
          update.totalCount = data.periods.reduce((sum, p) => sum + (p.count || 0), 0);
        }
      }
      this.lastLoadedAt = Date.now();
      this.setData(update);
    } catch (e) {
      if (seq !== this.requestSeq) return;
      this.setData({ loading: false, loadingMore: false, error: true });
    }
  },

  handleRetry() {
    this.loadList(true);
  },

  handleSelectPeriod(e) {
    const id = e.currentTarget.dataset.id || '';
    if (id === this.data.activePeriodId) return;
    this.setData({ activePeriodId: id, editingId: '' }, () => this.loadList(true));
  },

  handleStartEdit(e) {
    const { id } = e.currentTarget.dataset;
    const item = this.data.list.find(i => i._id === id);
    if (!item) return;
    this.setData({ editingId: id, editingNote: item.note || '' });
  },

  handleNoteInput(e) {
    this.setData({ editingNote: e.detail.value });
  },

  handleCancelEdit() {
    this.setData({ editingId: '', editingNote: '' });
  },

  async handleSaveNote() {
    const { editingId, editingNote } = this.data;
    if (!editingId) return;
    try {
      await highlightService.updateNote(editingId, editingNote);
      const list = this.data.list.map(i =>
        i._id === editingId ? { ...i, note: editingNote.trim() } : i
      );
      this.setData({ list, editingId: '', editingNote: '' });
    } catch (e) {
      wx.showToast({ title: '没存上，再试一次', icon: 'none' });
    }
  },

  handleDelete(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '删掉这条摘抄？',
      content: '删掉之后就找不回来了',
      confirmText: '删除',
      success: res => {
        if (res.confirm) this.removeItem(id);
      }
    });
  },

  async removeItem(id) {
    try {
      await highlightService.removeHighlight(id);
      const list = this.data.list.filter(i => i._id !== id);
      this.setData({ list, totalCount: Math.max(this.data.totalCount - 1, 0) });
      this.loadList(true);
    } catch (e) {
      wx.showToast({ title: '没删掉，再试一次', icon: 'none' });
    }
  },

  handleMakeCard(e) {
    const item = this.data.list.find(i => i._id === e.currentTarget.dataset.id);
    if (!item) return;
    const quote = encodeURIComponent(Array.from(item.text).slice(0, MAX_QUOTE_LENGTH).join(''));
    const source = encodeURIComponent(item.source || '');
    wx.navigateTo({ url: `/pages/daily-card/daily-card?quote=${quote}&source=${source}` });
  }
});
