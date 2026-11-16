/**
 * 觉察详情：看、感、问、择、后来排成一条从夜到晨的线。
 * 「后来」可以写多次，每次带日期；从来信里的回访卡片进来时直接打开输入框。
 */
const service = require('../../../services/joy-note.service');
const appDialog = require('../../../utils/dialog');
const { requireLogin } = require('../../../utils/require-login');
const text = require('../awareness-text');
const richNote = require('../../../utils/rich-note');
const sharePoster = require('../share-poster');
const { getDefaultShareTitle, getDefaultShareImage } = require('../../../utils/brand');

const JOURNAL_ROUTE = 'pages/joy-notes/joy-notes';
const FOLLOW_UP_MAX = 500;

function decode(value) {
  try {
    return decodeURIComponent(value || '');
  } catch (error) {
    return String(value || '');
  }
}

function sourceLabel(note) {
  if (note.sourceUnavailable) return '关联的期次当前不可用';
  const parts = [];
  if (note.periodName) parts.push(note.periodName);
  if (note.sectionTitle) {
    const day = note.day === null || note.day === undefined ? NaN : Number(note.day);
    const dayText = Number.isFinite(day) ? (day === 0 ? '开篇' : `第 ${day} 天`) : '';
    parts.push([dayText, note.sectionTitle].filter(Boolean).join(' · '));
  }
  return parts.join(' · ');
}

function revisitLine(awareness) {
  const revisit = (awareness && awareness.revisit) || {};
  if (revisit.status === 'pending') return `${text.monthDay(revisit.dueAt)} 早上 6:00，来信问问你做得怎样`;
  if (revisit.status === 'delivered') return '回访来信已经送到，写一句后来吧';
  return '';
}

// 带格式的内容交给 rich-text 展示；没有格式就是空串，页面用纯文本
function nodesOf(html) {
  return html ? richNote.toDisplayHtml(html) : '';
}

function buildView(note) {
  const awareness = note.awareness || {};
  return {
    title: note.title || '',
    dateLabel: text.dateWithDaypart(note.createdAt),
    sourceLabel: sourceLabel(note),
    facts: awareness.facts || '',
    factsNodes: nodesOf(awareness.factsHtml),
    feelings: awareness.feelings || [],
    bodyAreas: awareness.bodyAreas || [],
    bodyText: (awareness.bodyAreas || []).join('、'),
    feelingNote: awareness.feelingNote || '',
    asks: (awareness.asks || []).map(ask => ({
      label: text.LEVEL_LABELS[(ask.level || 1) - 1] || '问',
      question: ask.question || '',
      answer: ask.answer || '',
      answerNodes: nodesOf(ask.answerHtml)
    })),
    choice: awareness.choice || '',
    choiceNodes: nodesOf(awareness.choiceHtml),
    followUps: (awareness.followUps || []).map(item => ({
      content: item.content,
      dateLabel: text.monthDay(item.createdAt)
    })),
    revisitLine: revisitLine(awareness)
  };
}

Page({
  data: {
    loading: true,
    error: false,
    gone: false,
    note: null,
    view: null,
    followUpOpen: false,
    followUpText: '',
    saving: false,
    // 改标题
    titleEditing: false,
    titleDraft: ''
  },

  onLoad(options = {}) {
    this._id = decode(options.id);
    this._focusInput = options.focus === '1';
    // 这一页是私人的：右上角的转发菜单不转发它，只有分享面板里的按钮才能分享
    if (typeof wx.hideShareMenu === 'function') wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    if (!requireLogin('登录后可以回看自己的觉察')) return;
    this.load();
  },

  async load() {
    if (!this._id) {
      this.setData({ loading: false, gone: true });
      return;
    }
    this.setData({ loading: true, error: false, gone: false });
    try {
      const note = await service.getOne(this._id);
      if (!note || note.kind !== 'awareness') {
        this.setData({ loading: false, gone: true });
        return;
      }
      this.setData({
        loading: false,
        note,
        view: buildView(note),
        followUpOpen: this._focusInput || this.data.followUpOpen
      });
      this._focusInput = false;
    } catch (error) {
      const message = (error && error.message) || '';
      if ((error && (error.code === 404 || error.statusCode === 404)) || /不存在/.test(message)) {
        this.setData({ loading: false, gone: true });
        return;
      }
      this.setData({ loading: false, error: true });
    }
  },

  // ---- 后来 ----
  toggleFollowUp() {
    this.setData({ followUpOpen: !this.data.followUpOpen });
  },

  onFollowUpInput(event) {
    this.setData({ followUpText: event.detail.value || '' });
  },

  async saveFollowUp() {
    if (this.data.saving) return;
    const content = this.data.followUpText.trim();
    if (!content) {
      wx.showToast({ title: '先写一句，再记下', icon: 'none' });
      return;
    }
    if (Array.from(content).length > FOLLOW_UP_MAX) {
      wx.showToast({ title: `最多 ${FOLLOW_UP_MAX} 字`, icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      const note = await service.addFollowUp(this._id, content);
      this.markJournalStale();
      this.setData({ saving: false, note, view: buildView(note), followUpText: '', followUpOpen: false });
      wx.showToast({ title: '记下了', icon: 'success' });
    } catch (error) {
      this.setData({ saving: false });
      wx.showToast({ title: (error && error.message) || '没记上，再试一次', icon: 'none' });
    }
  },

  // ---- 菜单：复制全文 / 做成日签 / 删除 ----
  openMenu() {
    const view = this.data.view;
    if (!view) return;
    const actions = [
      { label: view.title ? '改标题' : '起个标题', run: () => this.startRename() },
      { label: '分享', run: () => this.shareNote() },
      { label: '复制全文', run: () => this.copyAll() }
    ];
    if (view.choice) actions.push({ label: '做成日签', run: () => this.makeCard() });
    actions.push({ label: '删除', danger: true, run: () => this.confirmDelete() });
    appDialog.showActionSheet({
      itemList: actions.map(action => (action.danger ? { label: action.label, danger: true } : action.label)),
      success: result => {
        const action = actions[result && result.tapIndex];
        if (action) action.run();
      }
    });
  },

  // ---- 分享：打开分享面板（转发、长图、谁能看、停止分享）----
  shareNote() {
    const sheet = this.selectComponent && this.selectComponent('#joy-share');
    const { note, view } = this.data;
    if (!sheet || !note || !view) return;
    sheet.open(sharePoster.payloadFromNote(note, { authorName: text.authorName(), sourceLabel: view.sourceLabel }));
  },

  onShareAppMessage() {
    const sheet = this.selectComponent && this.selectComponent('#joy-share');
    const config = sheet && sheet.getShareConfig && sheet.getShareConfig();
    return config || { title: getDefaultShareTitle(), path: '/pages/index/index', imageUrl: getDefaultShareImage() };
  },

  // ---- 标题：觉察保存后唯一能改的就是标题 ----
  startRename() {
    this.setData({ titleEditing: true, titleDraft: (this.data.view && this.data.view.title) || '' });
  },

  onTitleInput(event) {
    this.setData({ titleDraft: event.detail.value || '' });
  },

  cancelRename() {
    this.setData({ titleEditing: false });
  },

  async saveTitle() {
    if (this.data.saving) return;
    const title = this.data.titleDraft.trim();
    this.setData({ saving: true });
    try {
      const note = await service.update(this._id, { title });
      this.markJournalStale();
      // 更新接口返回的记录不带期次名和课程名，沿用页面上已有的
      const merged = { ...this.data.note, title: note && note.title !== undefined ? note.title : title };
      this.setData({ saving: false, titleEditing: false, note: merged, view: buildView(merged) });
    } catch (error) {
      this.setData({ saving: false });
      wx.showToast({ title: (error && error.message) || '没存上，再试一次', icon: 'none' });
    }
  },

  copyAll() {
    const awareness = (this.data.note && this.data.note.awareness) || {};
    const lines = [];
    if (this.data.view && this.data.view.title) lines.push(this.data.view.title);
    lines.push(text.composeText(awareness));
    (awareness.followUps || []).forEach(item => lines.push(`后来：${item.content}`));
    wx.setClipboardData({ data: lines.filter(Boolean).join('\n') });
  },

  makeCard() {
    const choice = (this.data.view && this.data.view.choice) || '';
    if (!choice) return;
    if (Array.from(choice).length > 120) {
      wx.showToast({ title: '这句有点长，做日签要在 120 字以内', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/daily-card/daily-card?quote=${encodeURIComponent(choice)}` });
  },

  confirmDelete() {
    const pending = Boolean(this.data.note && this.data.note.awareness && this.data.note.awareness.revisit
      && this.data.note.awareness.revisit.status === 'pending');
    appDialog.showModal({
      title: '删掉这条觉察？',
      content: pending ? '删掉之后就找不回来了，一周后的回访来信也不会再送' : '删掉之后就找不回来了',
      confirmText: '删除',
      success: result => {
        if (result && result.confirm) this.deleteNote();
      }
    });
  },

  async deleteNote() {
    try {
      await service.remove(this._id);
      this.markJournalStale();
      wx.showToast({ title: '已删除', icon: 'success' });
      this.goBack();
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '没删掉，再试一次', icon: 'none' });
    }
  },

  // 回到日记页时让它重新读一遍列表
  markJournalStale() {
    try {
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
      const previous = pages[pages.length - 2];
      if (previous && previous.route === JOURNAL_ROUTE) previous._loadedAt = 0;
    } catch (error) {
      // 找不到上一页就算了
    }
  },

  goBack() {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.redirectTo({ url: `/${JOURNAL_ROUTE}` });
  },

  noop() {}
});
