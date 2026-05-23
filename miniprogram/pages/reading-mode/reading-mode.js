const courseService = require('../../services/course.service');
const constants = require('../../config/constants');
const { tenantStorage } = require('../../utils/storage');
const { richContentToPlainText, isLikelyHtml } = require('../../utils/markdown');
const {
  extractId,
  getPeriodAccess
} = require('../../utils/period-access');
const {
  getReadingCompletion,
  markReadingCompleted
} = require('../../utils/reading-completion');

const MINI_PROGRAM_CODE_ASSET_PATHS = [
  '/assets/images/mini-program-code.jpg',
  '../../assets/images/mini-program-code.jpg'
];

const FONT_SIZE_LEVELS = ['standard', 'large', 'xlarge'];
const MIN_COMPLETION_DURATION_MS = 60 * 1000;
const FINAL_PARAGRAPH_DWELL_MS = 5 * 1000;

function isTruthyRouteValue(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

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
    contentReady: false,
    completionVisible: false,
    completionDurationText: '',
    completionTitle: '你这一课，已经认真读完了！',
    completionPreviouslySaved: false,
    fireworksVisible: false
  },

  onLoad(options) {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : {};
    const statusBarHeight = windowInfo.statusBarHeight || 0;
    this._routeReadingCompletion = this.getRouteReadingCompletion(options);
    this.setData({
      sectionId: options.id || '',
      periodId: options.periodId || '',
      statusBarHeight,
      topbarHeight: statusBarHeight + 64,
      completionTitle: this.getCompletionTitle()
    });

    this.loadReadingContent();
  },

  getRouteReadingCompletion(options = {}) {
    if (!isTruthyRouteValue(options.readingCompleted)) {
      return null;
    }

    return {
      readingCompleted: true,
      readingDurationMs: Math.max(0, Number(options.readingDurationMs) || 0),
      readingCompletedAt: options.readingCompletedAt || null
    };
  },

  onUnload() {
    this.clearCompletionTimers();
    this.persistProgress();
  },

  getProgressKey() {
    return `reading_progress_${this.data.sectionId}`;
  },

  getSettingsKey() {
    return 'reading_mode_settings';
  },

  getCompletionTitle() {
    let userInfo = null;
    try {
      userInfo =
        (typeof getApp === 'function' ? getApp()?.globalData?.userInfo : null) ||
        tenantStorage.get(constants.STORAGE_KEYS.USER_INFO) ||
        null;
    } catch (error) {
      userInfo = null;
    }

    const nickname =
      userInfo?.nickname ||
      userInfo?.name ||
      userInfo?.nickName ||
      '';
    return nickname
      ? `${nickname}，你这一课，已经认真读完了！`
      : '你这一课，已经认真读完了！';
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
      const savedCompletion = getReadingCompletion(this.data.sectionId);
      const routeCompletion = this._routeReadingCompletion;
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
          fontSizeLevel: saved.fontSizeLevel,
          completionVisible: false,
          completionDurationText: '',
          completionTitle: this.getCompletionTitle(),
          completionPreviouslySaved: !!(
            savedCompletion || routeCompletion || course.readingCompleted
          ),
          fireworksVisible: false
        },
        () => {
          this.initReadingCompletionSession(
            saved,
            paragraphs.length,
            savedCompletion || routeCompletion || course
          );
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
    this.trackReadingScrollPattern(event.detail || {});
    if (this._scrollTimer) {
      clearTimeout(this._scrollTimer);
    }
    this._scrollTimer = setTimeout(() => {
      this.updateCurrentParagraphByViewport();
      this.persistProgress();
    }, 120);
  },

  handleScrollToLower() {
    const lastIndex = this.data.paragraphs.length - 1;
    if (lastIndex >= 0) {
      this.activateParagraph(lastIndex);
    }
    this.persistProgress();
  },

  activateParagraph(index) {
    const total = this.data.paragraphs.length;
    if (!total) {
      return;
    }

    const safeIndex = Math.min(Math.max(Number(index) || 0, 0), total - 1);
    if (safeIndex === this.data.currentParagraphIndex) {
      this.handleActiveReadingUnitForCompletion(safeIndex);
      return;
    }

    this.setData({
      currentParagraphIndex: safeIndex,
      readingProgress: this.calculateProgress(safeIndex, total)
    });
    this.handleActiveReadingUnitForCompletion(safeIndex);
  },

  clearCompletionTimers() {
    if (this._finalParagraphTimer) {
      clearTimeout(this._finalParagraphTimer);
      this._finalParagraphTimer = null;
    }
    if (this._fireworksTimer) {
      clearTimeout(this._fireworksTimer);
      this._fireworksTimer = null;
    }
  },

  initReadingCompletionSession(saved = {}, total = 0, completion = null) {
    this.clearCompletionTimers();
    const restoredScrollTop = Number(saved.scrollTop) || 0;
    const restoredIndex = Number(saved.currentParagraphIndex) || 0;
    const previousDurationMs = Number(
      completion?.durationMs || completion?.readingDurationMs || 0
    );

    this._readingCompletionSession = {
      startedAt: Date.now(),
      startedFromTop: restoredScrollTop <= 20 && restoredIndex === 0,
      total,
      lastScrollTop: restoredScrollTop,
      downwardDistance: 0,
      upwardDistance: 0,
      gradualScrollEvents: 0,
      maxForwardJump: 0,
      directBottomJump: false,
      furthestIndex: restoredIndex,
      completionShown: false,
      finalActiveSince: null,
      previouslySaved: !!(
        completion?.completedAt ||
        completion?.readingCompletedAt ||
        completion?.readingCompleted
      ),
      previousDurationMs
    };
  },

  trackReadingScrollPattern(detail = {}) {
    const session = this._readingCompletionSession;
    if (!session) {
      return;
    }

    const scrollTop = Number(detail.scrollTop) || 0;
    if (!session.startedFromTop && scrollTop <= 20) {
      session.startedFromTop = true;
      session.lastScrollTop = scrollTop;
      session.downwardDistance = 0;
      session.upwardDistance = 0;
      session.gradualScrollEvents = 0;
      session.maxForwardJump = 0;
      session.directBottomJump = false;
      session.furthestIndex = 0;
      session.finalActiveSince = null;
      return;
    }

    if (!session.startedFromTop) {
      return;
    }

    const previousScrollTop = Number(session.lastScrollTop) || 0;
    const delta = scrollTop - previousScrollTop;

    if (delta > 0) {
      session.downwardDistance += delta;
      session.gradualScrollEvents += 1;
      session.maxForwardJump = Math.max(session.maxForwardJump, delta);
    } else if (delta < 0) {
      session.upwardDistance += Math.abs(delta);
    }

    const scrollHeight = Number(detail.scrollHeight) || 0;
    if (
      scrollHeight > 0 &&
      session.gradualScrollEvents <= 2 &&
      delta > 600 &&
      scrollTop > scrollHeight * 0.62
    ) {
      session.directBottomJump = true;
    }

    session.lastScrollTop = scrollTop;
  },

  handleActiveReadingUnitForCompletion(index) {
    const session = this._readingCompletionSession;
    const total = this.data.paragraphs.length;
    if (!session || !total) {
      return;
    }

    session.furthestIndex = Math.max(session.furthestIndex || 0, index);

    const isFinal = index === total - 1;
    if (!isFinal) {
      session.finalActiveSince = null;
      if (this._finalParagraphTimer) {
        clearTimeout(this._finalParagraphTimer);
        this._finalParagraphTimer = null;
      }
      return;
    }

    if (session.previouslySaved && !this.data.completionVisible) {
      session.completionShown = true;
      this.setData({
        completionVisible: true,
        completionDurationText: this.formatReadingDuration(
          session.previousDurationMs || Date.now() - session.startedAt
        ),
        fireworksVisible: false
      });
      return;
    }

    if (!session.finalActiveSince) {
      session.finalActiveSince = Date.now();
    }

    if (this._finalParagraphTimer) {
      return;
    }

    this._finalParagraphTimer = setTimeout(() => {
      this._finalParagraphTimer = null;
      this.maybeShowReadingCompletion();
    }, FINAL_PARAGRAPH_DWELL_MS);
  },

  hasGradualReadingPattern() {
    const session = this._readingCompletionSession;
    if (!session || !session.startedFromTop || session.directBottomJump) {
      return false;
    }

    const total = this.data.paragraphs.length;
    const reachedEnoughUnits = total <= 3 || session.furthestIndex >= total - 1;
    const hasEnoughScroll =
      session.gradualScrollEvents >= 4 ||
      session.downwardDistance >= 320 ||
      total <= 2;
    const mostlyDownward =
      session.downwardDistance >= session.upwardDistance * 1.5;

    return reachedEnoughUnits && hasEnoughScroll && mostlyDownward;
  },

  formatReadingDuration(durationMs = 0) {
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes <= 0) {
      return `${seconds} 秒`;
    }

    return `${minutes} 分 ${seconds} 秒`;
  },

  maybeShowReadingCompletion() {
    const session = this._readingCompletionSession;
    const total = this.data.paragraphs.length;
    if (
      !session ||
      session.completionShown ||
      this.data.completionVisible ||
      !total ||
      this.data.currentParagraphIndex !== total - 1
    ) {
      return;
    }

    const now = Date.now();
    const durationMs = now - session.startedAt;
    const finalDwellMs = now - (session.finalActiveSince || now);

    if (finalDwellMs < FINAL_PARAGRAPH_DWELL_MS) {
      this._finalParagraphTimer = setTimeout(() => {
        this._finalParagraphTimer = null;
        this.maybeShowReadingCompletion();
      }, FINAL_PARAGRAPH_DWELL_MS - finalDwellMs);
      return;
    }

    if (durationMs <= MIN_COMPLETION_DURATION_MS) {
      this._finalParagraphTimer = setTimeout(() => {
        this._finalParagraphTimer = null;
        this.maybeShowReadingCompletion();
      }, MIN_COMPLETION_DURATION_MS - durationMs + 120);
      return;
    }

    if (!this.hasGradualReadingPattern()) {
      return;
    }

    session.completionShown = true;
    const completionDurationText = this.formatReadingDuration(durationMs);
    markReadingCompleted(this.data.sectionId, {
      periodId: this.data.periodId,
      durationMs,
      completedAt: now
    });
    courseService
      .markReadingCompleted(this.data.sectionId, {
        durationMs,
        completedAt: new Date(now).toISOString()
      })
      .catch((error) => {
        console.warn('同步阅读完成状态失败，已保留本地状态:', error);
      });

    this.setData({
      completionVisible: true,
      completionDurationText,
      fireworksVisible: true
    });

    if (this._fireworksTimer) {
      clearTimeout(this._fireworksTimer);
    }
    this._fireworksTimer = setTimeout(() => {
      this._fireworksTimer = null;
      this.setData({ fireworksVisible: false });
    }, 5000);
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

  drawRoundedPath(ctx, x, y, width, height, radius) {
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
  },

  drawRoundedRect(ctx, x, y, width, height, radius, fillStyle) {
    this.drawRoundedPath(ctx, x, y, width, height, radius);
    ctx.fillStyle = fillStyle;
    ctx.fill();
  },

  strokeRoundedRect(ctx, x, y, width, height, radius, strokeStyle, lineWidth = 1) {
    this.drawRoundedPath(ctx, x, y, width, height, radius);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
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

  getPosterRpx(value, posterWidth = 900) {
    return (Number(value) || 0) * (posterWidth / 750);
  },

  getPosterParagraphMetrics(posterWidth = 900) {
    const fontSizeByLevel = {
      standard: 36,
      large: 40,
      xlarge: 44
    };
    const fontSizeRpx = fontSizeByLevel[this.data.fontSizeLevel] || 36;
    const fontSize = this.getPosterRpx(fontSizeRpx, posterWidth);

    return {
      fontSize,
      lineHeight: fontSize * 2.05,
      paddingLeft: this.getPosterRpx(22, posterWidth),
      marginBottom: this.getPosterRpx(34, posterWidth),
      markerWidth: this.getPosterRpx(4, posterWidth),
      markerInsetY: this.getPosterRpx(18, posterWidth)
    };
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

  getCompletionPosterItem() {
    const { paragraphs, currentParagraphIndex, completionVisible } = this.data;
    const total = paragraphs.length;

    if (!completionVisible || !total || currentParagraphIndex !== total - 1) {
      return null;
    }

    return {
      id: 'reading-completion',
      type: 'completion',
      kicker: '已完成本次晨读',
      title: this.data.completionTitle || this.getCompletionTitle(),
      text: `本次阅读用时 ${this.data.completionDurationText || '0 秒'}。能耐心读到这里，就是今天很扎实的一步。`
    };
  },

  appendCompletionPosterItem(items = []) {
    const completionItem = this.getCompletionPosterItem();
    return completionItem ? [...items, completionItem] : items;
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
    const rpx = (value) => this.getPosterRpx(value, W);
    const paragraphMetrics = this.getPosterParagraphMetrics(W);
    const pageX = rpx(48);
    const contentW = W - pageX * 2;
    const periodName = this.data.periodName || '凡人共读';
    const title = this.data.course.title || '读一读';
    const posterItems = this.appendCompletionPosterItem(
      await this.getVisibleParagraphSlice()
    );
    const footerH = rpx(260);
    const topPadding = rpx(48);
    const titleFontSize = rpx(36);
    const titleLineH = titleFontSize * 1.35;
    const paragraphLineH = paragraphMetrics.lineHeight;
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

    ctx.font = `bold ${titleFontSize}px sans-serif`;
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
          const maxH = rpx(584);
          const displayH = Math.min(naturalDisplayH, maxH);
          const displayW = displayH < naturalDisplayH ? Math.round(displayH * ratio) : contentW;
          const drawX = pageX + Math.round((contentW - displayW) / 2);
          measuredItems.push({ ...item, img, displayW, displayH, drawX, lines: [] });
        } catch {
          // 加载失败的图片跳过
        }
      } else if (item.type === 'completion') {
        const cardPaddingX = rpx(32);
        const cardPaddingTop = rpx(34);
        const cardPaddingBottom = rpx(48);
        const kickerFontSize = rpx(22);
        const kickerH = rpx(42);
        const titleFontSize = rpx(32);
        const titleLineH = titleFontSize * 1.45;
        const textFontSize = rpx(27);
        const textLineH = textFontSize * 1.8;
        const innerW = contentW - cardPaddingX * 2;

        ctx.font = `bold ${titleFontSize}px sans-serif`;
        const titleLines = this.wrapCanvasText(ctx, item.title, innerW, 2);
        ctx.font = `500 ${textFontSize}px sans-serif`;
        const textLines = this.wrapCanvasText(ctx, item.text, innerW, 3);
        const cardH =
          cardPaddingTop +
          kickerH +
          rpx(18) +
          titleLines.length * titleLineH +
          rpx(12) +
          textLines.length * textLineH +
          cardPaddingBottom;

        measuredItems.push({
          ...item,
          cardPaddingX,
          cardPaddingTop,
          kickerFontSize,
          kickerH,
          titleFontSize,
          titleLineH,
          textFontSize,
          textLineH,
          titleLines,
          textLines,
          cardH
        });
      } else {
        ctx.font = `${item.active ? 'bold' : '500'} ${paragraphMetrics.fontSize}px sans-serif`;
        const textX = pageX + paragraphMetrics.paddingLeft;
        const lines = this.wrapCanvasText(
          ctx,
          item.text,
          contentW - paragraphMetrics.paddingLeft,
          99
        );
        measuredItems.push({ ...item, textX, lines });
      }
    }

    const headerH =
      topPadding + rpx(48) + rpx(44) + titleLines.length * titleLineH + rpx(100);
    const bodyH = measuredItems.reduce((sum, item) => {
      if (item.type === 'image') {
        return sum + item.displayH + rpx(24);
      }
      if (item.type === 'completion') {
        return sum + item.cardH + rpx(54);
      }
      return sum + item.lines.length * paragraphLineH + paragraphMetrics.marginBottom;
    }, 0);
    const H = Math.max(rpx(934), Math.min(6000, headerH + bodyH + footerH + rpx(58)));

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

    ctx.font = `bold ${rpx(24)}px sans-serif`;
    const periodTag = this.wrapCanvasText(ctx, periodName, rpx(220), 1)[0] || '凡人共读';
    const tagInsetX = rpx(18);
    const tagH = rpx(48);
    const tagW = Math.min(rpx(260), Math.max(rpx(152), ctx.measureText(periodTag).width + tagInsetX * 2));
    this.drawRoundedRect(ctx, pageX - tagInsetX, topPadding, tagW, tagH, tagH / 2, '#eef5ff');
    ctx.fillStyle = '#357abd';
    ctx.fillText(periodTag, pageX, topPadding + rpx(32));

    this.drawRoundedRect(ctx, W - pageX - rpx(120), topPadding, rpx(120), tagH, tagH / 2, '#ffffff');
    ctx.fillStyle = '#4a90e2';
    ctx.font = `bold ${rpx(24)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${this.data.readingProgress || 0}%`, W - pageX - rpx(60), topPadding + rpx(32));
    ctx.textAlign = 'left';

    ctx.fillStyle = '#1f2937';
    ctx.font = `bold ${titleFontSize}px sans-serif`;
    let cursorY = this.drawTextLines(ctx, titleLines, pageX, topPadding + rpx(116), titleLineH);

    ctx.fillStyle = '#9aa3af';
    ctx.font = `bold ${rpx(26)}px sans-serif`;
    ctx.fillText('每天晨读内容', pageX, cursorY + rpx(38));
    ctx.strokeStyle = '#ef6b78';
    ctx.lineWidth = rpx(4);
    ctx.beginPath();
    ctx.moveTo(pageX, cursorY + rpx(49));
    ctx.lineTo(pageX + rpx(148), cursorY + rpx(49));
    ctx.stroke();
    cursorY += rpx(136);

    measuredItems.forEach((item) => {
      if (item.type === 'image') {
        ctx.drawImage(
          item.img,
          item.drawX !== undefined ? item.drawX : pageX,
          cursorY,
          item.displayW,
          item.displayH
        );
        cursorY += item.displayH + rpx(24);
        return;
      }

      if (item.type === 'completion') {
        this.drawRoundedRect(
          ctx,
          pageX,
          cursorY,
          contentW,
          item.cardH,
          rpx(24),
          '#f1fbf5'
        );
        this.strokeRoundedRect(
          ctx,
          pageX,
          cursorY,
          contentW,
          item.cardH,
          rpx(24),
          'rgba(16, 185, 129, 0.24)',
          rpx(1)
        );

        const innerX = pageX + item.cardPaddingX;
        let cardCursorY = cursorY + item.cardPaddingTop;
        ctx.font = `bold ${item.kickerFontSize}px sans-serif`;
        const kickerW = Math.min(
          rpx(196),
          Math.max(rpx(150), ctx.measureText(item.kicker).width + rpx(36))
        );
        this.drawRoundedRect(
          ctx,
          innerX,
          cardCursorY,
          kickerW,
          item.kickerH,
          item.kickerH / 2,
          'rgba(16, 185, 129, 0.12)'
        );
        ctx.fillStyle = '#047857';
        ctx.fillText(item.kicker, innerX + rpx(18), cardCursorY + rpx(28));

        cardCursorY += item.kickerH + rpx(44);
        ctx.fillStyle = '#1f2937';
        ctx.font = `bold ${item.titleFontSize}px sans-serif`;
        item.titleLines.forEach((line) => {
          ctx.fillText(line, innerX, cardCursorY);
          cardCursorY += item.titleLineH;
        });

        cardCursorY += rpx(10);
        ctx.fillStyle = '#56606d';
        ctx.font = `500 ${item.textFontSize}px sans-serif`;
        item.textLines.forEach((line) => {
          ctx.fillText(line, innerX, cardCursorY);
          cardCursorY += item.textLineH;
        });

        cursorY += item.cardH + rpx(46);
        return;
      }

      if (item.active) {
        const paragraphHeight = item.lines.length * paragraphLineH;
        const lineTop =
          cursorY -
          paragraphMetrics.fontSize -
          (paragraphLineH - paragraphMetrics.fontSize) / 2 +
          paragraphMetrics.markerInsetY;
        const markerH = Math.max(
          paragraphMetrics.markerWidth,
          paragraphHeight - paragraphMetrics.markerInsetY * 2
        );
        this.drawRoundedRect(
          ctx,
          pageX,
          lineTop,
          paragraphMetrics.markerWidth,
          markerH,
          paragraphMetrics.markerWidth / 2,
          '#4a90e2'
        );
        ctx.fillStyle = '#1f2937';
        ctx.font = `bold ${paragraphMetrics.fontSize}px sans-serif`;
      } else {
        ctx.fillStyle = '#a2abb7';
        ctx.font = `500 ${paragraphMetrics.fontSize}px sans-serif`;
      }

      item.lines.forEach((line) => {
        ctx.fillText(line, item.textX, cursorY);
        cursorY += paragraphLineH;
      });

      cursorY += paragraphMetrics.marginBottom;
    });

    const footerTop = H - footerH;

    ctx.strokeStyle = '#e8edf3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pageX, footerTop);
    ctx.lineTo(W - pageX, footerTop);
    ctx.stroke();

    const footerContentTop = footerTop + rpx(34);
    const footerContentH = rpx(184);
    const leftBlockH = rpx(110);
    const leftTitleY = footerContentTop + (footerContentH - leftBlockH) / 2 + rpx(32);

    ctx.fillStyle = '#1f2937';
    ctx.font = `bold ${rpx(34)}px sans-serif`;
    ctx.fillText('凡人共读', pageX, leftTitleY);
    ctx.fillStyle = '#8b94a5';
    ctx.font = `${rpx(24)}px sans-serif`;
    ctx.fillText('一个早起、读书、谈心的地方', pageX, leftTitleY + rpx(40));
    ctx.fillStyle = '#b0bac6';
    ctx.font = `${rpx(22)}px sans-serif`;
    ctx.fillText(`${this.getPosterDateLabel()} · 沉浸阅读`, pageX, leftTitleY + rpx(74));

    if (qrImage && typeof ctx.drawImage === 'function') {
      const qrSize = rpx(116);
      const qrX = W - pageX - qrSize;
      const qrY = footerContentTop;
      this.drawRoundedRect(ctx, qrX - rpx(14), qrY - rpx(14), qrSize + rpx(28), qrSize + rpx(28), rpx(22), '#ffffff');
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
      ctx.fillStyle = '#8b94a5';
      ctx.font = `${rpx(22)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('扫码共读', qrX + qrSize / 2, qrY + qrSize + rpx(44));
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
