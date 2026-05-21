const insightService = require('../../services/insight.service');
const { renderRichTextContent } = require('../../utils/markdown');

Page({
  data: {
    insightId: null,
    title: '',
    periodName: '',
    loading: true,
    saving: false
  },

  _editorCtx: null,
  _htmlContent: '',

  onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ insightId: options.id });
    this.loadInsight();
  },

  async loadInsight() {
    try {
      const insight = await insightService.getInsightDetail(this.data.insightId);
      const title = insight.sectionId?.title || insight.title || '小凡看见';
      const periodName = insight.periodId?.name || insight.periodId?.title || insight.periodName || '';
      // 转为 HTML 供富文本编辑器使用
      const html = renderRichTextContent(insight.content || '');
      this._htmlContent = html;
      this.setData({ title, periodName, loading: false });
      // editor ready 后填入内容（onEditorReady 里也会尝试填入）
      if (this._editorCtx) {
        this._setEditorContent(html);
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onEditorReady() {
    wx.createSelectorQuery()
      .in(this)
      .select('#insight-editor')
      .context(res => {
        this._editorCtx = res.context;
        if (this._htmlContent) {
          this._setEditorContent(this._htmlContent);
        }
      })
      .exec();
  },

  _setEditorContent(html) {
    this._editorCtx.setContents({
      html,
      success: () => {},
      fail: () => {
        // setContents 失败时降级用 delta 插入纯文本
        this._editorCtx.insertText({ text: '' });
      }
    });
  },

  onEditorInput(e) {
    // 实时保存 HTML 快照，供 handleSave 使用
    this._htmlContent = e.detail.html || '';
  },

  formatBold() {
    this._editorCtx && this._editorCtx.format('bold', true);
  },

  formatItalic() {
    this._editorCtx && this._editorCtx.format('italic', true);
  },

  formatHeader() {
    this._editorCtx && this._editorCtx.format('headerType', 'h2');
  },

  undoEdit() {
    this._editorCtx && this._editorCtx.undo();
  },

  redoEdit() {
    this._editorCtx && this._editorCtx.redo();
  },

  async handleSave() {
    const { insightId, saving } = this.data;
    if (saving) return;
    const html = this._htmlContent;
    if (!html || !html.replace(/<[^>]+>/g, '').trim()) {
      wx.showToast({ title: '内容不能为空', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await insightService.updateInsight(insightId, { content: html });
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1200);
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      this.setData({ saving: false });
    }
  },

  handleCancel() {
    wx.navigateBack();
  }
});
