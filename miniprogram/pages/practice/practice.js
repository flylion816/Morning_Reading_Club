const practiceService = require('../../services/practice.service');
const { requireLogin } = require('../../utils/require-login');

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function addDays(dayKey, n) {
  const t = Date.parse(`${dayKey}T00:00:00Z`) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

function shortDate(dayKey) {
  const parts = String(dayKey || '').split('-');
  return parts.length === 3 ? `${Number(parts[1])}月${Number(parts[2])}日` : '';
}

function buildDots(weekRange, logs, today) {
  if (!weekRange || !weekRange.from) return [];
  const map = {};
  (logs || []).forEach(log => {
    map[log.date] = log.done;
  });
  const dots = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekRange.from, i);
    if (weekRange.to && date > weekRange.to) break;
    dots.push({
      date,
      label: WEEK_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay()],
      state: map[date] === true ? 'done' : map[date] === false ? 'rest' : 'empty',
      isToday: date === today
    });
  }
  return dots;
}

Page({
  data: {
    periodId: '',
    status: 'loading', // loading | error | inactive | ready
    weekIndex: 1,
    rangeText: '',
    practice: null,
    suggestions: [],
    draft: '',
    editing: false,
    todayDone: null,
    todayNote: '',
    dots: [],
    saving: false,
    history: [],
    historyOpen: false
  },

  onLoad(options = {}) {
    this.setData({ periodId: options.periodId || '' });
  },

  onShow() {
    if (!this.data.periodId) {
      this.setData({ status: 'inactive' });
      return;
    }
    if (!requireLogin('登录后可以记录本周实修')) return;
    this.load();
  },

  async load() {
    this.setData({ status: 'loading' });
    try {
      const res = await practiceService.getCurrent(this.data.periodId);
      if (!res || res.active === false) {
        this.setData({ status: 'inactive' });
        return;
      }
      this.setData({
        status: 'ready',
        weekIndex: res.weekIndex,
        rangeText: `${shortDate(res.weekRange.from)} - ${shortDate(res.weekRange.to)}`,
        practice: res.practice,
        suggestions: res.suggestions || [],
        draft: res.practice ? res.practice.text : '',
        editing: false,
        todayDone: res.today ? res.today.done : null,
        todayNote: res.today ? res.today.note || '' : '',
        dots: buildDots(res.weekRange, res.logs, res.today && res.today.date)
      });
    } catch (error) {
      this.setData({ status: 'error' });
    }
  },

  onRetry() {
    this.load();
  },

  onPickSuggestion(e) {
    this.setData({ draft: e.currentTarget.dataset.text || '' });
  },

  onDraftInput(e) {
    this.setData({ draft: e.detail.value });
  },

  onEdit() {
    this.setData({ editing: true, draft: this.data.practice ? this.data.practice.text : '' });
  },

  async onConfirmPractice() {
    const text = (this.data.draft || '').trim();
    if (!text || this.data.saving) return;
    this.setData({ saving: true });
    try {
      await practiceService.setCurrent(this.data.periodId, text);
      this.setData({ saving: false });
      await this.load();
    } catch (error) {
      this.setData({ saving: false });
      wx.showToast({ title: '没存上，再试一次', icon: 'none' });
    }
  },

  onNoteInput(e) {
    this.setData({ todayNote: e.detail.value });
  },

  async onChooseToday(e) {
    const done = e.currentTarget.dataset.done === true || e.currentTarget.dataset.done === 'true';
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      await practiceService.logToday(this.data.periodId, done, (this.data.todayNote || '').trim());
      this.setData({ saving: false });
      await this.load();
    } catch (error) {
      this.setData({ saving: false });
      wx.showToast({ title: '没存上，再试一次', icon: 'none' });
    }
  },

  async onToggleHistory() {
    const open = !this.data.historyOpen;
    this.setData({ historyOpen: open });
    if (!open || this.historyLoaded) return;
    try {
      const res = await practiceService.getHistory(this.data.periodId);
      const current = this.data.weekIndex;
      const weeks = ((res && res.weeks) || [])
        .filter(w => w.weekIndex !== current)
        .map(w => ({
          weekIndex: w.weekIndex,
          rangeText: `${shortDate(w.weekRange.from)} - ${shortDate(w.weekRange.to)}`,
          text: w.practice.text,
          dots: buildDots(w.weekRange, w.logs, '')
        }));
      this.historyLoaded = true;
      this.setData({ history: weeks });
    } catch (error) {
      this.setData({ historyOpen: false });
      wx.showToast({ title: '往周暂时看不了', icon: 'none' });
    }
  }
});
