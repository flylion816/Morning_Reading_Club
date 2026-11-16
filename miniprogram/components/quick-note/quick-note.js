/**
 * 随喜速记条：在当前页面原地弹出的半屏输入框（首页「记一句」、沉浸阅读长按「记一条随喜」）。
 * 键盘直接弹起，今天这一课（或长按的那一段所在的课）自动带上；保存时服务端仍会校验报名与课程权限。
 *
 * 用法：
 *   <quick-note visible="{{v}}" period-id="{{pid}}" section-id="{{sid}}" source="{{label}}" quote="{{text}}"
 *     bind:close="onClose" bind:again="onAgain" />
 * 保存成功后会触发 saved 和 close；底部的「再记一句」触发 again，由页面重新把 visible 设为 true。
 */
const service = require('../../services/joy-note.service');
const store = require('../../utils/joy-note-store');
const { pickJoyPlaceholder } = require('../../utils/awareness-questions');

const CONTENT_MAX = 3000;
const QUOTE_MAX = 80;
const TOAST_MS = 3000;

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

Component({
  properties: {
    visible: { type: Boolean, value: false, observer: 'onVisibleChange' },
    periodId: { type: String, value: '' },
    sectionId: { type: String, value: '' },
    // 关联的来源文字，例如「第 12 期 · 第 7 天 知彼解己」
    source: { type: String, value: '' },
    // 阅读时长按的那一段（最多取 80 字）
    quote: { type: String, value: '' }
  },

  data: {
    title: '',
    content: '',
    // 带格式时才有值（点 Aa 设置了颜色、加粗之类）
    html: '',
    placeholder: '',
    focus: false,
    saving: false,
    keyboardHeight: 0,
    // 点 × 可以取消关联，再点一次恢复
    assocOn: true,
    toastVisible: false,
    contentMax: CONTENT_MAX
  },

  lifetimes: {
    detached() {
      clearTimeout(this._toastTimer);
      clearTimeout(this._focusTimer);
      this.stopKeyboardWatch();
    }
  },

  methods: {
    // 键盘弹起时，让半屏条贴着键盘上沿（编辑器不像输入框那样会通知键盘高度，所以用全局事件）
    startKeyboardWatch() {
      this.stopKeyboardWatch();
      if (typeof wx.onKeyboardHeightChange !== 'function') return;
      this._keyboardHandler = result => this.setData({ keyboardHeight: (result && result.height) || 0 });
      wx.onKeyboardHeightChange(this._keyboardHandler);
    },

    stopKeyboardWatch() {
      if (this._keyboardHandler && typeof wx.offKeyboardHeightChange === 'function') {
        wx.offKeyboardHeightChange(this._keyboardHandler);
      }
      this._keyboardHandler = null;
    },

    onVisibleChange(visible) {
      clearTimeout(this._focusTimer);
      if (!visible) {
        this.stopKeyboardWatch();
        this.setData({ focus: false, keyboardHeight: 0 });
        return;
      }
      clearTimeout(this._toastTimer);
      this.startKeyboardWatch();
      // 上次没写完的草稿还在就接着写；没有草稿且带着引用时，把那句话放进去（不覆盖正在写的话）
      const draft = store.readJoyDraft();
      let { title, content } = draft;
      const { html } = draft;
      const quote = Array.from(String(this.properties.quote || '').trim()).slice(0, QUOTE_MAX).join('');
      if (!content && quote) {
        content = `「${quote}」\n`;
        store.writeJoyDraft({ title, content, html: '' });
      }
      this.setData(
        {
          title,
          content,
          html: content ? html : '',
          placeholder: pickJoyPlaceholder(todayKey()),
          saving: false,
          assocOn: true,
          toastVisible: false,
          focus: false
        },
        () => {
          // 等半屏条画出来再聚焦，键盘才会稳稳弹起
          this._focusTimer = setTimeout(() => this.setData({ focus: true }), 80);
        }
      );
    },

    // 输入框（普通或富文本）：detail 是 { text, html }
    onInput(event) {
      const detail = event.detail || {};
      const content = detail.text !== undefined ? detail.text : detail.value || '';
      const html = detail.html || '';
      this.setData({ content, html });
      store.writeJoyDraft({ title: this.data.title, content, html });
    },

    onTitleInput(event) {
      const title = event.detail.value || '';
      this.setData({ title });
      store.writeJoyDraft({ title, content: this.data.content, html: this.data.html });
    },

    onKeyboardHeight(event) {
      this.setData({ keyboardHeight: (event.detail && event.detail.height) || 0 });
    },

    toggleAssociation() {
      this.setData({ assocOn: !this.data.assocOn });
    },

    close() {
      // 没保存就收起：草稿已经在本机，下次打开接着写
      if (this.data.saving) return;
      this.triggerEvent('close');
    },

    async save() {
      if (this.data.saving) return;
      const content = this.data.content.trim();
      if (!content) {
        wx.showToast({ title: '先写下一句话吧', icon: 'none' });
        return;
      }
      const useSource = this.data.assocOn && this.properties.periodId;
      const periodId = useSource ? this.properties.periodId : '';
      const sectionId = useSource ? this.properties.sectionId : '';
      this.setData({ saving: true });
      try {
        const payload = { content, periodId: periodId || null, sectionId: sectionId || null };
        const title = this.data.title.trim();
        if (title) payload.title = title;
        if (this.data.html) payload.contentHtml = this.data.html;
        await service.create(payload);
        // 记住这次关联，觉察日记页可以一键沿用；草稿清掉
        if (periodId && this.properties.source) {
          store.write(store.KEYS.lastSource, { periodId, sectionId, label: this.properties.source, savedAt: Date.now() });
        }
        store.writeJoyDraft({});
        this.setData({ title: '', content: '', html: '', saving: false, toastVisible: true });
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => this.setData({ toastVisible: false }), TOAST_MS);
        this.triggerEvent('saved');
        this.triggerEvent('close');
      } catch (error) {
        // 保存失败：文字和关联都保留，可以取消关联后重试
        this.setData({ saving: false });
        wx.showToast({ title: (error && error.message) || '没存上，再试一次', icon: 'none' });
      }
    },

    again() {
      clearTimeout(this._toastTimer);
      this.setData({ toastVisible: false });
      this.triggerEvent('again');
    },

    noop() {}
  }
});
