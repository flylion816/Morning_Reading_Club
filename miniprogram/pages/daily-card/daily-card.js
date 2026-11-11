const { getBrandName, getDefaultShareImage, getDefaultShareTitle } = require('../../utils/brand');
const { getThemePrimaryColor } = require('../../utils/theme');
const {
  FONTS,
  CARD_WIDTH,
  QUOTE_MAX_LENGTH,
  NOTE_MAX_LENGTH,
  computeDailyCardLayout,
  getTodayKey
} = require('../../utils/daily-card-layout');

const PREVIEW_WIDTH_RPX = 600;
const PREVIEW_SCALE = PREVIEW_WIDTH_RPX / CARD_WIDTH;
const EXPORT_SCALE = 2;

const VARIANT_OPTIONS = [
  { value: 'dawn', label: '晨光' },
  { value: 'paper', label: '纸墨' },
  { value: 'blank', label: '留白' }
];

function safeDecode(value) {
  if (value === undefined || value === null) return '';
  try {
    return decodeURIComponent(String(value));
  } catch (error) {
    return String(value);
  }
}

function fontOf(el) {
  return `${el.weight === 'bold' ? 'bold' : 'normal'} ${el.size}px ${FONTS[el.family] || FONTS.sans}`;
}

// 把共用排版结果转成预览用的行内样式
function toPreviewItems(layout) {
  const s = PREVIEW_SCALE;
  const r = n => `${(n * s).toFixed(2)}rpx`;
  return layout.elements.map(el => {
    let style = 'position:absolute;';
    if (el.type === 'rect') {
      style += `left:${r(el.x)};top:${r(el.y)};width:${r(el.w)};height:${r(el.h)};background:${el.fill};`;
      if (el.radius) style += `border-radius:${r(el.radius)};`;
    } else if (el.type === 'gradient') {
      const stops = el.stops.map(([p, c]) => `${c} ${Math.round(p * 100)}%`).join(',');
      style += `left:${r(el.x)};top:${r(el.y)};width:${r(el.w)};height:${r(el.h)};background:linear-gradient(180deg,${stops});`;
    } else if (el.type === 'circle') {
      style += `left:${r(el.cx - el.r)};top:${r(el.cy - el.r)};width:${r(el.r * 2)};height:${r(el.r * 2)};border-radius:50%;background:${el.fill};`;
    } else if (el.type === 'frame') {
      style += `left:${r(el.x)};top:${r(el.y)};width:${r(el.w)};height:${r(el.h)};box-sizing:border-box;border:${r(el.lineWidth)} solid ${el.stroke};`;
    } else {
      style += `left:${r(el.x)};top:${r(el.y)};width:${r(el.w)};height:${r(el.h)};line-height:${r(el.h)};` +
        `font-size:${r(el.size)};color:${el.color};text-align:${el.align};white-space:nowrap;` +
        `font-weight:${el.weight === 'bold' ? 'bold' : 'normal'};font-family:${FONTS[el.family] || FONTS.sans};`;
    }
    return { id: el.id, style, text: el.type === 'text' ? el.text : '', placeholder: !!el.placeholder };
  });
}

Page({
  data: {
    variant: 'dawn',
    variantOptions: VARIANT_OPTIONS,
    quote: '',
    source: '',
    periodName: '',
    day: '',
    note: '',
    noteHidden: false,
    dateStr: '',
    previewItems: [],
    previewWidthRpx: PREVIEW_WIDTH_RPX,
    previewHeightRpx: 0,
    quoteMax: QUOTE_MAX_LENGTH,
    noteMax: NOTE_MAX_LENGTH,
    generating: false,
    editor: { visible: false, field: '', title: '', value: '', maxlength: 0, placeholder: '' }
  },

  onLoad(options = {}) {
    const dateParam = safeDecode(options.date);
    this.setData(
      {
        quote: safeDecode(options.quote).trim().slice(0, QUOTE_MAX_LENGTH),
        source: safeDecode(options.source).trim(),
        periodName: safeDecode(options.periodName).trim(),
        day: safeDecode(options.day).trim(),
        note: safeDecode(options.note).trim().slice(0, NOTE_MAX_LENGTH),
        dateStr: /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getTodayKey()
      },
      () => this.refreshPreview()
    );
  },

  buildLayout(forExport) {
    const d = this.data;
    return computeDailyCardLayout({
      variant: d.variant,
      quote: d.quote,
      source: d.source,
      periodName: d.periodName,
      day: d.day,
      note: d.noteHidden ? '' : d.note,
      dateStr: d.dateStr,
      brandName: getBrandName(),
      primaryColor: getThemePrimaryColor(),
      placeholder: !forExport
    });
  },

  refreshPreview() {
    const layout = this.buildLayout(false);
    this._posterCache = null;
    this.setData({
      previewItems: toPreviewItems(layout),
      previewHeightRpx: Math.round(layout.height * PREVIEW_SCALE)
    });
  },

  handleSelectVariant(e) {
    const variant = e.currentTarget.dataset.value;
    if (!variant || variant === this.data.variant) return;
    this.setData({ variant }, () => this.refreshPreview());
  },

  // ---- 编辑 ----
  openEditor(field) {
    const isQuote = field === 'quote';
    this.setData({
      editor: {
        visible: true,
        field,
        title: isQuote ? '今日一句' : '我想说',
        value: isQuote ? this.data.quote : this.data.note,
        maxlength: isQuote ? QUOTE_MAX_LENGTH : NOTE_MAX_LENGTH,
        placeholder: isQuote ? '写下今天想留下的一句话' : '写一句自己的话'
      }
    });
  },

  handleEditQuote() {
    this.openEditor('quote');
  },

  handleEditNote() {
    this.openEditor('note');
  },

  handleEditorInput(e) {
    this.setData({ 'editor.value': e.detail.value });
  },

  handleEditorCancel() {
    this.setData({ 'editor.visible': false });
  },

  handleEditorConfirm() {
    const { field, value, maxlength } = this.data.editor;
    const next = String(value || '').trim().slice(0, maxlength);
    const update = { 'editor.visible': false };
    if (field === 'quote') {
      update.quote = next;
    } else {
      update.note = next;
      update.noteHidden = false;
    }
    this.setData(update, () => this.refreshPreview());
  },

  handleToggleNote() {
    this.setData({ noteHidden: !this.data.noteHidden }, () => this.refreshPreview());
  },

  noop() {},

  // ---- 画布 ----
  getCanvasNode() {
    return new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#dailyCardCanvas')
        .fields({ node: true, size: true })
        .exec(result => {
          const target = result && result[0];
          if (!target || !target.node) {
            reject(new Error('找不到日签画布'));
            return;
          }
          resolve(target.node);
        });
    });
  },

  drawRoundedPath(ctx, x, y, w, h, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y, x + w, y + radius, radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  },

  drawLayout(ctx, layout) {
    ctx.fillStyle = layout.background;
    ctx.fillRect(0, 0, layout.width, layout.height);
    layout.elements.forEach(el => {
      if (el.type === 'rect') {
        if (el.radius) {
          this.drawRoundedPath(ctx, el.x, el.y, el.w, el.h, el.radius);
          ctx.fillStyle = el.fill;
          ctx.fill();
        } else {
          ctx.fillStyle = el.fill;
          ctx.fillRect(el.x, el.y, el.w, el.h);
        }
      } else if (el.type === 'gradient') {
        const grad = ctx.createLinearGradient(0, el.y, 0, el.y + el.h);
        el.stops.forEach(([p, c]) => grad.addColorStop(p, c));
        ctx.fillStyle = grad;
        ctx.fillRect(el.x, el.y, el.w, el.h);
      } else if (el.type === 'circle') {
        ctx.beginPath();
        ctx.arc(el.cx, el.cy, el.r, 0, Math.PI * 2);
        ctx.fillStyle = el.fill;
        ctx.fill();
      } else if (el.type === 'frame') {
        ctx.strokeStyle = el.stroke;
        ctx.lineWidth = el.lineWidth;
        ctx.strokeRect(el.x, el.y, el.w, el.h);
      } else if (el.type === 'text') {
        ctx.font = fontOf(el);
        ctx.fillStyle = el.color;
        ctx.textBaseline = 'middle';
        ctx.textAlign = el.align;
        const tx = el.align === 'center' ? el.x + el.w / 2 : el.align === 'right' ? el.x + el.w : el.x;
        ctx.fillText(el.text, tx, el.y + el.h / 2);
      }
    });
  },

  async generatePoster() {
    const layout = this.buildLayout(true);
    const key = JSON.stringify(layout.elements);
    if (this._posterCache && this._posterCache.key === key) {
      return this._posterCache.path;
    }
    const canvas = await this.getCanvasNode();
    const ctx = canvas.getContext('2d');
    const info = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : {};
    const dpr = Math.min((info && info.pixelRatio) || 2, 2);
    canvas.width = layout.width * dpr;
    canvas.height = layout.height * dpr;
    if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    this.drawLayout(ctx, layout);

    const path = await new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        width: layout.width,
        height: layout.height,
        destWidth: layout.width * EXPORT_SCALE,
        destHeight: layout.height * EXPORT_SCALE,
        fileType: 'png',
        success: res => resolve(res.tempFilePath),
        fail: reject
      });
    });
    this._posterCache = { key, path };
    return path;
  },

  // ---- 保存 ----
  async handleSave() {
    if (this.data.generating) return;
    this.setData({ generating: true });
    wx.showLoading({ title: '生成中...', mask: true });
    let filePath;
    try {
      filePath = await this.generatePoster();
    } catch (error) {
      console.error('生成日签失败:', error);
      wx.hideLoading();
      this.setData({ generating: false });
      wx.showToast({ title: '这次没生成出来，可以先截屏保存', icon: 'none' });
      return;
    }
    wx.hideLoading();
    this.setData({ generating: false });
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: err => this.handleSaveFail(err)
    });
  },

  handleSaveFail(err) {
    const msg = String((err && err.errMsg) || '');
    if (msg.includes('cancel')) return;
    if (msg.includes('auth deny') || msg.includes('authorize') || msg.includes('auth denied')) {
      wx.showModal({
        title: '需要相册权限',
        content: '保存日签需要允许访问相册，去设置里打开就好。',
        confirmText: '去设置',
        success: res => {
          if (res.confirm) wx.openSetting({});
        }
      });
      return;
    }
    wx.showToast({ title: '这次没保存上，再试一次', icon: 'none' });
  },

  // ---- 分享 ----
  onShareAppMessage() {
    const fallback = {
      title: getDefaultShareTitle('晨读日签'),
      path: '/pages/index/index',
      imageUrl: getDefaultShareImage()
    };
    return {
      ...fallback,
      promise: this.generatePoster()
        .then(path => ({ ...fallback, imageUrl: path }))
        .catch(error => {
          console.warn('日签分享图生成失败，使用默认分享图', error);
          return fallback;
        })
    };
  }
});
