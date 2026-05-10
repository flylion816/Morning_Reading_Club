const insightService = require('../../services/insight.service');
const env = require('../../config/env');
const { renderRichTextContent } = require('../../utils/markdown');
const activityService = require('../../services/activity.service');

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
    posterTempFilePath: '',
    showPosterPanel: false
  },

  onLoad(options) {
    if (!options.id) {
      console.error('缺少 insight ID 参数');
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ insightId: options.id });
    this.loadInsightDetail();
  },

  async loadInsightDetail() {
    try {
      const rawInsight = await insightService.getInsightDetail(
        this.data.insightId
      );
      const insight = normalizeInsightDetail(rawInsight);
      const app = getApp();
      const currentUserId =
        app?.globalData?.userInfo?._id || app?.globalData?.userInfo?.id;
      const ownerId =
        insight.userId?._id ||
        insight.userId ||
        insight.targetUserId?._id ||
        insight.targetUserId;
      const isOwnInsight =
        currentUserId && ownerId && String(currentUserId) === String(ownerId);

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

      this.setData({ insight });
    } catch (error) {
      console.error('加载失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  handleBack() {
    wx.navigateBack({
      delta: 1
    });
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

    wx.shareAppMessage({
      title: `${insight.title || '晨读营'} - 小凡看见`,
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
      title: `${insight.title || '晨读营'} - 小凡看见`,
      path: `/pages/insight-detail/insight-detail?id=${this.data.insightId}&from=share`
    });
  },

  /**
   * 长图分享入口
   */
  handleLongImageShare() {
    const { insight, posterGenerating } = this.data;

    if (!insight || !insight.content) {
      wx.showToast({ title: '暂无可生成的内容', icon: 'none' });
      return;
    }

    if (posterGenerating) return;

    this.setData({ posterGenerating: true });
    wx.showLoading({ title: '生成中...', mask: true });

    this._generateInsightLongImage(insight)
      .then(tempFilePath => {
        this.setData({
          posterGenerating: false,
          posterTempFilePath: tempFilePath,
          showPosterPanel: true
        });
        wx.hideLoading();
      })
      .catch(error => {
        this.setData({ posterGenerating: false });
        wx.hideLoading();
        console.error('生成长图失败:', error);
        wx.showToast({ title: '长图生成失败', icon: 'none' });
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

  _generateInsightLongImage(insight) {
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
            const dpr = wx.getWindowInfo?.().pixelRatio || 2;

            const W = 750;
            const PADDING = 56;
            const CONTENT_W = W - PADDING * 2;
            const FOOTER_H = 180;
            const TITLE_LINE_H = 74;
            const CONTENT_LINE_H = 50;

            const rawTitle = insight.title || '小凡看见';
            const rawContent = this._stripHtmlForCanvas(insight.content || '');
            const periodName = insight.periodName || '凡人共读';

            // Pass 1: measure text to compute canvas height
            canvas.width = W * dpr;
            canvas.height = 400 * dpr;
            ctx.scale(dpr, dpr);

            const titleLines = this._wrapTextForCanvas(ctx, 'bold 52px sans-serif', rawTitle, CONTENT_W);
            const contentLines = this._wrapTextForCanvas(ctx, '30px sans-serif', rawContent, CONTENT_W);

            const contentTextH = contentLines.reduce(
              (sum, line) => sum + (line ? CONTENT_LINE_H : Math.floor(CONTENT_LINE_H * 0.6)),
              0
            );
            const H = Math.max(
              PADDING + titleLines.length * TITLE_LINE_H + 56 + 36 + 56 + contentTextH + 64 + FOOTER_H + PADDING,
              900
            );

            // Pass 2: resize canvas and draw
            if (typeof ctx.resetTransform === 'function') {
              ctx.resetTransform();
            } else if (typeof ctx.setTransform === 'function') {
              ctx.setTransform(1, 0, 0, 1, 0, 0);
            }
            canvas.width = W * dpr;
            canvas.height = H * dpr;
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, W, H);

            // White background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, W, H);

            // Top accent bar
            ctx.fillStyle = '#0d4f6c';
            ctx.fillRect(0, 0, W, 8);

            // Title — large bold dark teal (参考 Image #7 风格)
            let cursorY = PADDING + TITLE_LINE_H;
            ctx.fillStyle = '#0d4f6c';
            ctx.font = 'bold 52px sans-serif';
            ctx.textBaseline = 'alphabetic';
            ctx.textAlign = 'left';
            for (const line of titleLines) {
              ctx.fillText(line, PADDING, cursorY);
              cursorY += TITLE_LINE_H;
            }

            // Period label
            cursorY += 24;
            ctx.fillStyle = '#2980b9';
            ctx.font = '26px sans-serif';
            ctx.fillText(periodName, PADDING, cursorY);
            cursorY += 44;

            // Divider under period label
            cursorY += 16;
            ctx.strokeStyle = '#e2eaf3';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(PADDING, cursorY);
            ctx.lineTo(W - PADDING, cursorY);
            ctx.stroke();
            cursorY += 40;

            // Content text
            ctx.fillStyle = '#374151';
            ctx.font = '30px sans-serif';
            for (const line of contentLines) {
              if (line) {
                ctx.fillText(line, PADDING, cursorY);
                cursorY += CONTENT_LINE_H;
              } else {
                cursorY += Math.floor(CONTENT_LINE_H * 0.6);
              }
            }

            // Footer divider
            const footerTop = H - FOOTER_H;
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

            // Export to temp file
            const scale = H > 2200 ? 1.5 : 2;
            wx.canvasToTempFilePath({
              canvas,
              width: W,
              height: H,
              destWidth: Math.round(W * scale),
              destHeight: Math.round(H * scale),
              fileType: 'png',
              quality: 1,
              success: res => resolve(res.tempFilePath),
              fail: err => reject(err)
            });
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
    const app = getApp();
    const userName = app.globalData.userInfo?.nickname || '晨读者';
    return {
      title: `${insight.title || '凡人共读'} - 致${userName}`,
      path: `/pages/insight-detail/insight-detail?id=${this.data.insightId}&from=share`,
      imageUrl: '/assets/images/share-insight.jpg' // 使用新的"小凡看见"专属分享图
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    const { insight } = this.data;
    const app = getApp();
    const userName = app.globalData.userInfo?.nickname || '晨读者';
    return {
      title: `${insight.title || '凡人共读'} - 致${userName}`,
      query: `id=${this.data.insightId}&from=share`,
      imageUrl: '/assets/images/share-insight.jpg' // 使用新的"小凡看见"专属分享图
    };
  }
});
