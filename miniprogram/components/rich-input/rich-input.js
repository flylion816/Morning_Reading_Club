/**
 * 随喜 / 觉察的输入框：默认是普通输入框（键盘秒弹，速记不变慢），点「Aa」升级成和打卡页一样的富文本编辑器
 * （加粗、斜体、下划线、标题、列表、五种颜色、撤销重做）。内容已经带格式时，直接用编辑器打开。
 *
 * 用法：
 *   <rich-input value="{{content}}" html="{{contentHtml}}" placeholder="…" height="320" bind:input="onInput" />
 * input 事件的 detail 是 { text, html }：html 只有真正带格式时才有值，否则是空串。
 * 页面要把收到的 text / html 原样放回 value / html，组件靠这个分辨「自己发出去的」和「外部改的」。
 *
 * mode：auto（默认，点 Aa 升级）/ rich（一直是富文本）/ plain（只有普通输入框）
 */
const { THEME_PRIMARY } = require('../../utils/theme');
const rich = require('../../utils/rich-note');

const COLOR_OPTIONS = [
  { value: '#333333' },
  { value: THEME_PRIMARY },
  { value: '#168c91' },
  { value: '#d97706' },
  { value: '#dc2626' }
];

function normalizeFormats(formats = {}) {
  const normalized = { ...formats };
  if (normalized.color) normalized.color = rich.normalizeColor(normalized.color);
  return normalized;
}

Component({
  properties: {
    value: { type: String, value: '' },
    html: { type: String, value: '' },
    placeholder: { type: String, value: '' },
    maxlength: { type: Number, value: 3000 },
    // 输入区高度（rpx）
    height: { type: Number, value: 320 },
    focus: { type: Boolean, value: false },
    mode: { type: String, value: 'auto' },
    disabled: { type: Boolean, value: false }
  },

  data: {
    rich: false,
    text: '',
    formats: {},
    colorOptions: COLOR_OPTIONS
  },

  observers: {
    'value, html': function syncFromParent(value, html) {
      if (!this._attached) return;
      this.applyExternal(String(value || ''), String(html || ''));
    }
  },

  lifetimes: {
    attached() {
      this._attached = true;
      const html = String(this.properties.html || '');
      const text = String(this.properties.value || '');
      const useRich = this.properties.mode === 'rich' || (this.properties.mode === 'auto' && rich.hasFormatting(html));
      this._lastText = text;
      this._lastHtml = html;
      this._pendingHtml = useRich ? html || rich.plainTextToHtml(text) : '';
      this.setData({ rich: useRich, text });
    },
    detached() {
      this._attached = false;
      clearTimeout(this._formatTimer);
    }
  },

  methods: {
    // ---- 普通输入框 ----
    onTextInput(event) {
      this.emit(event.detail.value || '', '');
    },

    onFocus() {
      this.triggerEvent('focus');
    },

    onBlur() {
      this.triggerEvent('blur');
    },

    onKeyboardHeight(event) {
      this.triggerEvent('keyboardheight', { height: (event.detail && event.detail.height) || 0 });
    },

    // ---- 升级成富文本：当前文字原样带进编辑器 ----
    enableRich() {
      if (this.data.rich || this.properties.disabled) return;
      this._pendingHtml = rich.plainTextToHtml(this.data.text);
      this.setData({ rich: true });
      this.triggerEvent('modechange', { rich: true });
    },

    // ---- 编辑器 ----
    onEditorReady() {
      wx.createSelectorQuery()
        .in(this)
        .select('#ri-editor')
        .context(res => {
          this._ctx = res && res.context;
          this.applyEditorContent(this._pendingHtml);
        })
        .exec();
    },

    applyEditorContent(html) {
      if (!this._ctx) return;
      this._pendingHtml = html;
      if (!html) {
        this._ctx.clear && this._ctx.clear();
        return;
      }
      this._setting = true;
      this._ctx.setContents({
        html,
        success: () => {
          this._setting = false;
        },
        fail: () => {
          this._setting = false;
          const text = rich.htmlToPlainText(html);
          if (text && this._ctx.insertText) this._ctx.insertText({ text });
        }
      });
    },

    onEditorInput(event) {
      if (this._setting) return;
      const detail = (event && event.detail) || {};
      const text = String(detail.text || rich.htmlToPlainText(detail.html || '') || '').replace(/\n$/, '');
      const html = rich.normalizeHtml(detail.html, text);
      this.emit(text, rich.hasFormatting(html) ? html : '');
    },

    onStatusChange(event) {
      this.setData({ formats: normalizeFormats((event && event.detail) || {}) });
    },

    // 工具栏：和打卡页一样的格式切换（再点一次已选的颜色 / 样式就取消）
    handleFormat(event) {
      if (!this._ctx) return;
      const { name, value } = (event.currentTarget && event.currentTarget.dataset) || {};
      if (!name) return;
      const current = name === 'color' ? rich.normalizeColor(this.data.formats[name]) : this.data.formats[name];
      const next = name === 'color' ? rich.normalizeColor(value) : value;
      if (value) this._ctx.format(name, current === next ? false : next);
      else this._ctx.format(name, !current);
      this.refreshAfterFormat();
    },

    handleUndo() {
      if (this._ctx) this._ctx.undo();
    },

    handleRedo() {
      if (this._ctx) this._ctx.redo();
    },

    // 格式变了不一定触发 input，稍等一下主动读一次内容，让页面拿到最新的 HTML
    refreshAfterFormat() {
      if (!this._ctx || !this._ctx.getContents) return;
      clearTimeout(this._formatTimer);
      this._formatTimer = setTimeout(() => {
        this._ctx.getContents({
          success: res => {
            const text = String(res.text || rich.htmlToPlainText(res.html || '') || '').replace(/\n$/, '');
            if (!text) return;
            const html = rich.normalizeHtml(res.html, text);
            this.emit(text, rich.hasFormatting(html) ? html : '');
          }
        });
      }, 120);
    },

    // ---- 对外 ----
    emit(text, html) {
      this._lastText = text;
      this._lastHtml = html;
      this.setData({ text });
      this.triggerEvent('input', { text, html });
    },

    // 页面改了 value / html（清空、恢复草稿、开始编辑旧记录）：同步到输入框。自己发出去的内容原样回来时不处理
    applyExternal(value, html) {
      if (value === this._lastText && html === this._lastHtml) return;
      this._lastText = value;
      this._lastHtml = html;
      const formatted = rich.hasFormatting(html);
      if (formatted || this.properties.mode === 'rich') {
        const nextHtml = html || rich.plainTextToHtml(value);
        this.setData({ text: value });
        if (this.data.rich) {
          this.applyEditorContent(nextHtml);
        } else {
          this._pendingHtml = nextHtml;
          this.setData({ rich: true });
        }
        return;
      }
      if (this.data.rich) {
        if (!value && this.properties.mode === 'auto') {
          // 保存之后清空：下一条重新从普通输入框开始
          this._ctx = null;
          this._pendingHtml = '';
          this.setData({ rich: false, text: '', formats: {} });
        } else {
          this.setData({ text: value });
          this.applyEditorContent(rich.plainTextToHtml(value));
        }
        return;
      }
      this.setData({ text: value });
    },

    getContents() {
      return Promise.resolve({ text: this._lastText || '', html: this._lastHtml || '' });
    },

    noop() {}
  }
});
