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
  const normalize = (day, index) => {
    const value = Number(day);
    if (!Number.isFinite(value)) return index + 1;
    return value;
  };
  // 圆点里的字：第 0 天是开营词，显示「开」；其余显示天数
  const markOf = day => (day === 0 ? '开' : String(day));
  // 格子下的短标签：去掉「第N天」前缀，取课名前 4 字
  const shortLabelOf = (day, title) => {
    if (day === 0) return '开营';
    const compact = String(title || '').replace(/^第?[一二三四五六七八九十百\d]+\s*[天日课]?\s*/u, '').trim();
    return compact ? compact.slice(0, 4) : `第${day}天`;
  };
  const build = (day, label, hasNotes, isRead, isToday, count, key) => ({
    key,
    day,
    mark: markOf(day),
    label,
    shortLabel: shortLabelOf(day, label),
    hasNotes,
    isRead,
    isToday,
    count
  });
  if (Array.isArray(source) && source.length) {
    return source.map((item, index) => {
      const day = normalize(item.day ?? item.lessonNumber ?? index + 1, index);
      return build(
        day,
        item.title || item.name || `第 ${day} 课`,
        item.hasNotes === true || item.hasNote === true || (item.hasNotes === undefined && item.hasNote === undefined && (item.count === undefined || Number(item.count) > 0)),
        item.isRead === true || (Number(item.readCount) > 0 && Number(item.unreadCount) === 0),
        item.isToday === true,
        Number(item.count || item.noteCount || 0),
        String(item.id || item.sectionId || item.day || index)
      );
    });
  }
  const byDay = new Map();
  notes.forEach(note => {
    (note.sectionDays || []).forEach(day => {
      const current = byDay.get(day) || { day, count: 0, isRead: true };
      current.hasNotes = true;
      current.isRead = current.isRead && note.isRead;
      current.count += 1;
      byDay.set(day, current);
    });
  });
  return Array.from(byDay.values())
    .sort((a, b) => a.day - b.day)
    .map(item => build(item.day, `第 ${item.day} 天`, true, item.isRead, false, item.count, String(item.day)));
}

function buildPeriodTabs(items = [], activePeriodId = '', activeScope = '', hasGeneralNotes = false) {
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
  // 「其他」只在没有绑定期次的手札真实存在时才出现
  if (hasGeneralNotes || activeScope === 'general') {
    tabs.push({ id: '', name: '其他', scope: 'general', active: activeScope === 'general' });
  }
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
    hasMore: false,
    // 日历筛选：选中的天（null = 看全部）
    selectedDay: null,
    selectedDayLabel: '',
    selectedDayCount: 0
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
    const hasDayPicked = day !== null && day !== undefined;
    return {
      title: hasDayPicked
        ? `陪伴手札 · ${scopeName}${dayText ? ' · ' + dayText : ''}${dayCount ? `，${dayCount} 篇等你翻开` : '，这一天还没有手札'}`
        : `陪伴手札 · ${scopeName}，每一课后的陪伴`,
      path: `/pages/companion-notes/list/list${query}`,
      // 只要是从专区分享就统一用日历封面；天数写进标题，图上的数字是示意
      imageUrl: '/assets/images/companion-share-day.png'
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
      // 「其他」tab 只在列表里真的有不属于任何期次的手札时才有意义
      const hasGeneralNotes = rows.some(note => !note.periodId);
      const periodItems = payload.periods || payload.periodTabs || payload.availablePeriods || notes
        .filter(note => note.periodId)
        .map(note => ({ id: note.periodId, name: note.periodName || '本期' }));
      const tabs = buildPeriodTabs(periodItems, this.data.activePeriodId, this.data.activeScope, hasGeneralNotes);
      const firstTab = tabs.find(tab => tab.active) || tabs[0];
      const activePeriodId = this.data.activeScope === 'general'
        ? ''
        : this.data.activePeriodId || (firstTab && firstTab.scope === 'period' ? firstTab.id : '');
      const latestRaw = payload.latestUnread || notes.find(item => !item.isRead) || overview.latestUnread || overview.latest || null;
      const latest = latestRaw && (latestRaw.id || latestRaw._id) ? decorateNote(latestRaw) : null;
      // 默认不选中某一天，呈现全部内容；只有外部分享链接带 day 参数进来时才定位到那天
      const trail = buildTrail(overview, notes);
      const dayParam = Number(this._initialDay);
      const selectedDay = Number.isFinite(dayParam) && dayParam >= 0 && trail.some(item => item.day === dayParam)
        ? dayParam
        : null;
      this._hasLoaded = true;
      this._loadingStarted = false;
      this._needsRefresh = false;
      this.setData({
        loading: false,
        loadingMore: false,
        error: false,
        notes,
        groups: this.buildGroupsForDay(notes, selectedDay),
        page,
        hasMore,
        periodTabs: tabs,
        activePeriodId,
        trail,
        latest,
        summary: buildSummary(overview, notes),
        selectedDay: selectedDay === null ? null : selectedDay,
        selectedDayLabel: this.dayLabel(trail, selectedDay),
        selectedDayCount: this.dayCount(notes, selectedDay)
      });
    } catch (error) {
      if (requestKey !== this._requestKey) return;
      this._loadingStarted = false;
      this.setData({ loading: false, loadingMore: false, error: true });
    }
  },

  // 按天过滤列表：selectedDay 为 null 时显示全部
  buildGroupsForDay(notes, selectedDay) {
    const filtered = selectedDay === null || selectedDay === undefined
      ? notes
      : notes.filter(note => (note.sectionDays || []).includes(selectedDay));
    return buildNoteGroups(filtered);
  },

  dayLabel(trail, day) {
    if (day === null || day === undefined) return '';
    const entry = (trail || []).find(item => item.day === day);
    return entry ? entry.label : `第 ${day} 课`;
  },

  dayCount(notes, day) {
    if (day === null || day === undefined) return 0;
    return notes.filter(note => (note.sectionDays || []).includes(day)).length;
  },

  handleTrailTap(event) {
    const day = Number(event.currentTarget.dataset.day);
    if (!Number.isFinite(day)) return;
    const next = this.data.selectedDay === day ? null : day;
    this.setData({
      selectedDay: next,
      selectedDayLabel: this.dayLabel(this.data.trail, next),
      selectedDayCount: this.dayCount(this.data.notes, next),
      groups: this.buildGroupsForDay(this.data.notes, next)
    });
  },

  handleTrailClear() {
    this.setData({
      selectedDay: null,
      selectedDayLabel: '',
      selectedDayCount: 0,
      groups: this.buildGroupsForDay(this.data.notes, null)
    });
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
    this.setData({ activeScope: scope === 'general' ? 'general' : '', activePeriodId: periodId, notes: [], groups: [], trail: [], latest: null, summary: { total: 0, readCount: 0, unreadCount: 0 }, page: 1, hasMore: false, selectedDay: null, selectedDayLabel: '', selectedDayCount: 0 }, () => this.loadList(true));
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
