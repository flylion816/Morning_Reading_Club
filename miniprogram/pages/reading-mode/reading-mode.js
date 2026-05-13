const courseService = require('../../services/course.service');
const { richContentToPlainText, isLikelyHtml } = require('../../utils/markdown');
const {
  extractId,
  getPeriodAccess
} = require('../../utils/period-access');

const MINI_PROGRAM_CODE_ASSET_PATHS = [
  '/assets/images/mini-program-code.png',
  '../../assets/images/mini-program-code.png'
];

const FONT_SIZE_LEVELS = ['standard', 'large', 'xlarge'];

function normalizeText(content = '') {
  return String(content || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitParagraphs(content = '') {
  const normalized = normalizeText(content);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\n{1,2}/)
    .map((text) => text.trim())
    .filter((text) => {
      return !['每天晨读内容', '每日晨读内容'].includes(text);
    })
    .map((text, index) => ({
      id: `${index}-${text.slice(0, 8)}`,
      text
    }));
}

// 解析内容，保留图片节点，返回 {type:'text'|'image', text?, src?} 的混合数组
function splitParagraphsWithImages(content = '') {
  if (!content) return [];

  const items = [];
  let idCounter = 0;

  function pushText(raw) {
    const text = richContentToPlainText(raw);
    splitParagraphs(text).forEach((p) => {
      items.push({ ...p, id: `t${idCounter++}-${p.id}` });
    });
  }

  function pushImage(src) {
    items.push({ id: `img-${idCounter++}`, type: 'image', src });
  }

  if (isLikelyHtml(content)) {
    // HTML：按 <img> 标签切分
    content.split(/(<img[^>]+>)/gi).forEach((part) => {
      const m = part.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
      if (m) {
        pushImage(m[1]);
      } else if (part.trim()) {
        pushText(part);
      }
    });
  } else {
    // Markdown：按 ![alt](url) 切分
    content.split(/(!\[[^\]]*\]\([^)]+\))/g).forEach((part) => {
      const m = part.match(/!\[[^\]]*\]\(([^)]+)\)/);
      if (m) {
        pushImage(m[1]);
      } else if (part.trim()) {
        pushText(part);
      }
    });
  }

  return items;
}

Page({
  data: {
    sectionId: '',
    periodId: '',
    periodName: '',
    course: {},
    paragraphs: [],
    currentParagraphIndex: 0,
    readingProgress: 0,
    restoreScrollTop: 0,
    posterGenerating: false,
    posterPanelVisible: false,
    posterTempFilePath: '',
    statusBarHeight: 0,
    topbarHeight: 88,
    fontSizeLevel: 'standard',
    canAccessCheckin: false,
    contentReady: false
  },

  onLoad(options) {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : {};
    const statusBarHeight = windowInfo.statusBarHeight || 0;
    this.setData({
      sectionId: options.id || '',
      periodId: options.periodId || '',
      statusBarHeight,
      topbarHeight: statusBarHeight + 56
    });

    this.loadReadingContent();
  },

  onUnload() {
    this.persistProgress();
  },

  getProgressKey() {
    return `reading_progress_${this.data.sectionId}`;
  },

  getSettingsKey() {
    return 'reading_mode_settings';
  },

  loadSavedState() {
    const progress = wx.getStorageSync(this.getProgressKey()) || {};
    const settings = wx.getStorageSync(this.getSettingsKey()) || {};
    return {
      scrollTop: Number(progress.scrollTop) || 0,
      currentParagraphIndex: Number(progress.currentParagraphIndex) || 0,
      fontSizeLevel: settings.fontSizeLevel || 'standard'
    };
  },

  persistProgress() {
    if (!this.data.sectionId) {
      return;
    }

    wx.setStorageSync(this.getProgressKey(), {
      scrollTop: this._latestScrollTop || 0,
      currentParagraphIndex: this.data.currentParagraphIndex || 0,
      updatedAt: Date.now()
    });
  },

  async loadReadingContent() {
    try {
      wx.showLoading({ title: '加载中...', mask: true });
      const course = await courseService.getSectionDetail(this.data.sectionId);
      const periodId = this.data.periodId || extractId(course.periodId);
      const periodName =
        course.periodId?.name ||
        course.periodId?.title ||
        course.periodName ||
        '';
      const paragraphs = splitParagraphsWithImages(course.content || '');
      let canAccessCheckin = false;

      if (periodId) {
        try {
          const access = await getPeriodAccess(periodId);
          canAccessCheckin = access.communityAccessState === 'enabled';
        } catch (accessError) {
          console.warn('读取打卡权限失败:', accessError);
        }
      }

      const saved = this.loadSavedState();
      const safeIndex = Math.min(
        Math.max(saved.currentParagraphIndex, 0),
        Math.max(paragraphs.length - 1, 0)
      );

      this.setData(
        {
          course,
          periodId,
          periodName,
          canAccessCheckin,
          paragraphs,
          currentParagraphIndex: safeIndex,
          readingProgress: this.calculateProgress(safeIndex, paragraphs.length),
          restoreScrollTop: saved.scrollTop,
          fontSizeLevel: saved.fontSizeLevel
        },
        () => {
          this.applyFontSizeClass(saved.fontSizeLevel);
          setTimeout(() => {
            this.updateCurrentParagraphByViewport();
            this.setData({ contentReady: true });
          }, 350);
        }
      );
      wx.hideLoading();
    } catch (error) {
      console.error('加载沉浸朗读内容失败:', error);
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  calculateProgress(index, total) {
    if (!total) {
      return 0;
    }
    return Math.min(100, Math.max(0, Math.round(((index + 1) / total) * 100)));
  },

  handleReaderScroll(event) {
    this._latestScrollTop = event.detail?.scrollTop || 0;
    this._latestScrollDetail = event.detail || {};
    if (this._scrollTimer) {
      clearTimeout(this._scrollTimer);
    }
    this._scrollTimer = setTimeout(() => {
      this.updateCurrentParagraphByViewport();
      this.persistProgress();
    }, 120);
  },

  handleScrollToLower() {
    this.persistProgress();
  },

  activateParagraph(index) {
    const total = this.data.paragraphs.length;
    if (!total) {
      return;
    }

    const safeIndex = Math.min(Math.max(Number(index) || 0, 0), total - 1);
    if (safeIndex === this.data.currentParagraphIndex) {
      return;
    }

    this.setData({
      currentParagraphIndex: safeIndex,
      readingProgress: this.calculateProgress(safeIndex, total)
    });
  },

  updateCurrentParagraphByViewport() {
    if (!wx.createSelectorQuery || this.data.paragraphs.length === 0) {
      return;
    }

    const query = wx.createSelectorQuery().in(this);
    query.select('.reader-scroll').boundingClientRect();
    query.selectAll('.reader-paragraph').boundingClientRect();
    query.exec((result) => {
      const scrollRect = result?.[0];
      const paragraphRects = result?.[1] || [];
      if (!scrollRect || paragraphRects.length === 0) {
        return;
      }

      // 仅当真正滚到底部（scrollTop + viewport >= scrollHeight - 4px 容差）时激活最后一段
      const scrollDetail = this._latestScrollDetail || {};
      const scrollHeight = scrollDetail.scrollHeight || 0;
      const scrollTop = this._latestScrollTop || 0;
      if (scrollHeight > 0 && scrollTop + scrollRect.height >= scrollHeight - 4) {
        this.activateParagraph(paragraphRects.length - 1);
        return;
      }

      const targetY = scrollRect.top + scrollRect.height * 0.46;
      let bestIndex = this.data.currentParagraphIndex;
      let bestDistance = Infinity;

      paragraphRects.forEach((rect, index) => {
        const centerY = rect.top + rect.height / 2;
        const distance = Math.abs(centerY - targetY);
        if (rect.top <= targetY && rect.bottom >= targetY) {
          bestIndex = index;
          bestDistance = 0;
          return;
        }
        if (distance < bestDistance) {
          bestIndex = index;
          bestDistance = distance;
        }
      });

      this.activateParagraph(bestIndex);
    });
  },

  applyFontSizeClass(level) {
    this.setData({ fontSizeLevel: level });
    wx.setStorageSync(this.getSettingsKey(), { fontSizeLevel: level });
  },

  cycleFontSize() {
    const currentIndex = FONT_SIZE_LEVELS.indexOf(this.data.fontSizeLevel);
    const nextLevel =
      FONT_SIZE_LEVELS[(currentIndex + 1) % FONT_SIZE_LEVELS.length];
    this.applyFontSizeClass(nextLevel);
    wx.showToast({
      title:
        nextLevel === 'standard'
          ? '标准字号'
          : nextLevel === 'large'
            ? '大字号'
            : '超大字号',
      icon: 'none'
    });
  },

  handleBack() {
    this.persistProgress();
    wx.navigateBack();
  },

  handleGoCheckin() {
    if (!this.data.canAccessCheckin) {
      wx.showToast({ title: '完成支付后可打卡', icon: 'none' });
      return;
    }

    this.persistProgress();
    wx.navigateTo({
      url: `/pages/checkin/checkin?courseId=${this.data.sectionId}&periodId=${this.data.periodId}`
    });
  },

  getPosterTextUnits(text = '') {
    return Array.from(String(text)).reduce((sum, char) => {
      return sum + (/[^\x00-\xff]/.test(char) ? 2 : 1);
    }, 0);
  },

  wrapText(text = '', maxUnits = 30, maxLines = 4) {
    const lines = [];
    let currentLine = '';
    let currentUnits = 0;

    Array.from(String(text || '').trim()).forEach((char) => {
      const nextUnits = this.getPosterTextUnits(char);
      if (currentLine && currentUnits + nextUnits > maxUnits) {
        lines.push(currentLine);
        currentLine = char;
        currentUnits = nextUnits;
        return;
      }
      currentLine += char;
      currentUnits += nextUnits;
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    if (lines.length > maxLines) {
      const clipped = lines.slice(0, maxLines);
      clipped[maxLines - 1] = `${clipped[maxLines - 1].replace(/。?$/, '')}...`;
      return clipped;
    }

    return lines;
  },

  getPosterExcerpt() {
    const { paragraphs, currentParagraphIndex } = this.data;
    const current = paragraphs[currentParagraphIndex]?.text || '';
    return {
      before: paragraphs[currentParagraphIndex - 1]?.text || '',
      current,
      after: paragraphs[currentParagraphIndex + 1]?.text || ''
    };
  },

  getPosterDateLabel() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    return `${month}月${date}日`;
  },

  getCanvasNode() {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery().in(this);
      query
        .select('#readingMomentCanvas')
        .fields({ node: true, size: true })
        .exec((result) => {
          const target = result?.[0];
          if (!target?.node) {
            reject(new Error('找不到分享画布'));
            return;
          }
          resolve(target.node);
        });
    });
  },

  loadCanvasImage(canvas, candidates = []) {
    return new Promise((resolve, reject) => {
      let index = 0;
      const tryLoad = () => {
        const src = candidates[index];
        if (!src) {
          reject(new Error('加载图片失败'));
          return;
        }
        const image = canvas.createImage();
        image.onload = () => resolve(image);
        image.onerror = () => {
          index += 1;
          tryLoad();
        };
        image.src = src;
      };
      tryLoad();
    });
  },

  drawRoundedRect(ctx, x, y, width, height, radius, fillStyle) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
  },

  drawTextLines(ctx, lines, x, y, lineHeight) {
    let cursorY = y;
    lines.forEach((line) => {
      ctx.fillText(line, x, cursorY);
      cursorY += lineHeight;
    });
    return cursorY;
  },

  drawPosterParagraph(ctx, text, x, y, maxUnits, maxLines, lineHeight) {
    return this.drawTextLines(
      ctx,
      this.wrapText(text, maxUnits, maxLines),
      x,
      y,
      lineHeight
    );
  },

  wrapCanvasText(ctx, text = '', maxWidth, maxLines = 99) {
    const lines = [];
    let currentLine = '';

    Array.from(String(text || '').trim()).forEach((char) => {
      const testLine = currentLine + char;
      if (currentLine && ctx.measureText(testLine).width > maxWidth) {
        lines.push(currentLine);
        currentLine = char;
        return;
      }
      currentLine = testLine;
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    if (lines.length > maxLines) {
      const clipped = lines.slice(0, maxLines);
      let lastLine = clipped[maxLines - 1] || '';
      while (lastLine && ctx.measureText(`${lastLine}...`).width > maxWidth) {
        lastLine = lastLine.slice(0, -1);
      }
      clipped[maxLines - 1] = `${lastLine.replace(/[，。；、,.!?！？]?$/, '')}...`;
      return clipped;
    }

    return lines;
  },

  getPosterParagraphSlice() {
    const { paragraphs, currentParagraphIndex } = this.data;
    const total = paragraphs.length;
    if (!total) {
      return [];
    }

    const activeIndex = Math.min(Math.max(currentParagraphIndex || 0, 0), total - 1);
    const startIndex = Math.max(0, activeIndex - 1);
    const endIndex = Math.min(total, activeIndex + 3);

    return paragraphs.slice(startIndex, endIndex).map((paragraph, offset) => ({
      ...paragraph,
      sourceIndex: startIndex + offset,
      active: startIndex + offset === activeIndex
    }));
  },

  // 查询当前屏幕上实际可见的段落（含图片），用于海报内容
  getVisibleParagraphSlice() {
    return new Promise((resolve) => {
      const { paragraphs } = this.data;
      if (!paragraphs.length) {
        resolve([]);
        return;
      }

      const query = wx.createSelectorQuery().in(this);
      query.select('.reader-scroll').boundingClientRect();
      query.selectAll('.reader-paragraph').boundingClientRect();
      query.exec((result) => {
        const scrollRect = result?.[0];
        const rects = result?.[1] || [];
        if (!scrollRect || !rects.length) {
          resolve(this.getPosterParagraphSlice());
          return;
        }

        // reader-scroll 从 y=0 起，topbar fixed 覆盖上方，需要加 topbarHeight 才是真实可见上边界
        const effectiveTop = scrollRect.top + (this.data.topbarHeight || 88);
        // 底部工具栏约 80px，超出部分不算可见
        const effectiveBottom = scrollRect.bottom - 80;
        const visible = rects
          .map((rect, i) => ({ rect, item: paragraphs[i], index: i }))
          .filter(({ rect }) => rect.bottom > effectiveTop && rect.top < effectiveBottom)
          .map(({ item, index }) => ({
            ...item,
            sourceIndex: index,
            active: index === this.data.currentParagraphIndex
          }));

        resolve(visible.length ? visible : this.getPosterParagraphSlice());
      });
    });
  },

  async generateMomentPoster() {
    const canvas = await this.getCanvasNode();
    const ctx = canvas.getContext('2d');
    const W = 900;
    const dpr = Math.min(wx.getWindowInfo?.().pixelRatio || 2, 2);
    const pageX = 58;
    const contentW = W - pageX * 2;
    const periodName = this.data.periodName || '凡人共读';
    const title = this.data.course.title || '读一读';
    const posterItems = await this.getVisibleParagraphSlice();
    const footerH = 240;
    const topPadding = 70;
    const titleLineH = 58;
    const paragraphLineH = 54;
    let qrImage = null;

    if (typeof ctx.resetTransform === 'function') {
      ctx.resetTransform();
    } else if (typeof ctx.setTransform === 'function') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    try {
      qrImage = await this.loadCanvasImage(canvas, MINI_PROGRAM_CODE_ASSET_PATHS);
    } catch (error) {
      console.warn('加载小程序码失败，生成无二维码海报', error);
    }

    ctx.font = 'bold 42px sans-serif';
    const titleLines = this.wrapCanvasText(ctx, title, contentW, 2);

    // 预加载图片项，同时测量文字项
    const measuredItems = [];
    for (const item of posterItems) {
      if (item.type === 'image') {
        try {
          const img = await this.loadCanvasImage(canvas, [item.src]);
          const naturalW = img.width || contentW;
          const naturalH = img.height || contentW;
          const ratio = naturalW / naturalH || 1;
          const naturalDisplayH = Math.round(contentW / ratio);
          // 超高时按高度限制，同步缩小宽度保持比例，水平居中
          const maxH = 700;
          const displayH = Math.min(naturalDisplayH, maxH);
          const displayW = displayH < naturalDisplayH ? Math.round(displayH * ratio) : contentW;
          const drawX = pageX + Math.round((contentW - displayW) / 2);
          measuredItems.push({ ...item, img, displayW, displayH, drawX, lines: [] });
        } catch {
          // 加载失败的图片跳过
        }
      } else {
        ctx.font = item.active ? 'bold 34px sans-serif' : 'bold 31px sans-serif';
        const textX = item.active ? pageX + 28 : pageX + 22;
        const maxLines = item.active ? 8 : 5;
        const lines = this.wrapCanvasText(ctx, item.text, W - textX - pageX, maxLines);
        measuredItems.push({ ...item, textX, lines });
      }
    }

    const headerH = topPadding + 58 + 44 + titleLines.length * titleLineH + 98;
    const bodyH = measuredItems.reduce((sum, item) => {
      if (item.type === 'image') {
        return sum + item.displayH + 24;
      }
      return sum + item.lines.length * paragraphLineH + (item.active ? 38 : 28);
    }, 0);
    const H = Math.max(1120, Math.min(3000, headerH + bodyH + footerH + 58));

    canvas.width = W * dpr;
    canvas.height = H * dpr;

    if (typeof ctx.resetTransform === 'function') {
      ctx.resetTransform();
    } else if (typeof ctx.setTransform === 'function') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#f2f7ff');
    bg.addColorStop(0.18, '#fffdf8');
    bg.addColorStop(1, '#fffdf8');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.font = 'bold 24px sans-serif';
    const periodTag = this.wrapCanvasText(ctx, periodName, 220, 1)[0] || '凡人共读';
    const tagInsetX = 23;
    const tagW = Math.min(260, Math.max(152, ctx.measureText(periodTag).width + tagInsetX * 2));
    this.drawRoundedRect(ctx, pageX - tagInsetX, topPadding, tagW, 48, 24, '#eef5ff');
    ctx.fillStyle = '#357abd';
    ctx.fillText(periodTag, pageX, topPadding + 32);

    this.drawRoundedRect(ctx, W - pageX - 120, topPadding, 120, 48, 24, '#ffffff');
    ctx.fillStyle = '#4a90e2';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.data.readingProgress || 0}%`, W - pageX - 60, topPadding + 32);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 42px sans-serif';
    let cursorY = this.drawTextLines(ctx, titleLines, pageX, topPadding + 116, titleLineH);

    ctx.fillStyle = '#9aa3af';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('每天晨读内容', pageX, cursorY + 38);
    ctx.strokeStyle = '#ef6b78';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pageX, cursorY + 49);
    ctx.lineTo(pageX + 148, cursorY + 49);
    ctx.stroke();
    cursorY += 100;

    measuredItems.forEach((item) => {
      if (item.type === 'image') {
        ctx.drawImage(item.img, item.drawX !== undefined ? item.drawX : pageX, cursorY, item.displayW, item.displayH);
        cursorY += item.displayH + 24;
        return;
      }

      if (item.active) {
        const lineTop = cursorY - 38;
        const lineHeight = item.lines.length * paragraphLineH - 10;
        this.drawRoundedRect(ctx, pageX, lineTop, 6, lineHeight, 3, '#4a90e2');
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 34px sans-serif';
      } else {
        ctx.fillStyle = '#a2abb7';
        ctx.font = 'bold 31px sans-serif';
      }

      item.lines.forEach((line) => {
        ctx.fillText(line, item.textX, cursorY);
        cursorY += paragraphLineH;
      });

      cursorY += item.active ? 42 : 32;
    });

    const footerTop = H - footerH;

    ctx.strokeStyle = '#e8edf3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pageX, footerTop);
    ctx.lineTo(W - pageX, footerTop);
    ctx.stroke();

    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('凡人共读', pageX, footerTop + 78);
    ctx.fillStyle = '#8b94a5';
    ctx.font = '24px sans-serif';
    ctx.fillText('一个早起、读书、谈心的地方', pageX, footerTop + 118);
    ctx.fillStyle = '#b0bac6';
    ctx.font = '22px sans-serif';
    ctx.fillText(`${this.getPosterDateLabel()} · 沉浸阅读`, pageX, footerTop + 154);

    if (qrImage && typeof ctx.drawImage === 'function') {
      const qrSize = 116;
      const qrX = W - pageX - qrSize;
      const qrY = footerTop + 48;
      this.drawRoundedRect(ctx, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 22, '#ffffff');
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
      ctx.fillStyle = '#8b94a5';
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('扫码共读', qrX + qrSize / 2, qrY + qrSize + 44);
      ctx.textAlign = 'left';
    }

    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        width: W,
        height: H,
        destWidth: W * 2,
        destHeight: H * 2,
        fileType: 'png',
        quality: 1,
        success: (res) => resolve(res.tempFilePath),
        fail: reject
      });
    });
  },

  handleShareMoment() {
    if (this.data.posterGenerating) {
      return;
    }

    if (!this.data.paragraphs.length) {
      wx.showToast({ title: '暂无可分享内容', icon: 'none' });
      return;
    }

    this.setData({ posterGenerating: true });
    wx.showLoading({ title: '生成中...', mask: true });
    this.generateMomentPoster()
      .then((tempFilePath) => {
        this.setData({
          posterGenerating: false,
          posterTempFilePath: tempFilePath,
          posterPanelVisible: true
        });
        wx.hideLoading();
      })
      .catch((error) => {
        console.error('生成朗读分享图失败:', error);
        this.setData({ posterGenerating: false });
        wx.hideLoading();
        wx.showToast({ title: '生成失败', icon: 'none' });
      });
  },

  handlePreviewPoster() {
    if (!this.data.posterTempFilePath) {
      return;
    }
    wx.previewImage({
      urls: [this.data.posterTempFilePath],
      current: this.data.posterTempFilePath
    });
  },

  handleSavePoster() {
    if (!this.data.posterTempFilePath) {
      return;
    }
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterTempFilePath,
      success: () => wx.showToast({ title: '已保存', icon: 'success' }),
      fail: () => wx.showToast({ title: '保存失败', icon: 'none' })
    });
  },

  handleSharePoster() {
    if (!this.data.posterTempFilePath) {
      return;
    }

    if (typeof wx.showShareImageMenu === 'function') {
      wx.showShareImageMenu({
        path: this.data.posterTempFilePath,
        fail: () => wx.showToast({ title: '分享失败', icon: 'none' })
      });
      return;
    }

    this.handlePreviewPoster();
  },

  closePosterPanel() {
    this.setData({ posterPanelVisible: false });
  },

  noop() {},

  onShareAppMessage() {
    return {
      title: `${this.data.course.title || '读一读'} - 凡人共读`,
      path: `/pages/reading-mode/reading-mode?id=${this.data.sectionId}&periodId=${this.data.periodId}`,
      imageUrl: '/assets/images/share-default.jpg'
    };
  }
});
