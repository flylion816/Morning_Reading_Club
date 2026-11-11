const letterService = require('../../services/letter.service');
const { tenantStorage } = require('../../utils/storage');
const constants = require('../../config/constants');

const MAX_CONTENT = 2000;
const MAX_REPLY = 200;
const STAMPS = [
  { key: 'dawn', label: '晨', name: '晨光', cls: 'app-seal app-seal-dawn' },
  { key: 'leaf', label: '叶', name: '新叶', cls: 'app-seal' },
  { key: 'book', label: '书', name: '书页', cls: 'app-seal app-seal-ink' }
];

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// 页面视图：write / draft-closed / closed / sealed / delivered / opened
function resolveView(letter) {
  if (letter.status === 'draft') return letter.canWrite ? 'write' : 'draft-closed';
  if (letter.status === 'sealed') return 'sealed';
  if (letter.status === 'delivered') return 'delivered';
  if (letter.status === 'opened') return 'opened';
  return letter.canWrite ? 'write' : 'closed';
}

Page({
  data: {
    periodId: '',
    needLogin: false,
    loading: true,
    loadError: false,
    view: '',
    letter: null,
    stamps: STAMPS,
    content: '',
    stamp: 'dawn',
    maxContent: MAX_CONTENT,
    maxReply: MAX_REPLY,
    prompt: '',
    writtenDate: '',
    replyText: '',
    opening: false,
    busy: false
  },

  async onLoad(options = {}) {
    this.setData({ periodId: options.periodId || '' });
    if (!tenantStorage.get(constants.STORAGE_KEYS.TOKEN)) {
      this.setData({ needLogin: true, loading: false });
      return;
    }
    await this.loadLetter();
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  async loadLetter() {
    if (!this.data.periodId) {
      this.setData({ loading: false, loadError: true });
      return;
    }
    this.setData({ loading: true, loadError: false });
    try {
      const letter = await letterService.getPeriodLetter(this.data.periodId);
      this.applyLetter(letter);
      this.setData({ loading: false });
    } catch (error) {
      this.setData({ loading: false, loadError: true });
    }
  },

  applyLetter(letter) {
    const days = letter.periodDays || letter.daysToDeliver || 0;
    this.setData({
      letter,
      view: resolveView(letter),
      content: letter.content !== undefined ? letter.content : this.data.content,
      stamp: letter.stamp || this.data.stamp,
      prompt: `${days} 天后，你希望自己有什么不一样？`,
      writtenDate: formatDate(letter.writtenAt)
    });
  },

  onRetry() {
    this.loadLetter();
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value });
  },

  onPickStamp(e) {
    this.setData({ stamp: e.currentTarget.dataset.key });
  },

  async onSaveDraft() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      const letter = await letterService.saveDraft(this.data.periodId, {
        content: this.data.content,
        stamp: this.data.stamp
      });
      this.applyLetter(letter);
      wx.showToast({ title: '草稿已保存', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '没保存上，再试一次', icon: 'none' });
    } finally {
      this.setData({ busy: false });
    }
  },

  onSeal() {
    if (this.data.busy) return;
    if (!String(this.data.content).trim()) {
      wx.showToast({ title: '先写点什么再投递', icon: 'none' });
      return;
    }
    const isSavedDraft = this.data.view === 'draft-closed';
    wx.showModal({
      title: isSavedDraft ? '封存这封草稿' : '投递这封信',
      content: isSavedDraft ? '封存后要到结营那天才能再打开，确定吗？' : '投递后要到结营那天才能再打开，确定吗？',
      confirmText: isSavedDraft ? '封存' : '投递',
      success: res => {
        if (res.confirm) this.doSeal();
      }
    });
  },

  async doSeal() {
    this.setData({ busy: true });
    try {
      // 写信窗口内先落草稿再封存；窗口关闭后的已有草稿直接封存，避免草稿被锁死。
      const isLockedDraft = this.data.view === 'draft-closed' ||
        (this.data.letter && this.data.letter.status === 'draft' && this.data.letter.canWrite === false);
      if (!isLockedDraft) {
        await letterService.saveDraft(this.data.periodId, {
          content: this.data.content,
          stamp: this.data.stamp
        });
      }
      const letter = await letterService.seal(this.data.periodId);
      this.applyLetter(letter);
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '没投出去，再试一次', icon: 'none' });
    } finally {
      this.setData({ busy: false });
    }
  },

  async onOpen() {
    if (this.data.busy || this.data.opening || !this.data.letter) return;
    this.setData({ busy: true, opening: true });
    let revealScheduled = false;
    try {
      const letter = await letterService.open(this.data.letter.id);
      revealScheduled = true;
      this.openTimer = setTimeout(() => {
        this.openTimer = null;
        this.applyLetter(letter);
        this.setData({ opening: false, busy: false });
      }, 700);
    } catch (error) {
      this.setData({ opening: false, busy: false });
      wx.showToast({ title: (error && error.message) || '这次没拆开，再试一次', icon: 'none' });
    } finally {
      if (!revealScheduled) this.setData({ busy: false });
    }
  },

  onReplyInput(e) {
    this.setData({ replyText: e.detail.value });
  },

  async onReply() {
    const text = String(this.data.replyText).trim();
    if (this.data.busy || !text) return;
    this.setData({ busy: true });
    try {
      const letter = await letterService.reply(this.data.letter.id, text);
      this.applyLetter(letter);
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '没寄出去，再试一次', icon: 'none' });
    } finally {
      this.setData({ busy: false });
    }
  },

  onUnload() {
    if (this.openTimer) clearTimeout(this.openTimer);
  }
});
