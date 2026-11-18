const service = require('../../../services/companion-note.service');
const { getUserAvatarDisplay } = require('../../../utils/avatar');

const PAGE_SIZE = 20;

function decode(value = '') {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return String(value || '');
  }
}

function payloadOf(result) {
  if (!result || typeof result !== 'object') return {};
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) return result.data;
  return result;
}

function formatLessonRange(note = {}) {
  const days = (note.sectionDays || []).filter(day => Number.isFinite(day)).sort((a, b) => a - b);
  if (days.length > 1) {
    const first = days[0];
    const last = days[days.length - 1];
    return first === last ? `第 ${first} 课` : `第 ${first}–${last} 课`;
  }
  if (days.length === 1) return `第 ${days[0]} 课`;
  return note.sectionLabels && note.sectionLabels.length
    ? note.sectionLabels.join('、')
    : '不限课次';
}

function decorateNote(item = {}) {
  const note = service.normalizeNote(item);
  const author = item.companion || item.author || {};
  const avatar = getUserAvatarDisplay(author, {
    userId: note.companionUserId,
    displayName: note.companionName
  });
  return {
    ...note,
    lessonLabel: item.lessonLabel || formatLessonRange(note),
    metaLine: [note.companionName, note.pageCount ? `${note.pageCount} 页` : ''].filter(Boolean).join(' · '),
    dateLabel: formatDate(note.publishedAt),
    companionAvatar: avatar,
    latestLabel: note.isNew ? '新到的手札' : '',
    readLabel: note.isRead ? '读过' : ''
  };
}

function formatDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日`;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function groupKey(note) {
  const days = (note.sectionDays || []).filter(day => Number.isFinite(day));
  const firstDay = days.length ? Math.min(...days) : 0;
  return `${firstDay}:${note.sectionIds[0] || note.lessonLabel || 'general'}`;
}

function groupLabel(note) {
  return note.lessonLabel || '不限课次';
}

function buildNoteGroups(notes = []) {
  const groups = new Map();
  (Array.isArray(notes) ? notes : []).forEach(note => {
    const key = groupKey(note);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: groupLabel(note),
        day: note.sectionDays && note.sectionDays.length ? Math.min(...note.sectionDays) : 0,
        items: []
      });
    }
    groups.get(key).items.push(note);
  });
  return Array.from(groups.values())
    .map(group => ({
      ...group,
      items: group.items.sort((a, b) => (a.sortOrder - b.sortOrder) || (new Date(b.publishedAt) - new Date(a.publishedAt)))
    }))
    .sort((a, b) => (b.day - a.day) || a.label.localeCompare(b.label, 'zh-CN'));
}

function buildTrail(overview = {}, notes = []) {
  const source = overview.trail || overview.footprint || overview.footprints || overview.sections || [];
  if (Array.isArray(source) && source.length) {
    return source.map((item, index) => ({
      key: String(item.id || item.sectionId || item.day || index),
      day: Number(item.day || item.lessonNumber || index + 1),
      label: item.title || item.name || `第 ${Number(item.day || item.lessonNumber || index + 1)} 课`,
      hasNotes: item.hasNotes === true || item.hasNote === true || (item.hasNotes === undefined && item.hasNote === undefined && (item.count === undefined || Number(item.count) > 0)),
      isRead: item.isRead === true || (Number(item.readCount) > 0 && Number(item.unreadCount) === 0),
      isToday: item.isToday === true,
      count: Number(item.count || item.noteCount || 0)
    }));
  }
  const byDay = new Map();
  notes.forEach(note => {
    (note.sectionDays || []).forEach(day => {
      const current = byDay.get(day) || { day, label: `第 ${day} 课`, hasNotes: false, isRead: true, count: 0 };
      current.hasNotes = true;
      current.isRead = current.isRead && note.isRead;
      current.count += 1;
      byDay.set(day, current);
    });
  });
  return Array.from(byDay.values()).sort((a, b) => a.day - b.day).map(item => ({ ...item, key: String(item.day), isToday: false }));
}

function buildPeriodTabs(items = [], activePeriodId = '', activeScope = '') {
  const tabs = [];
  const seen = new Set();
  (Array.isArray(items) ? items : []).forEach(item => {
    const id = String(item.id || item._id || item.periodId || '');
    if (!id || seen.has(id)) return;
    seen.add(id);
    tabs.push({
      id,
      name: item.name || item.title || '本期',
      scope: item.scope || 'period',
      active: id === activePeriodId && activeScope !== 'general'
    });
  });
  if (!tabs.some(item => item.active) && tabs.length && !activeScope) tabs[0].active = true;
  tabs.push({ id: '', name: '全营', scope: 'general', active: activeScope === 'general' });
  return tabs;
}

function buildSummary(payload = {}, notes = []) {
  const overview = payload.overview && typeof payload.overview === 'object' ? payload.overview : payload;
  const total = Number(
    overview.totalCount ?? overview.noteCount ?? overview.total ?? payload.total ?? notes.length
  ) || 0;
  const readCount = Number(
    overview.readCount ?? overview.readTotal ?? overview.read ?? notes.filter(note => note.isRead).length
  ) || 0;
  return { total, readCount, unreadCount: Math.max(total - readCount, 0) };
}

Page({
  buildNoteGroups,
  buildTrail,
  buildPeriodTabs,
  formatLessonRange,

  data: {
    loading: true,
    loadingMore: false,
    error: false,
    activePeriodId: '',
    activeScope: '',
    periodTabs: [],
    summary: { total: 0, readCount: 0, unreadCount: 0 },
    trail: [],
    latest: null,
    groups: [],
    notes: [],
    page: 1,
    hasMore: false
  },

  onLoad(options = {}) {
    this._initialPeriodId = decode(options.periodId || '');
    this._initialScope = options.scope === 'general' ? 'general' : '';
    this._initialDay = decode(options.day || '');
    this.setData({
      activePeriodId: this._initialPeriodId,
      activeScope: this._initialScope
    });
    // 专区可以被分享：分享出去带期次和选中的天，收的人点开直达那一天的手札
    if (typeof wx.showShareMenu === 'function') {
      wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] });
    }
    this.loadList(true);
  },

  onShareAppMessage() {
    const periodTab = this.data.periodTabs.find(tab => tab.active) || {};
    const periodId = this.data.activeScope === 'general' ? '' : (this.data.activePeriodId || '');
    const day = this.data.selectedDay;
    const dayEntry = this.data.trail.find(item => item.day === day);
    const dayCount = this.data.selectedDayCount || (dayEntry ? dayEntry.count : 0);
    const params = [];
    if (periodId) params.push(`periodId=${encodeURIComponent(periodId)}`);
    if (this.data.activeScope === 'general') params.push('scope=general');
    if (day !== null && day !== undefined) params.push(`day=${day}`);
    const query = params.length ? `?${params.join('&')}` : '';
    const scopeName = this.data.activeScope === 'general' ? '全营' : (periodTab.name || '本期');
    const dayText = dayEntry ? `第 ${dayEntry.day === 0 ? '0' : dayEntry.day} 天` : '';
    return {
      title: day !== null && dayCount
        ? `陪伴手札 · ${scopeName}${dayText ? ' · ' + dayText : ''}，${dayCount} 篇等你翻开`
        : `陪伴手札 · ${scopeName}，每一课后的陪伴`,
      path: `/pages/companion-notes/list/list${query}`,
      imageUrl: day !== null && dayCount
        ? '/assets/images/companion-share-day.png'
        : '/assets/images/companion-share-note.png'
    };
  },

  onShow() {
    if (this._hasLoaded && !this._needsRefresh) return;
    if (!this._hasLoaded && !this._loadingStarted) this.loadList(true);
  },

  onPullDownRefresh() {
    this.loadList(true).finally(() => wx.stopPullDownRefresh && wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore) this.loadList(false);
  },

  async loadList(reset = true) {
    if (this._loadingStarted && reset && this.data.loading) return;
    this._loadingStarted = true;
    const page = reset ? 1 : this.data.page + 1;
    const requestKey = `${this.data.activePeriodId}:${this.data.activeScope}:${page}`;
    this._requestKey = requestKey;
    this.setData(reset
      ? { loading: this.data.notes.length === 0, error: false }
      : { loadingMore: true, error: false });
    try {
      const params = { page, limit: PAGE_SIZE };
      if (this.data.activeScope === 'general') params.scope = 'general';
      else if (this.data.activePeriodId) params.periodId = this.data.activePeriodId;
      const response = await service.getList(params);
      if (requestKey !== this._requestKey) return;
      const payload = payloadOf(response);
      let overviewPayload = {};
      if (this.data.activeScope !== 'general' && this.data.activePeriodId && !payload.sections && !payload.overview) {
        try {
          overviewPayload = payloadOf(await service.getOverview(this.data.activePeriodId));
        } catch (error) {
          overviewPayload = {};
        }
      }
      const rows = service.listFrom(payload).map(decorateNote);
      const previous = reset ? [] : this.data.notes;
      const notes = previous.concat(rows);
      const pagination = payload.pagination || response?.pagination || {};
      const hasMore = pagination.hasNext !== undefined
        ? !!pagination.hasNext
        : pagination.totalPages !== undefined
          ? page < Number(pagination.totalPages)
          : pagination.total !== undefined
            ? notes.length < Number(pagination.total)
            : rows.length >= PAGE_SIZE;
      const overview = Object.keys(overviewPayload).length ? overviewPayload : payload;
      const periodItems = payload.periods || payload.periodTabs || payload.availablePeriods || notes
        .filter(note => note.periodId)
        .map(note => ({ id: note.periodId, name: note.periodName || '本期' }));
      const tabs = buildPeriodTabs(periodItems, this.data.activePeriodId, this.data.activeScope);
      const firstTab = tabs.find(tab => tab.active) || tabs[0];
      const activePeriodId = this.data.activeScope === 'general'
        ? ''
        : this.data.activePeriodId || (firstTab && firstTab.scope === 'period' ? firstTab.id : '');
      const latestRaw = payload.latestUnread || notes.find(item => !item.isRead) || overview.latestUnread || overview.latest || null;
      const latest = latestRaw && (latestRaw.id || latestRaw._id) ? decorateNote(latestRaw) : null;
      this._hasLoaded = true;
      this._loadingStarted = false;
      this._needsRefresh = false;
      this.setData({
        loading: false,
        loadingMore: false,
        error: false,
        notes,
        groups: buildNoteGroups(notes),
        page,
        hasMore,
        periodTabs: tabs,
        activePeriodId,
        trail: buildTrail(overview, notes),
        latest,
        summary: buildSummary(overview, notes)
      });
    } catch (error) {
      if (requestKey !== this._requestKey) return;
      this._loadingStarted = false;
      this.setData({ loading: false, loadingMore: false, error: true });
    }
  },

  retry() {
    this.loadList(true);
  },

  handleTabTap(event) {
    const item = event.currentTarget.dataset.item || {};
    const scope = item.scope === 'general' ? 'general' : 'period';
    const periodId = scope === 'general' ? '' : String(item.id || '');
    if (scope === this.data.activeScope && periodId === this.data.activePeriodId) return;
    this._hasLoaded = false;
    this.setData({ activeScope: scope === 'general' ? 'general' : '', activePeriodId: periodId, notes: [], groups: [], trail: [], latest: null, summary: { total: 0, readCount: 0, unreadCount: 0 }, page: 1, hasMore: false }, () => this.loadList(true));
  },

  openNote(event) {
    const noteId = event.currentTarget.dataset.id;
    if (!noteId) return;
    wx.navigateTo({ url: `/pages/companion-notes/detail/detail?id=${encodeURIComponent(noteId)}` });
  },

  openLatest() {
    if (this.data.latest && this.data.latest.id) this.openNote({ currentTarget: { dataset: { id: this.data.latest.id } } });
  },

  noop() {}
});

module.exports = { buildNoteGroups, buildTrail, buildPeriodTabs, formatLessonRange, decorateNote };
