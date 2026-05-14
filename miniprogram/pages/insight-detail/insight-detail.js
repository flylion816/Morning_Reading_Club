const insightService = require('../../services/insight.service');
const danmakuService = require('../../services/danmaku.service');
const env = require('../../config/env');
const { renderRichTextContent } = require('../../utils/markdown');
const activityService = require('../../services/activity.service');

// 弹幕泳道数量
const DANMAKU_LANES = 4;
// 弹幕横跨屏幕时长（秒）
const DANMAKU_DURATION = 18;
// 同屏最大弹幕数（允许多条共存，不同泳道错开）
const DANMAKU_MAX_VISIBLE = 10;
// 同一泳道两条弹幕最小间隔（ms）：让前一条有足够空间移走再进下一条
// 72vw 宽气泡 + 20vw 间隙 = 92vw，220vw/18s ≈ 12.2vw/s → 92/12.2 ≈ 7.5s
const DANMAKU_LANE_COOLDOWN = 7500;

const INSIGHT_POSTER_WIDTH = 750;

function getEntityId(entity) {
  if (!entity) return '';
  if (typeof entity === 'object') {
    return entity._id || entity.id || '';
  }
  return entity;
}

function getEntityNickname(entity) {
  if (!entity || typeof entity !== 'object') return '';
  return entity.nickname || entity.name || '';
}

function resolveInsightOwner(insight = {}, currentUser = {}) {
  const targetUserId = getEntityId(insight.targetUserId);
  const creatorUserId = getEntityId(insight.userId);
  const ownerId = targetUserId || creatorUserId;
  const ownerUser =
    (targetUserId && typeof insight.targetUserId === 'object' && insight.targetUserId) ||
    (creatorUserId && typeof insight.userId === 'object' && insight.userId) ||
    null;
  const currentUserId = getEntityId(currentUser);
  const currentUserName = getEntityNickname(currentUser);
  const ownerName = getEntityNickname(ownerUser);

  return {
    id: ownerId,
    name:
      ownerName ||
      (ownerId && currentUserId && String(ownerId) === String(currentUserId) ? currentUserName : '') ||
      '晨读者'
  };
}

function normalizeInsightDetail(rawInsight) {
  if (!rawInsight) return {};

  const title = rawInsight.sectionId?.title || rawInsight.title || '学习反馈';
  const periodName =
    rawInsight.periodId?.name ||
    rawInsight.periodId?.title ||
    rawInsight.periodName ||
    '七个习惯晨读营';

  return {
    ...rawInsight,
    title,
    periodName
  };
}

Page({
  data: {
    insightId: null,
    insight: {},
    showShareModal: false,
    isDev: env.currentEnv === 'dev',
    posterGenerating: false,
    posterGeneratingMode: '',
    posterTempFilePath: '',
    showPosterPanel: false,
    // 弹幕相关
    danmakuEnabled: true,
    showDanmakuPanel: false,
    danmakuList: [],
    activeDanmaku: [],
    danmakuInput: '',
    danmakuColor: '#4a90e2',
    danmakuColors: [
      { name: '晨蓝', value: '#4a90e2' },
      { name: '暖金', value: '#e6a23c' },
      { name: '草绿', value: '#52c41a' },
      { name: '淡紫', value: '#9b8fc4' },
      { name: '玫瑰', value: '#e8a0b4' }
    ],
    isLiked: false,
    showHearts: false,
    heartItems: []
  },

  // 弹幕引擎内部状态（不需要响应式，放实例属性）
  _danmakuCooldowns: null,   // Map<id, lastShownTimestamp>，用冷却替代永久屏蔽
  _laneReleaseTimes: null,
  _pageScrollHeight: 0,
  _currentScrollPercent: 0,

  onLoad(options) {
    if (!options.id) {
      console.error('缺少 insight ID 参数');
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this._danmakuCooldowns = new Map();
    this._laneReleaseTimes = new Array(DANMAKU_LANES).fill(0);
    const savedDanmaku = wx.getStorageSync('danmakuEnabled');
    this.setData({
      insightId: options.id,
      danmakuEnabled: savedDanmaku === false ? false : true
    });
    this.loadInsightDetail();
    this.loadDanmaku();
  },

  onReady() {
    // 测量页面可滚动高度，用于 scrollPercent 计算
    wx.createSelectorQuery()
      .select('.page-insight-detail')
      .boundingClientRect(rect => {
        if (rect) {
          const sysInfo = wx.getSystemInfoSync();
          this._pageScrollHeight = Math.max(1, rect.height - sysInfo.windowHeight);
        }
      })
      .exec();
  },

  onPageScroll({ scrollTop }) {
    if (this._pageScrollHeight > 0) {
      const percent = Math.min(100, Math.round((scrollTop / this._pageScrollHeight) * 100));
      this._currentScrollPercent = percent;
      if (this.data.danmakuEnabled) {
        this._checkDanmakuTrigger(percent);
      }
    }
  },

  async loadInsightDetail() {
    try {
      const rawInsight = await insightService.getInsightDetail(
        this.data.insightId
      );
      const insight = normalizeInsightDetail(rawInsight);
      const app = getApp();
      const currentUser = app?.globalData?.userInfo || {};
      const currentUserId =
        currentUser?._id || currentUser?.id;
      const owner = resolveInsightOwner(insight, currentUser);
      const isOwnInsight =
        currentUserId && owner.id && String(currentUserId) === String(owner.id);

      if (currentUserId) {
        activityService.track(
          isOwnInsight ? 'own_insight_view' : 'other_insight_view',
          {
            targetType: 'insight',
            targetId: this.data.insightId,
            periodId: insight.periodId?._id || insight.periodId || null,
            sectionId: insight.sectionId?._id || insight.sectionId || null,
            metadata: {
              title: insight.title || ''
            }
          }
        );
      }

      // 添加 dayNumber 字段用于显示
      if (insight && !insight.dayNumber) {
        insight.dayNumber = insight.day || 1;
      }

      // 兼容 HTML 和 Markdown 内容。
      if (insight && insight.content) {
        insight.content = renderRichTextContent(insight.content);
      }

      // 检测当前用户是否已点赞
      const isLiked = Array.isArray(insight.likes) && currentUserId
        ? insight.likes.some(l => String(l.userId || l) === String(currentUserId))
        : false;

      this.setData({ insight, isLiked });
    } catch (error) {
      console.error('加载失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  handleBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  /**
   * 打开分享菜单（仅在开发环境）
   */
  openShareMenu() {
    if (!this.data.isDev) return;
    this.setData({ showShareModal: true });
  },

  /**
   * 关闭分享菜单
   */
  closeShareModal() {
    this.setData({ showShareModal: false });
  },

  /**
   * 分享到微信好友（在菜单中选择时）
   */
  shareToWechatFriend() {
    this.closeShareModal();
    const { insight } = this.data;
    const title = this.getShareTitle(insight);

    wx.shareAppMessage({
      title,
      path: `/pages/insight-detail/insight-detail?id=${this.data.insightId}&from=share`,
      imageUrl: '/assets/images/share-insight.jpg',
      success() {
        wx.showToast({ title: '分享成功', icon: 'success' });
      },
      fail() {
        wx.showToast({ title: '分享失败', icon: 'none' });
      }
    });
  },

  /**
   * 分享到虚拟好友（仅在开发环境）
   */
  shareToVirtualFriend() {
    this.closeShareModal();
    const { insight } = this.data;

    // 模拟分享成功
    wx.showToast({
      title: '已分享给虚拟好友',
      icon: 'success',
      duration: 2000
    });

    console.log('虚拟好友分享:', {
      title: this.getShareTitle(insight),
      path: `/pages/insight-detail/insight-detail?id=${this.data.insightId}&from=share`
    });
  },

  getShareTitle(insight = {}) {
    const app = getApp();
    const owner = resolveInsightOwner(insight, app?.globalData?.userInfo || {});
    return `${insight.title || '凡人共读'} - 致${owner.name}`;
  },

  /**
   * 长图分享入口
   */
  handleLongImageShare(event) {
    const { insight, posterGenerating } = this.data;
    const posterMode = event?.currentTarget?.dataset?.mode || 'hd';
    const isFullPoster = posterMode === 'full';

    if (!insight || !insight.content) {
      wx.showToast({ title: '暂无可生成的内容', icon: 'none' });
      return;
    }

    if (posterGenerating) return;

    this.setData({ posterGenerating: true, posterGeneratingMode: posterMode });
    wx.showLoading({ title: '生成中...', mask: true });

    this._generateInsightLongImage(insight, { mode: posterMode })
      .then(result => {
        this.setData({
          posterGenerating: false,
          posterGeneratingMode: '',
          posterTempFilePath: result.tempFilePath,
          showPosterPanel: true
        });
        wx.hideLoading();
      })
      .catch(error => {
        this.setData({ posterGenerating: false, posterGeneratingMode: '' });
        wx.hideLoading();
        console.error('生成长图失败:', error);
        wx.showToast({
          title: isFullPoster ? '完整长图生成失败' : '长图生成失败',
          icon: 'none'
        });
      });
  },

  closePosterPanel() {
    this.setData({ showPosterPanel: false });
  },

  noop() {},

  handleSavePoster() {
    const { posterTempFilePath } = this.data;
    if (!posterTempFilePath) return;

    wx.saveImageToPhotosAlbum({
      filePath: posterTempFilePath,
      success() {
        wx.showToast({ title: '已保存到相册', icon: 'success' });
      },
      fail(err) {
        if (String(err?.errMsg || '').includes('auth deny') && wx.showModal) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许保存到相册后重试',
            success(res) {
              if (res.confirm && wx.openSetting) wx.openSetting({});
            }
          });
        } else {
          wx.showToast({ title: '保存失败，请重试', icon: 'none' });
        }
      }
    });
  },

  handleSharePoster() {
    const { posterTempFilePath } = this.data;
    if (!posterTempFilePath) return;

    // wx.showShareImageMenu：基础库 2.14.3+，弹出原生图片分享菜单（含"发送给朋友"）
    if (typeof wx.showShareImageMenu === 'function') {
      wx.showShareImageMenu({
        path: posterTempFilePath,
        success: () => {
          this.closePosterPanel();
        },
        fail() {
          wx.showToast({ title: '分享失败，请长按图片操作', icon: 'none' });
        }
      });
      return;
    }

    // 降级：wx.shareImageMessage（2.22.0+）
    if (typeof wx.shareImageMessage === 'function') {
      wx.shareImageMessage({
        imagePath: posterTempFilePath,
        success: () => {
          this.closePosterPanel();
        },
        fail() {
          wx.showToast({ title: '请长按图片选择转发', icon: 'none' });
        }
      });
      return;
    }

    // 最终降级：提示用户长按
    wx.showToast({ title: '请长按图片选择转发', icon: 'none' });
  },

  _stripHtmlForCanvas(html) {
    return (html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  },

  // Parse HTML paragraph inner content into bold/regular runs
  _parseRunsFromHtmlInner(inner) {
    const clean = s => s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"');

    const runs = [];
    const boldRe = /<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi;
    let last = 0;
    let m;

    while ((m = boldRe.exec(inner)) !== null) {
      const before = clean(inner.slice(last, m.index));
      if (before) runs.push({ text: before, bold: false });
      const bt = clean(m[1]);
      if (bt) runs.push({ text: bt, bold: true });
      last = m.index + m[0].length;
    }

    const after = clean(inner.slice(last));
    if (after) runs.push({ text: after, bold: false });
    if (runs.length === 0) {
      const t = clean(inner);
      if (t) runs.push({ text: t, bold: false });
    }
    return runs;
  },

  // Wrap runs into canvas lines, each line is [{text, bold}]
  _wrapRunsForCanvas(ctx, runs, maxWidth, regularFont, boldFont) {
    const lines = [];
    let curLine = [];
    let curW = 0;

    const flush = () => { lines.push(curLine); curLine = []; curW = 0; };

    for (const run of runs) {
      ctx.font = run.bold ? boldFont : regularFont;
      let i = 0;
      const text = run.text;

      while (i < text.length) {
        if (text[i] === '\n') { flush(); i++; continue; }

        let seg = '';
        let j = i;
        while (j < text.length && text[j] !== '\n') {
          const test = seg + text[j];
          if (curW + ctx.measureText(test).width > maxWidth) {
            if (seg) break;
            if (curLine.length > 0) {
              flush();
              continue;
            }
          }
          seg += text[j];
          j++;
        }

        if (!seg) { flush(); seg = text[i]; j = i + 1; }

        curLine.push({ text: seg, bold: run.bold });
        curW += ctx.measureText(seg).width;
        i = j;

        if (i < text.length && text[i] !== '\n') flush();
      }
    }

    if (curLine.length > 0) flush();
    return lines.length > 0 ? lines : [[{ text: '', bold: false }]];
  },

  _hasPosterBlockTags(html = '') {
    return /<(p|li|blockquote|div|h[1-6])\b[^>]*>/i.test(html);
  },

  _collectHtmlParagraphs(html, inheritedQuote = false) {
    const paragraphs = [];
    const blockRegex = /<(p|li|blockquote|div|h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/gi;
    let match;

    while ((match = blockRegex.exec(html)) !== null) {
      const tagName = String(match[1] || '').toLowerCase();
      const attrs = match[2] || '';
      const inner = match[3];
      const isListItem = tagName === 'li';
      const isQuote = inheritedQuote || tagName === 'blockquote' || /border-left/i.test(attrs);

      if (!isListItem && this._hasPosterBlockTags(inner)) {
        paragraphs.push(...this._collectHtmlParagraphs(inner, isQuote));
        continue;
      }

      const runs = isListItem
        ? [{ text: '• ', bold: false }, ...this._parseRunsFromHtmlInner(inner)]
        : this._parseRunsFromHtmlInner(inner);
      const plainText = runs.map(r => r.text).join('').trim();
      if (plainText) paragraphs.push({ runs, isQuote });
    }

    return paragraphs;
  },

  // Parse HTML into paragraphs: [{runs:[{text,bold}], isQuote}]
  _parseHtmlToParagraphs(html) {
    const paragraphs = this._collectHtmlParagraphs(html);

    if (paragraphs.length === 0) {
      this._stripHtmlForCanvas(html).split('\n').forEach(line => {
        const t = line.trim();
        if (t) paragraphs.push({ runs: [{ text: t, bold: false }], isQuote: false });
      });
    }

    return paragraphs;
  },

  _wrapTextForCanvas(ctx, fontStr, text, maxWidth) {
    ctx.font = fontStr;
    const lines = [];
    const paragraphs = text.split('\n');

    for (const para of paragraphs) {
      if (!para.trim()) {
        lines.push('');
        continue;
      }
      let line = '';
      for (const char of para) {
        const test = line + char;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = char;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
    }

    while (lines.length > 0 && !lines[lines.length - 1]) lines.pop();
    return lines.length > 0 ? lines : [''];
  },

  _getCanvasLinesHeight(lines = [], lineHeight) {
    return lines.reduce(
      (sum, line) => sum + (line ? lineHeight : Math.floor(lineHeight * 0.6)),
      0
    );
  },

  _trimTrailingBlankLines(lines = []) {
    const nextLines = [...lines];
    while (nextLines.length > 0 && !nextLines[nextLines.length - 1]) {
      nextLines.pop();
    }
    return nextLines;
  },

  _fitLinesToCanvasHeight(lines = [], maxHeight, lineHeight) {
    const overflowLines = ['……', '打开小程序查看全文'];
    const overflowHeight = this._getCanvasLinesHeight(overflowLines, lineHeight);
    const fittedLines = [];
    let usedHeight = 0;

    for (const line of lines) {
      const currentHeight = line ? lineHeight : Math.floor(lineHeight * 0.6);
      if (usedHeight + currentHeight + overflowHeight > maxHeight) {
        return {
          lines: [...this._trimTrailingBlankLines(fittedLines), ...overflowLines],
          truncated: true
        };
      }

      fittedLines.push(line);
      usedHeight += currentHeight;
    }

    return {
      lines,
      truncated: false
    };
  },

  _getPosterCanvasDpr(height, mode = 'hd') {
    if (mode === 'full') {
      return 1;
    }

    const systemDpr = wx.getWindowInfo?.().pixelRatio || 2;
    return Math.min(systemDpr, height > 3200 ? 1.5 : height > 2200 ? 2 : 3);
  },

  _exportInsightPosterCanvas(canvas, width, height, mode = 'hd') {
    if (mode === 'full') {
      return new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas,
          width,
          height,
          destWidth: width,
          destHeight: height,
          fileType: 'jpg',
          quality: 0.82,
          success: res => resolve(res.tempFilePath),
          fail: reject
        });
      });
    }

    const preferredScales =
      height > 3200 ? [1.25, 1] : height > 2200 ? [1.5, 1.25, 1] : [2, 1.5, 1];
    let attemptIndex = 0;

    return new Promise((resolve, reject) => {
      const tryExport = () => {
        const scale = preferredScales[attemptIndex];

        wx.canvasToTempFilePath({
          canvas,
          width,
          height,
          destWidth: Math.round(width * scale),
          destHeight: Math.round(height * scale),
          fileType: 'png',
          quality: 1,
          success: res => resolve(res.tempFilePath),
          fail: error => {
            const isLastAttempt = attemptIndex >= preferredScales.length - 1;
            if (isLastAttempt) {
              reject(error);
              return;
            }

            console.warn('小凡看见长图导出失败，降低清晰度重试', {
              scale,
              width,
              height,
              error
            });
            attemptIndex += 1;
            tryExport();
          }
        });
      };

      tryExport();
    });
  },

  _generateInsightLongImage(insight, options = {}) {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery().in(this);
      query
        .select('#insightLongImageCanvas')
        .fields({ node: true, size: true })
        .exec(async result => {
          if (!result || !result[0] || !result[0].node) {
            reject(new Error('找不到画布'));
            return;
          }

          try {
            const canvas = result[0].node;
            const ctx = canvas.getContext('2d');
            const mode = options.mode === 'full' ? 'full' : 'hd';
            const W = INSIGHT_POSTER_WIDTH;
            const PADDING = 48;
            const CONTENT_W = W - PADDING * 2;
            const FOOTER_H = 148;
            const TITLE_FONT = 42;
            const TITLE_LINE_H = 58;
            const CONTENT_FONT = 28;
            const CONTENT_LINE_H = 48;
            const PERIOD_FONT = 24;
            const REGULAR_FONT = `${CONTENT_FONT}px sans-serif`;
            const BOLD_FONT = `bold ${CONTENT_FONT}px sans-serif`;

            const rawTitle = insight.title || '小凡看见';
            const periodName = insight.periodName || '凡人共读';
            const htmlParagraphs = this._parseHtmlToParagraphs(insight.content || '');
            const PARA_GAP = Math.floor(CONTENT_LINE_H * 0.75);

            // Pass 1: measure text to compute canvas height
            canvas.width = W;
            canvas.height = 400;

            const titleLines = this._wrapTextForCanvas(
              ctx,
              `bold ${TITLE_FONT}px sans-serif`,
              rawTitle,
              CONTENT_W
            );

            // Wrap each paragraph into lines of [{text, bold}] segments
            const wrappedParas = htmlParagraphs.map(para => {
              const lines = this._wrapRunsForCanvas(ctx, para.runs, CONTENT_W, REGULAR_FONT, BOLD_FONT);
              return { ...para, lines };
            });

            const contentTextH = wrappedParas.reduce((sum, para, i) => {
              return sum + para.lines.length * CONTENT_LINE_H +
                (i < wrappedParas.length - 1 ? PARA_GAP : 0);
            }, 0);
            const headerBodyGap = TITLE_LINE_H + 98;
            const footerGap = 48;
            const H = Math.max(
              PADDING +
                titleLines.length * TITLE_LINE_H +
                headerBodyGap +
                contentTextH +
                footerGap +
                FOOTER_H +
                PADDING,
              700
            );

            // Pass 2: resize canvas and draw
            if (typeof ctx.resetTransform === 'function') {
              ctx.resetTransform();
            } else if (typeof ctx.setTransform === 'function') {
              ctx.setTransform(1, 0, 0, 1, 0, 0);
            }
            const dpr = this._getPosterCanvasDpr(H, mode);
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, W, H);

            // White background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, W, H);

            // 无顶部色条，保持纯白背景

            // Title
            let cursorY = PADDING + TITLE_LINE_H;
            ctx.fillStyle = '#0d4f6c';
            ctx.font = `bold ${TITLE_FONT}px sans-serif`;
            ctx.textBaseline = 'alphabetic';
            ctx.textAlign = 'left';
            for (const line of titleLines) {
              ctx.fillText(line, PADDING, cursorY);
              cursorY += TITLE_LINE_H;
            }

            // Period label
            cursorY += 14;
            ctx.fillStyle = '#2980b9';
            ctx.font = `${PERIOD_FONT}px sans-serif`;
            ctx.fillText(periodName, PADDING, cursorY);
            cursorY += 38;

            // Divider under period label
            cursorY += 10;
            ctx.strokeStyle = '#e2eaf3';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(PADDING, cursorY);
            ctx.lineTo(W - PADDING, cursorY);
            ctx.stroke();
            cursorY += 36;

            // Content text - inline-bold-aware segment rendering
            for (let pi = 0; pi < wrappedParas.length; pi++) {
              const para = wrappedParas[pi];

              if (para.isQuote) {
                ctx.fillStyle = '#d6e4ff';
                ctx.fillRect(PADDING, cursorY - CONTENT_LINE_H + 10, 3, para.lines.length * CONTENT_LINE_H - 10);
              }

              const baseX = para.isQuote ? PADDING + 14 : PADDING;
              for (const lineSegs of para.lines) {
                let segX = baseX;
                for (const seg of lineSegs) {
                  ctx.font = seg.bold ? BOLD_FONT : REGULAR_FONT;
                  ctx.fillStyle = para.isQuote ? '#5b6b8c' : (seg.bold ? '#111827' : '#374151');
                  ctx.fillText(seg.text, segX, cursorY);
                  segX += ctx.measureText(seg.text).width;
                }
                cursorY += CONTENT_LINE_H;
              }

              if (pi < wrappedParas.length - 1) {
                cursorY += PARA_GAP;
              }
            }

            // Footer divider
            const footerTop = cursorY + 56;
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(PADDING, footerTop + 24);
            ctx.lineTo(W - PADDING, footerTop + 24);
            ctx.stroke();

            // QR / logo image (right side)
            let qrImage = null;
            try {
              qrImage = await new Promise((res, rej) => {
                const img = canvas.createImage();
                img.onload = () => res(img);
                img.onerror = rej;
                img.src = '/assets/images/mini-program-code.png';
              });
            } catch (e) {
              // continue without image
            }

            const QR_SIZE = 108;
            const QR_X = W - PADDING - QR_SIZE;
            const QR_Y = footerTop + 44;

            if (qrImage) {
              ctx.drawImage(qrImage, QR_X, QR_Y, QR_SIZE, QR_SIZE);
            }

            // Branding text (left side)
            const brandY = footerTop + 84;
            ctx.fillStyle = '#1f2937';
            ctx.font = 'bold 28px sans-serif';
            ctx.fillText('By 小凡@凡人学堂', PADDING, brandY);

            ctx.fillStyle = '#9ca3af';
            ctx.font = '24px sans-serif';
            ctx.fillText('AI生成，注意甄别！', PADDING, brandY + 40);

            this._exportInsightPosterCanvas(canvas, W, H, mode)
              .then(tempFilePath => resolve({ tempFilePath, contentTruncated: false }))
              .catch(reject);
          } catch (err) {
            reject(err);
          }
        });
    });
  },

  /**
   * 分享到微信好友（系统原生分享）
   */
  onShareAppMessage() {
    const { insight } = this.data;
    return {
      title: this.getShareTitle(insight),
      path: `/pages/insight-detail/insight-detail?id=${this.data.insightId}&from=share`,
      imageUrl: '/assets/images/share-insight.jpg' // 使用新的"小凡看见"专属分享图
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    const { insight } = this.data;
    return {
      title: this.getShareTitle(insight),
      query: `id=${this.data.insightId}&from=share`,
      imageUrl: '/assets/images/share-insight.jpg' // 使用新的"小凡看见"专属分享图
    };
  },

  // ===================== 弹幕功能 =====================

  async loadDanmaku() {
    try {
      const list = await danmakuService.getDanmaku(this.data.insightId);
      this.setData({ danmakuList: Array.isArray(list) ? list : [] });
    } catch (e) {
      // 弹幕加载失败不影响主流程，静默处理
    }
  },

  openDanmakuPanel() {
    this.setData({ showDanmakuPanel: true });
  },

  closeDanmakuPanel() {
    this.setData({ showDanmakuPanel: false });
  },

  toggleDanmaku(e) {
    const val = e.detail.value;
    this.setData({ danmakuEnabled: val });
    wx.setStorageSync('danmakuEnabled', val);
  },

  onDanmakuInput(e) {
    this.setData({ danmakuInput: e.detail.value });
  },

  selectColor(e) {
    this.setData({ danmakuColor: e.currentTarget.dataset.color });
  },

  async sendDanmaku() {
    const { danmakuInput, danmakuColor, insightId } = this.data;
    if (!danmakuInput || !danmakuInput.trim()) return;

    try {
      const result = await danmakuService.postDanmaku(insightId, {
        content: danmakuInput.trim(),
        type: 'comment',
        scrollPercent: this._currentScrollPercent,
        color: danmakuColor
      });

      const newItem = result.data || result;
      const danmakuList = [...this.data.danmakuList, newItem];
      this.setData({ danmakuList, danmakuInput: '' });
      this._showDanmaku(newItem);
      this.closeDanmakuPanel();
    } catch (e) {
      wx.showToast({ title: '发送失败，请重试', icon: 'none' });
    }
  },

  async handleDanmakuLike() {
    const { insightId, isLiked } = this.data;
    try {
      if (isLiked) {
        await insightService.unlikeInsight(insightId);
        const insight = { ...this.data.insight, likeCount: Math.max(0, (this.data.insight.likeCount || 1) - 1) };
        this.setData({ isLiked: false, insight });
      } else {
        await insightService.likeInsight(insightId);
        const app = getApp();
        const currentUser = app?.globalData?.userInfo || {};
        const { danmakuColor } = this.data;

        const likeResult = await danmakuService.postDanmaku(insightId, {
          content: '被你触动到了！❤️',
          type: 'like',
          scrollPercent: this._currentScrollPercent,
          color: danmakuColor
        });

        const likeItem = likeResult.data || likeResult;
        const insight = { ...this.data.insight, likeCount: (this.data.insight.likeCount || 0) + 1 };
        const danmakuList = [...this.data.danmakuList, likeItem];
        this.setData({ isLiked: true, insight, danmakuList });
        // _showDanmaku 内部会因 type==='like' 触发爱心，无需在此额外调用
        this._showDanmaku(likeItem);
        this.closeDanmakuPanel();
      }
    } catch (e) {
      wx.showToast({ title: isLiked ? '取消点赞失败' : '点赞失败', icon: 'none' });
    }
  },

  _showHearts() {
    const emojis = ['💖', '💗', '💝', '💓', '💕', '🌸', '💞', '💘'];
    const count = Math.floor(Math.random() * 4) + 5; // 5-8颗
    // 8个散落目标位置（相对屏幕中心的偏移），覆盖内容区各角落
    const scatter = [
      [-30, -22], [28, -26], [-34, 4], [32, -8],
      [-16, -32], [26, 14], [-24, 20], [36, -32]
    ];
    const heartItems = Array.from({ length: count }, (_, i) => {
      const signX = Math.random() > 0.5 ? 1 : -1;
      const startX = (signX * (Math.random() * 22 + 10)).toFixed(1) + 'vw';
      const startY = (Math.random() * 18 + 28).toFixed(1) + 'vh';
      const dest = scatter[i % scatter.length];
      const destX = (dest[0] + (Math.random() * 6 - 3)).toFixed(1) + 'vw';
      const destY = (dest[1] + (Math.random() * 6 - 3)).toFixed(1) + 'vh';
      return {
        id: Date.now() + i,
        emoji: emojis[i % emojis.length],
        startX, startY, destX, destY,
        delay: (i * 0.2).toFixed(2)
      };
    });
    this.setData({ showHearts: true, heartItems });
    setTimeout(() => this.setData({ showHearts: false, heartItems: [] }), 6000);
  },

  // 触发位置匹配的弹幕（滚动时调用）
  // 使用冷却机制：每条弹幕播完后（动画时长 + 10s 缓冲）可再次出现
  _checkDanmakuTrigger(percent) {
    const { danmakuList } = this.data;
    const cooldowns = this._danmakuCooldowns;
    if (!cooldowns) return;

    const now = Date.now();
    const cooldownMs = (DANMAKU_DURATION + 10) * 1000;

    // 收集所有命中弹幕，按 scrollPercent 升序排列，错峰出场
    const triggered = [];
    danmakuList.forEach(item => {
      const id = item._id || item.id;
      const lastShown = cooldowns.get(id) || 0;
      if (
        Math.abs((item.scrollPercent || 0) - percent) <= 3 &&
        now - lastShown > cooldownMs
      ) {
        cooldowns.set(id, now);
        triggered.push(item);
      }
    });
    triggered.sort((a, b) => (a.scrollPercent || 0) - (b.scrollPercent || 0));
    triggered.forEach((item, idx) => {
      setTimeout(() => this._showDanmaku(item), idx * 600);
    });
  },

  // 将一条弹幕加入屏幕
  _showDanmaku(item) {
    const { activeDanmaku } = this.data;
    if (activeDanmaku.length >= DANMAKU_MAX_VISIBLE) return;

    const now = Date.now();
    const lanes = this._laneReleaseTimes || new Array(DANMAKU_LANES).fill(0);
    // 选一个已释放的最旧泳道
    let lane = 0;
    let earliest = lanes[0];
    for (let i = 1; i < DANMAKU_LANES; i++) {
      if (lanes[i] < earliest) { earliest = lanes[i]; lane = i; }
    }
    // 若最早泳道还未释放，不强行显示（避免叠字）
    if (earliest > now) return;

    const id = `${item._id || item.id}_${now}`;
    const duration = DANMAKU_DURATION;
    // 只锁 7.5s（气泡移出足够距离），不等整个 18s 结束，允许同一泳道队列式进入
    lanes[lane] = now + DANMAKU_LANE_COOLDOWN;
    this._laneReleaseTimes = lanes;

    const danmakuEntry = {
      id,
      nickname: item.userNickname || '',
      msg: item.content,
      lane,
      color: item.color || '#4a90e2',
      duration,
      animDelay: 0
    };

    this.setData({ activeDanmaku: [...activeDanmaku, danmakuEntry] });

    // 点赞弹幕触发爱心效果（弹幕开关开启时）
    if (item.type === 'like' && this.data.danmakuEnabled) {
      setTimeout(() => this._showHearts(), 400);
    }

    // duration 秒后从列表移除
    setTimeout(() => {
      this.setData({
        activeDanmaku: this.data.activeDanmaku.filter(d => d.id !== id)
      });
    }, (duration + 0.5) * 1000);
  }
});
