const courseService = require('../../services/course.service');
const { richContentToPlainText } = require('../../utils/markdown');
const { extractId } = require('../../utils/period-access');

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
    fontSizeLevel: 'standard'
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
      const contentText = richContentToPlainText(course.content || '');
      const paragraphs = splitParagraphs(contentText);
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
          paragraphs,
          currentParagraphIndex: safeIndex,
          readingProgress: this.calculateProgress(safeIndex, paragraphs.length),
          restoreScrollTop: saved.scrollTop,
          fontSizeLevel: saved.fontSizeLevel
        },
        () => {
          this.applyFontSizeClass(saved.fontSizeLevel);
          setTimeout(() => this.updateCurrentParagraphByViewport(), 350);
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
    this._stickToLastParagraphUntil = Date.now() + 1200;
    this.activateParagraph(this.data.paragraphs.length - 1);
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

      const scrollDetail = this._latestScrollDetail || {};
      const maxScrollTop =
        scrollDetail.scrollHeight && scrollRect.height
          ? scrollDetail.scrollHeight - scrollRect.height
          : 0;
      const bottomThreshold = 180;
      const isNearBottom =
        maxScrollTop > 0 &&
        this._latestScrollTop >= maxScrollTop - bottomThreshold;
      const shouldStickToLast =
        isNearBottom || Date.now() < (this._stickToLastParagraphUntil || 0);
      if (shouldStickToLast) {
        if (isNearBottom) {
          this._stickToLastParagraphUntil = Date.now() + 600;
        }
        this.activateParagraph(paragraphRects.length - 1);
        return;
      }

      const visibleBottom = scrollRect.bottom - 56;
      const lastRect = paragraphRects[paragraphRects.length - 1];
      if (lastRect && lastRect.bottom <= visibleBottom) {
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

  async generateMomentPoster() {
    const canvas = await this.getCanvasNode();
    const ctx = canvas.getContext('2d');
    const W = 1080;
    const H = 1440;
    const dpr = wx.getWindowInfo?.().pixelRatio || 2;
    const excerpt = this.getPosterExcerpt();
    let qrImage = null;

    canvas.width = W * dpr;
    canvas.height = H * dpr;

    if (typeof ctx.resetTransform === 'function') {
      ctx.resetTransform();
    } else if (typeof ctx.setTransform === 'function') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    try {
      qrImage = await this.loadCanvasImage(canvas, MINI_PROGRAM_CODE_ASSET_PATHS);
    } catch (error) {
      console.warn('加载小程序码失败，生成无二维码海报', error);
    }

    const outerPadding = 56;
    const cardX = outerPadding;
    const cardY = outerPadding;
    const cardW = W - outerPadding * 2;
    const cardH = H - outerPadding * 2;
    const innerX = 112;
    const footerTop = H - 270;
    const bodyBottom = footerTop - 42;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#dceeff');
    bg.addColorStop(0.3, '#fffdf8');
    bg.addColorStop(1, '#f8fbff');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    this.drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 40, '#ffffff');

    const headerH = 250;
    const header = ctx.createLinearGradient(cardX, cardY, W - cardX, cardY + headerH);
    header.addColorStop(0, '#4a90e2');
    header.addColorStop(1, '#76c5ff');
    this.drawRoundedRect(ctx, cardX, cardY, cardW, headerH, 36, header);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(this.data.periodName || '凡人共读', innerX, 142);
    ctx.font = 'bold 44px sans-serif';
    this.drawTextLines(
      ctx,
      this.wrapText(
        this.data.course.title || '读一读',
        28,
        2
      ),
      innerX,
      212,
      54
    );

    ctx.fillStyle = '#91c9ff';
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.arc(W - 126, 126, 118, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    let cursorY = cardY + headerH + 84;
    if (excerpt.before) {
      ctx.fillStyle = '#8b94a5';
      ctx.font = '30px sans-serif';
      cursorY = this.drawPosterParagraph(
        ctx,
        excerpt.before,
        innerX,
        cursorY,
        42,
        3,
        48
      );
      cursorY += 28;
    }

    const highlightLines = this.wrapText(excerpt.current, 31, 5);
    const highlightHeight = Math.min(
      Math.max(230, highlightLines.length * 58 + 82),
      Math.max(230, bodyBottom - cursorY - 190)
    );
    this.drawRoundedRect(
      ctx,
      92,
      cursorY - 42,
      W - 184,
      highlightHeight,
      30,
      '#f2f7ff'
    );
    ctx.fillStyle = '#4a90e2';
    this.drawRoundedRect(ctx, 112, cursorY - 16, 8, highlightHeight - 52, 4, '#4a90e2');
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 40px sans-serif';
    cursorY = this.drawTextLines(ctx, highlightLines, 146, cursorY + 10, 58);
    cursorY = Math.max(cursorY + 58, cursorY - 10 + highlightHeight + 38);

    if (excerpt.after && cursorY < bodyBottom - 70) {
      ctx.fillStyle = '#687385';
      ctx.font = '30px sans-serif';
      const remainingLines = Math.max(1, Math.floor((bodyBottom - cursorY) / 48));
      this.drawPosterParagraph(
        ctx,
        excerpt.after,
        innerX,
        cursorY,
        42,
        Math.min(4, remainingLines),
        48
      );
    }

    ctx.strokeStyle = '#edf2f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(innerX, footerTop);
    ctx.lineTo(W - innerX, footerTop);
    ctx.stroke();

    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('凡人共读', innerX, H - 178);
    ctx.fillStyle = '#8b94a5';
    ctx.font = '26px sans-serif';
    ctx.fillText('一个早起、读书、谈心的地方', innerX, H - 132);

    if (qrImage && typeof ctx.drawImage === 'function') {
      const qrSize = 132;
      const qrX = W - 112 - qrSize;
      const qrY = H - 222;
      this.drawRoundedRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 22, '#ffffff');
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
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
