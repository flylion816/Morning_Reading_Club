const courseService = require('../../services/course.service');
const checkinService = require('../../services/checkin.service');
const commentService = require('../../services/comment.service');
const activityService = require('../../services/activity.service');
const subscribeMessageService = require('../../services/subscribe-message.service');
const subscribeAutoTopUp = require('../../utils/subscribe-auto-topup');
const constants = require('../../config/constants');
const { getAvatarColorByUserId } = require('../../utils/formatters');
const { getPeriodAccess, extractId } = require('../../utils/period-access');
const { renderRichTextContent } = require('../../utils/markdown');

const COMMUNITY_AUTO_TOP_UP_SCENES = [
  'comment_received',
  'like_received',
  'next_day_study_reminder'
];

const MINI_PROGRAM_CODE_ASSET_PATHS = [
  '/assets/images/mini-program-code.png',
  '../../assets/images/mini-program-code.png'
];
const SECTION_CHECKIN_FETCH_LIMIT = 30;
const CHECKIN_CONTENT_FOLD_LINE_LIMIT = 6;
const CHECKIN_CONTENT_FOLD_UNITS_PER_LINE = 18;

const POSTER_STYLE_PRESETS = [
  {
    id: 'aurora',
    name: '青岚',
    cardFill: '#ffffff',
    bgColors: ['#dff9ef', '#8fe5db', '#f7fffd'],
    accentColors: ['#50d1b2', '#7dd8ff'],
    chipFill: '#eefaf7',
    chipText: '#24a381',
    contentCardFill: '#ffffff',
    footerText: '#8fa0b2'
  },
  {
    id: 'lilac',
    name: '暮紫',
    cardFill: '#ffffff',
    bgColors: ['#f5ebff', '#d7dcff', '#fff9ff'],
    accentColors: ['#9e84ff', '#e7a7ff'],
    chipFill: '#f4eeff',
    chipText: '#775ee8',
    contentCardFill: '#ffffff',
    footerText: '#988fb5'
  },
  {
    id: 'sky',
    name: '晴空',
    cardFill: '#ffffff',
    bgColors: ['#dff2ff', '#8fd1ff', '#ffffff'],
    accentColors: ['#4b8cff', '#7cc7ff'],
    chipFill: '#edf4ff',
    chipText: '#356ed9',
    contentCardFill: '#ffffff',
    footerText: '#8ba1bf'
  },
  {
    id: 'paper',
    name: '留白',
    cardFill: '#fffdf8',
    bgColors: ['#f7f4ee', '#ffffff', '#f3f6fb'],
    accentColors: ['#2c3f63', '#5d7596'],
    chipFill: '#f2efe8',
    chipText: '#516278',
    contentCardFill: '#ffffff',
    footerText: '#9da7b6'
  }
];

function normalizeCheckinListResponse(response) {
  if (!response) return [];

  const candidates = [
    response.data,
    response.list,
    response.items,
    response.docs,
    response.rows,
    response
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  if (response.data && typeof response.data === 'object') {
    if (Array.isArray(response.data.list)) return response.data.list;
    if (Array.isArray(response.data.items)) return response.data.items;
    if (Array.isArray(response.data.docs)) return response.data.docs;
    if (Array.isArray(response.data.rows)) return response.data.rows;
  }

  return [];
}

Page({
  data: {
    courseId: null,
    periodId: null,
    paymentStatus: null,
    course: {},
    calendar: [],
    checkedDays: 0,
    loading: true,
    canAccessCommunity: false,
    communityAccessState: 'locked',
    hasUserCheckedIn: false,
    commentExpanded: {},
    commentLoading: {},
    notificationReminder: '',
    isCheckinDetailMode: false,
    detailCheckin: null,
    posterGenerating: false,
    posterTempFilePath: '',
    posterSourceCheckinId: '',
    posterGalleryVisible: false,
    posterGalleryItems: [],
    posterSelectedIndex: 0,
    selectedPoster: null,
    focusCheckinId: '',
    focusCommentId: '',
    focusReplyId: '',
    shareCheckinId: '',
    shareCheckinUserName: '',
    canShareCurrentCheckin: true,
    checkinContentExpanded: {},
    highlightCheckinId: '',
    highlightCommentId: '',
    highlightReplyId: '',
    checkinPage: 1,
    checkinHasMore: false,
    checkinLoadingMore: false
  },

  onLoad(options) {
    console.log('课程详情页加载，参数:', options);
    this._skipNextOnShowRefresh = true;
    if (!options.id) {
      console.error('缺少课程 ID 参数');
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({
      courseId: options.id,
      periodId: options.periodId || null,
      paymentStatus: null,
      canAccessCommunity: false,
      communityAccessState: 'locked',
      isCheckinDetailMode: !!options.checkinId,
      detailCheckin: null,
      posterGenerating: false,
      posterTempFilePath: '',
      posterSourceCheckinId: '',
      posterGalleryVisible: false,
      posterGalleryItems: [],
      posterSelectedIndex: 0,
      selectedPoster: null,
      focusCheckinId: options.checkinId || '',
      focusCommentId: options.commentId || '',
      focusReplyId: options.replyId || '',
      shareCheckinId: options.checkinId || '',
      shareCheckinUserName: '',
      canShareCurrentCheckin: !options.checkinId,
      checkinContentExpanded: {}
    });

    this.updateShareMenu(!options.checkinId, !!options.checkinId);

    if (options.checkinId) {
      wx.setNavigationBarTitle({
        title: '动态详情'
      });
    }
    this.loadCourseDetail();
  },

  onUnload() {
    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
    }
  },

  onShow() {
    if (this._skipNextOnShowRefresh) {
      this._skipNextOnShowRefresh = false;
      return;
    }

    // 每次显示页面时重新加载，以显示最新的打卡记录
    if (this.data.courseId && this.data.course) {
      this.loadCourseDetail();
    }
  },

  onShareAppMessage() {
    const {
      course,
      courseId,
      shareCheckinId,
      shareCheckinUserName,
      canShareCurrentCheckin
    } = this.data;

    if (shareCheckinId && canShareCurrentCheckin) {
      return {
        title: shareCheckinUserName
          ? `${shareCheckinUserName}的打卡日记`
          : course.title || '动态详情',
        path: `/pages/course-detail/course-detail?id=${courseId}&checkinId=${shareCheckinId}`
      };
    }

    return {
      title: course.title || '课程详情',
      path: `/pages/course-detail/course-detail?id=${courseId}`
    };
  },

  onShareTimeline() {
    const {
      course,
      courseId,
      shareCheckinId,
      shareCheckinUserName,
      canShareCurrentCheckin
    } = this.data;

    if (shareCheckinId && canShareCurrentCheckin) {
      return {
        title: shareCheckinUserName
          ? `${shareCheckinUserName}的打卡日记`
          : course.title || '动态详情',
        query: `id=${courseId}&checkinId=${shareCheckinId}`
      };
    }

    return {
      title: course.title || '课程详情',
      query: `id=${courseId}`
    };
  },

  /**
   * 清理 HTML，使其与小程序 rich-text 兼容
   * 小程序 rich-text 支持：p、br、strong、em、u、s、span、img、a、li、ol、ul 等标签
   */
  cleanHtmlForRichText(content) {
    if (!content) return '';

    let cleaned = renderRichTextContent(content);

    // 1. 移除 class 属性
    cleaned = cleaned.replace(/\s+class="[^"]*"/gi, '');

    // 2. 仅移除图片旧样式，保留 Markdown 渲染所需的段落/列表样式
    cleaned = cleaned.replace(/<img([^>]*?)\s+style="[^"]*"/gi, '<img$1');

    // 3. 识别手工输入的列表项格式（如"1. 文本"、"2. 文本"）并增加间距
    // 匹配 <p> 标签中以数字+点开头的内容
    cleaned = cleaned.replace(
      /<p>(\d+\.\s)/gi,
      '<p style="margin-bottom:16px;">$1'
    );

    // 4. 为所有 <img> 标签添加合适的 style
    // 关键：使用 display:block 和 width:100% 让图片充满容器
    cleaned = cleaned.replace(
      /<img([^>]*?)>/gi,
      '<img$1 style="display:block;width:100%;height:auto;margin:12px 0;border-radius:4px;" />'
    );

    // 5. 确保所有图片都有 alt 属性
    cleaned = cleaned.replace(/<img([^>]*?)src/gi, (match, before) => {
      if (!before.includes('alt=')) {
        return `<img${before}alt="图片" src`;
      }
      return match;
    });

    // 6. 移除其他不必要的属性（保留 src, href, alt, style）
    cleaned = cleaned.replace(/\s+(?!src|href|alt|style)[\w-]+="[^"]*"/gi, '');

    return cleaned;
  },

  /**
   * 检查内容是否为空（包括去除空格）
   */
  isContentEmpty(content) {
    if (!content) return true;
    if (typeof content === 'string') {
      return content.trim() === '';
    }
    return false;
  },

  normalizeId(value) {
    if (!value) return '';
    if (typeof value === 'object') {
      return String(value._id || value.id || '');
    }
    return String(value);
  },

  getCurrentUserId() {
    const app = getApp();
    return this.normalizeId(
      app.globalData.userInfo?._id || app.globalData.userInfo?.id
    );
  },

  getCheckinContentUnits(text = '') {
    return Array.from(String(text || '')).reduce((sum, char) => {
      return sum + (/[^\x00-\xff]/.test(char) ? 1 : 0.5);
    }, 0);
  },

  estimateCheckinContentLines(text = '') {
    const paragraphs = String(text || '')
      .replace(/\r/g, '')
      .split('\n');

    return paragraphs.reduce((total, paragraph) => {
      const units = this.getCheckinContentUnits(paragraph || ' ');
      return (
        total +
        Math.max(1, Math.ceil(units / CHECKIN_CONTENT_FOLD_UNITS_PER_LINE))
      );
    }, 0);
  },

  shouldFoldCheckinContent(text = '') {
    return (
      this.estimateCheckinContentLines(text) > CHECKIN_CONTENT_FOLD_LINE_LIMIT
    );
  },

  isOwnCheckin(checkin = {}) {
    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) {
      return false;
    }

    return String(this.normalizeId(checkin.userId)) === String(currentUserId);
  },

  updateShareMenu(
    canShare = true,
    forceDetailMode = this.data.isCheckinDetailMode
  ) {
    if (forceDetailMode && !canShare) {
      if (typeof wx.hideShareMenu === 'function') {
        wx.hideShareMenu();
      }
      return;
    }

    if (typeof wx.showShareMenu === 'function') {
      wx.showShareMenu({
        withShareTicket: false
      });
    }
  },

  buildCheckinItem(checkin = {}) {
    const app = getApp();
    const currentUserId =
      app.globalData.userInfo?._id || app.globalData.userInfo?.id;
    const userInfo =
      checkin.userId && typeof checkin.userId === 'object'
        ? checkin.userId
        : {};
    const sectionInfo =
      checkin.sectionId && typeof checkin.sectionId === 'object'
        ? checkin.sectionId
        : {};
    const periodInfo =
      checkin.periodId && typeof checkin.periodId === 'object'
        ? checkin.periodId
        : {};
    const userName = userInfo.nickname || checkin.userName || '匿名用户';
    const avatarUrl = userInfo.avatarUrl || '';
    const normalizedUserId = this.normalizeId(
      userInfo._id || userInfo.id || checkin.userId || userName
    );
    const id = this.normalizeId(checkin._id || checkin.id);
    const content = checkin.note || checkin.content || '';

    return {
      id,
      userId: this.normalizeId(userInfo._id || userInfo.id || checkin.userId),
      periodId: this.normalizeId(
        periodInfo._id ||
          periodInfo.id ||
          checkin.periodId ||
          this.data.periodId
      ),
      sectionId: this.normalizeId(
        sectionInfo._id ||
          sectionInfo.id ||
          checkin.sectionId ||
          this.data.courseId
      ),
      userName,
      avatarText: avatarUrl ? '' : userName ? userName.charAt(0) : '👤',
      avatarUrl,
      avatarColor:
        checkin.avatarColor || getAvatarColorByUserId(normalizedUserId),
      content,
      canExpandContent: this.shouldFoldCheckinContent(content),
      contentExpanded: !!this.data.checkinContentExpanded[id],
      createTime:
        checkin.createdAt || checkin.checkinDate
          ? this.formatTime(checkin.createdAt || checkin.checkinDate)
          : '刚刚',
      checkinDate: checkin.checkinDate || checkin.createdAt || '',
      likeCount: checkin.likeCount || 0,
      isLiked:
        Array.isArray(checkin.likes) && currentUserId
          ? checkin.likes.some(
              (like) =>
                String(
                  like.userId?._id || like.userId?.id || like.userId || like
                ) === String(currentUserId)
            )
          : false,
      replies: [],
      day: checkin.day ?? sectionInfo.day ?? this.data.course?.day ?? null,
      sectionDay:
        sectionInfo.day ?? checkin.day ?? this.data.course?.day ?? null,
      sectionTitle: sectionInfo.title || this.data.course?.title || '晨读任务',
      sectionIcon: sectionInfo.icon || '',
      periodTitle:
        periodInfo.title ||
        periodInfo.name ||
        this.data.course?.periodId?.title ||
        this.data.course?.periodId?.name ||
        ''
    };
  },

  formatDetailDateTime(dateStr) {
    if (!dateStr) return '';

    try {
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) {
        return '';
      }

      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const mi = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
    } catch (error) {
      return '';
    }
  },

  buildDetailCheckinData(checkin) {
    if (!checkin) {
      return null;
    }

    const sectionDay =
      checkin.sectionDay || checkin.day || this.data.course?.day || null;
    const metaParts = [];
    if (sectionDay) {
      metaParts.push(`第${sectionDay}天打卡`);
      metaParts.push(`第${sectionDay}个任务`);
    } else {
      metaParts.push('打卡日记');
    }

    const periodTitle =
      checkin.periodTitle ||
      this.data.course?.periodId?.title ||
      this.data.course?.periodId?.name ||
      '';
    const sectionTitle =
      checkin.sectionTitle || this.data.course?.title || '晨读任务';
    const hashTag = sectionDay
      ? `#第${sectionDay}天 ${sectionTitle}`
      : `#${sectionTitle}`;
    const checkinId = this.normalizeId(checkin.id || checkin._id);

    return {
      ...checkin,
      metaLine: metaParts.join(' | '),
      hashTag,
      periodChip: periodTitle || sectionTitle,
      dateLabel: this.formatDetailDateTime(checkin.checkinDate),
      commentCount: Array.isArray(checkin.replies) ? checkin.replies.length : 0,
      canShare:
        this.isOwnCheckin(checkin) ||
        (this.data.isCheckinDetailMode && !!this.data.canShareCurrentCheckin),
      canExpandContent:
        checkin.canExpandContent ||
        this.shouldFoldCheckinContent(checkin.content),
      contentExpanded: !!this.data.checkinContentExpanded[checkinId]
    };
  },

  syncDetailCheckinState(checkinId = this.data.shareCheckinId) {
    if (!this.data.isCheckinDetailMode || !checkinId) {
      return;
    }

    const targetCheckin = (this.data.course.comments || []).find(
      (item) => String(item.id || item._id) === String(checkinId)
    );

    if (!targetCheckin) {
      this.setData({
        detailCheckin: null,
        canShareCurrentCheckin: false
      });
      this.updateShareMenu(false);
      return;
    }

    const detailCheckin = this.buildDetailCheckinData(targetCheckin);
    this.setData({
      detailCheckin,
      canShareCurrentCheckin: !!detailCheckin.canShare
    });
    this.updateShareMenu(!!detailCheckin.canShare);
  },

  syncCheckinContentExpandedState(checkinId, expanded) {
    if (!checkinId) {
      return;
    }

    const nextExpandedMap = {
      ...this.data.checkinContentExpanded,
      [checkinId]: expanded
    };

    const nextComments = Array.isArray(this.data.course?.comments)
      ? this.data.course.comments.map((item) => {
          if (String(item.id || item._id) !== String(checkinId)) {
            return item;
          }

          return {
            ...item,
            contentExpanded: expanded
          };
        })
      : null;

    const nextData = {
      checkinContentExpanded: nextExpandedMap
    };

    if (nextComments) {
      nextData.course = {
        ...this.data.course,
        comments: nextComments
      };
    }

    if (
      this.data.detailCheckin &&
      String(this.data.detailCheckin.id) === String(checkinId)
    ) {
      nextData.detailCheckin = {
        ...this.data.detailCheckin,
        contentExpanded: expanded
      };
    }

    this.setData(nextData);
  },

  toggleCheckinContent(e) {
    const { checkinId } = e.currentTarget.dataset;
    const expanded = !this.data.checkinContentExpanded[checkinId];
    this.syncCheckinContentExpandedState(checkinId, expanded);
  },

  getPosterTextUnits(text = '') {
    return Array.from(String(text)).reduce((sum, char) => {
      return sum + (/[^\x00-\xff]/.test(char) ? 2 : 1);
    }, 0);
  },

  wrapPosterText(text = '', maxUnits = 34) {
    const lines = [];
    const paragraphs = String(text || '').split('\n');

    paragraphs.forEach((paragraph, paragraphIndex) => {
      const trimmed = paragraph.replace(/\r/g, '');
      if (!trimmed) {
        lines.push('');
        return;
      }

      let currentLine = '';
      let currentUnits = 0;

      Array.from(trimmed).forEach((char) => {
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

      if (paragraphIndex < paragraphs.length - 1) {
        lines.push('');
      }
    });

    return lines.length > 0 ? lines : [''];
  },

  buildPosterSnapshot(detailCheckin, stylePreset = POSTER_STYLE_PRESETS[0]) {
    const contentText = String(
      detailCheckin?.content || '这篇打卡还没有填写正文'
    );
    const contentLines = this.wrapPosterText(contentText, 34);
    const titleLines = this.wrapPosterText(
      `${detailCheckin?.userName || '伙伴'}的打卡日记`,
      22
    );
    const tagLines = detailCheckin?.hashTag
      ? this.wrapPosterText(detailCheckin.hashTag, 28)
      : [];
    const periodChip =
      detailCheckin?.periodChip || detailCheckin?.sectionTitle || '晨读任务';
    const dateLabel = detailCheckin?.dateLabel || '';
    const sectionTitle = detailCheckin?.sectionTitle || '晨读任务';
    const statsLine = `获赞 ${detailCheckin?.likeCount || 0} · 评论 ${detailCheckin?.commentCount || 0}`;
    const lineHeight = 54;
    const baseHeight =
      180 +
      titleLines.length * 54 +
      120 +
      contentLines.length * lineHeight +
      (tagLines.length > 0 ? tagLines.length * 44 + 20 : 0) +
      170 +
      110;

    return {
      width: 1040,
      height: Math.max(1480, baseHeight),
      titleLines,
      contentLines,
      tagLines,
      periodChip,
      dateLabel,
      sectionTitle,
      statsLine,
      authorName: detailCheckin?.userName || '伙伴',
      authorMeta: detailCheckin?.metaLine || '打卡日记',
      avatarText:
        detailCheckin?.avatarText ||
        (detailCheckin?.userName || '伙').charAt(0) ||
        '伙',
      miniProgramCodePath: MINI_PROGRAM_CODE_ASSET_PATHS[0],
      styleId: stylePreset.id,
      styleName: stylePreset.name,
      stylePreset
    };
  },

  async loadPosterImage(canvas, srcCandidates = []) {
    if (!canvas || typeof canvas.createImage !== 'function') {
      throw new Error('当前环境不支持图片绘制');
    }

    const candidates = Array.isArray(srcCandidates)
      ? srcCandidates
      : [srcCandidates];
    let lastError = null;

    for (const src of candidates) {
      if (!src) {
        continue;
      }

      try {
        const image = await new Promise((resolve, reject) => {
          const instance = canvas.createImage();
          instance.onload = () => resolve(instance);
          instance.onerror = (error) =>
            reject(error || new Error(`加载图片失败: ${src}`));
          instance.src = src;
        });
        return image;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('加载图片失败');
  },

  async getPosterCanvasNode() {
    if (!wx.createSelectorQuery) {
      throw new Error('当前环境不支持长图生成');
    }

    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery();
      if (typeof query.in === 'function') {
        query.in(this);
      }

      query
        .select('#longImageCanvas')
        .fields({ node: true, size: true })
        .exec((result) => {
          const target = result && result[0];
          if (!target || !target.node) {
            reject(new Error('找不到长图画布'));
            return;
          }
          resolve(target);
        });
    });
  },

  drawPosterRoundedRect(ctx, x, y, width, height, radius, fillStyle) {
    ctx.save();
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
    ctx.restore();
  },

  drawPosterTextLines(ctx, lines, startX, startY, lineHeight) {
    let cursorY = startY;
    lines.forEach((line) => {
      if (!line) {
        cursorY += Math.floor(lineHeight * 0.65);
        return;
      }

      ctx.fillText(line, startX, cursorY);
      cursorY += lineHeight;
    });
    return cursorY;
  },

  drawPosterDecoration(ctx, snapshot, stylePreset) {
    const cardMargin = 48;
    const cardX = cardMargin;
    const cardY = cardMargin;
    const cardWidth = snapshot.width - cardMargin * 2;
    const cardHeight = snapshot.height - cardMargin * 2;
    const borderRadius = 40;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.06)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 12;
    this.drawPosterRoundedRect(
      ctx,
      cardX,
      cardY,
      cardWidth,
      cardHeight,
      borderRadius,
      '#ffffff'
    );
    ctx.restore();

    const clipInner = () => {
      ctx.beginPath();
      ctx.moveTo(cardX + borderRadius, cardY);
      ctx.lineTo(cardX + cardWidth - borderRadius, cardY);
      ctx.arcTo(
        cardX + cardWidth,
        cardY,
        cardX + cardWidth,
        cardY + borderRadius,
        borderRadius
      );
      ctx.lineTo(cardX + cardWidth, cardY + cardHeight - borderRadius);
      ctx.arcTo(
        cardX + cardWidth,
        cardY + cardHeight,
        cardX + cardWidth - borderRadius,
        cardY + cardHeight,
        borderRadius
      );
      ctx.lineTo(cardX + borderRadius, cardY + cardHeight);
      ctx.arcTo(
        cardX,
        cardY + cardHeight,
        cardX,
        cardY + cardHeight - borderRadius,
        borderRadius
      );
      ctx.lineTo(cardX, cardY + borderRadius);
      ctx.arcTo(cardX, cardY, cardX + borderRadius, cardY, borderRadius);
      ctx.closePath();
      ctx.clip();
    };

    ctx.save();
    clipInner();

    if (stylePreset.id === 'aurora') {
      ctx.globalAlpha = 0.5;
      const grad1 = ctx.createLinearGradient(0, 0, snapshot.width, 400);
      grad1.addColorStop(0, stylePreset.accentColors[0]);
      grad1.addColorStop(1, '#ffffff');
      ctx.fillStyle = grad1;
      ctx.beginPath();
      ctx.arc(snapshot.width - 50, 50, 400, 0, Math.PI * 2);
      ctx.fill();

      const grad2 = ctx.createLinearGradient(0, 0, 400, 400);
      grad2.addColorStop(0, stylePreset.accentColors[1]);
      grad2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad2;
      ctx.beginPath();
      ctx.arc(cardX, 300, 350, 0, Math.PI * 2);
      ctx.fill();
    } else if (stylePreset.id === 'lilac') {
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = stylePreset.accentColors[0];
      ctx.beginPath();
      ctx.arc(cardWidth / 2 + cardX, cardY - 50, 450, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.3;
      const grad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + 400);
      grad.addColorStop(0, stylePreset.bgColors[0]);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cardX, cardY, cardWidth, 400);
    } else if (stylePreset.id === 'sky') {
      const grad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + 400);
      grad.addColorStop(0, stylePreset.accentColors[0] || '#4b8cff');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = grad;
      ctx.fillRect(cardX, cardY, cardWidth, 500);

      ctx.globalAlpha = 0.08;
      ctx.fillStyle = stylePreset.accentColors[0];
      this.drawPosterRoundedRect(
        ctx,
        cardX + 32,
        cardY + 32,
        cardWidth - 64,
        280,
        24,
        stylePreset.accentColors[0]
      );
    } else if (stylePreset.id === 'paper') {
      ctx.globalAlpha = 0.02;
      ctx.fillStyle = stylePreset.accentColors[0];
      ctx.font = 'bold italic 160px sans-serif';
      ctx.fillText('DIARY', snapshot.width - 450, cardY + 160);
    }

    ctx.restore();
  },

  drawPosterOutline(
    ctx,
    x,
    y,
    width,
    height,
    radius,
    strokeStyle,
    lineWidth = 2
  ) {
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
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
    ctx.stroke();
    ctx.restore();
  },

  async generateLongImagePoster(
    detailCheckin,
    stylePreset = POSTER_STYLE_PRESETS[0]
  ) {
    const snapshot = this.buildPosterSnapshot(detailCheckin, stylePreset);
    const target = await this.getPosterCanvasNode();
    const canvas = target.node;
    const ctx = canvas.getContext('2d');
    const dpr = wx.getSystemInfoSync?.().pixelRatio || 2;
    let miniProgramCodeImage = null;

    canvas.width = snapshot.width * dpr;
    canvas.height = snapshot.height * dpr;

    if (typeof ctx.resetTransform === 'function') {
      ctx.resetTransform();
    } else if (typeof ctx.setTransform === 'function') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, snapshot.width, snapshot.height);

    try {
      miniProgramCodeImage = await this.loadPosterImage(
        canvas,
        MINI_PROGRAM_CODE_ASSET_PATHS
      );
    } catch (error) {
      console.warn('加载小程序码失败，继续生成无二维码长图', error);
    }

    const backgroundGradient = ctx.createLinearGradient(
      0,
      0,
      0,
      snapshot.height
    );
    backgroundGradient.addColorStop(0, stylePreset.bgColors[0] || '#eaf3ff');
    backgroundGradient.addColorStop(0.5, stylePreset.bgColors[1] || '#f8fbff');
    backgroundGradient.addColorStop(1, stylePreset.bgColors[2] || '#ffffff');
    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, snapshot.width, snapshot.height);

    this.drawPosterDecoration(ctx, snapshot, stylePreset);

    const avatarGradient = ctx.createLinearGradient(96, 160, 220, 260);
    avatarGradient.addColorStop(0, stylePreset.accentColors[0]);
    avatarGradient.addColorStop(1, stylePreset.accentColors[1]);
    ctx.fillStyle = avatarGradient;
    ctx.beginPath();
    ctx.arc(140, 152, 44, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(snapshot.avatarText, 140, 152);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#8b94a5';
    ctx.font = '24px sans-serif';
    ctx.fillText(snapshot.authorMeta, 204, 140);
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(snapshot.authorName, 204, 182);

    const contentStartX = stylePreset.id === 'paper' ? 152 : 96;
    let cursorY = stylePreset.id === 'paper' ? 242 : 260;
    ctx.fillStyle = stylePreset.id === 'paper' ? '#22324a' : '#111827';
    ctx.font = 'bold 44px sans-serif';
    cursorY = this.drawPosterTextLines(
      ctx,
      snapshot.titleLines,
      contentStartX,
      cursorY,
      58
    );

    ctx.fillStyle = stylePreset.id === 'paper' ? '#607089' : '#6b7280';
    ctx.font = '26px sans-serif';
    cursorY += 14;
    ctx.fillText(snapshot.sectionTitle, contentStartX, cursorY);

    cursorY += 80;
    ctx.fillStyle = '#1f2937';
    ctx.font = '34px sans-serif';
    cursorY = this.drawPosterTextLines(
      ctx,
      snapshot.contentLines,
      contentStartX,
      cursorY,
      56
    );

    if (snapshot.tagLines.length > 0) {
      cursorY += 32;
      ctx.fillStyle = stylePreset.chipText;
      ctx.font = '28px sans-serif';
      cursorY = this.drawPosterTextLines(
        ctx,
        snapshot.tagLines,
        contentStartX,
        cursorY,
        44
      );
    }

    cursorY += 40;
    const chipPadding = 24;
    ctx.font = '24px sans-serif';
    const chipTextParam = snapshot.periodChip;
    const textWidth = ctx.measureText(chipTextParam).width;
    this.drawPosterRoundedRect(
      ctx,
      contentStartX,
      cursorY - 26,
      textWidth + chipPadding * 2,
      54,
      27,
      stylePreset.chipFill
    );
    ctx.fillStyle = stylePreset.chipText;
    ctx.font = '24px sans-serif';
    ctx.fillText(chipTextParam, contentStartX + chipPadding, cursorY + 10);

    cursorY += 84;
    ctx.fillStyle = '#8b94a5';
    ctx.font = '24px sans-serif';
    if (snapshot.dateLabel) {
      ctx.fillText(snapshot.dateLabel, contentStartX, cursorY);
    }

    cursorY += 56;
    ctx.fillText(snapshot.statsLine, contentStartX, cursorY);

    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(96, snapshot.height - 250);
    ctx.lineTo(snapshot.width - 96, snapshot.height - 250);
    ctx.stroke();

    ctx.fillStyle = stylePreset.footerText;
    ctx.font = '24px sans-serif';
    ctx.fillText(
      '凡人共读 · 动态详情长图',
      contentStartX,
      snapshot.height - 170
    );
    ctx.fillText(
      '打开小程序查看完整评论与互动',
      contentStartX,
      snapshot.height - 130
    );

    if (miniProgramCodeImage && typeof ctx.drawImage === 'function') {
      const qrCardSize = 120;
      const qrPadding = 10;
      const qrCardX = snapshot.width - 96 - qrCardSize;
      const qrCardY = snapshot.height - 216;

      this.drawPosterRoundedRect(
        ctx,
        qrCardX,
        qrCardY,
        qrCardSize,
        qrCardSize,
        20,
        '#ffffff'
      );
      this.drawPosterOutline(
        ctx,
        qrCardX,
        qrCardY,
        qrCardSize,
        qrCardSize,
        20,
        '#e8edf5',
        2
      );
      ctx.drawImage(
        miniProgramCodeImage,
        qrCardX + qrPadding,
        qrCardY + qrPadding,
        qrCardSize - qrPadding * 2,
        qrCardSize - qrPadding * 2
      );
    }

    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        width: snapshot.width,
        height: snapshot.height,
        destWidth: snapshot.width * 2,
        destHeight: snapshot.height * 2,
        fileType: 'png',
        quality: 1,
        success: (res) => resolve(res.tempFilePath),
        fail: reject
      });
    });
  },

  syncSelectedPoster(index = 0) {
    const posterGalleryItems = Array.isArray(this.data.posterGalleryItems)
      ? this.data.posterGalleryItems
      : [];
    const safeIndex = Math.min(
      Math.max(Number(index) || 0, 0),
      Math.max(posterGalleryItems.length - 1, 0)
    );
    const selectedPoster = posterGalleryItems[safeIndex] || null;

    this.setData({
      posterSelectedIndex: safeIndex,
      selectedPoster,
      posterTempFilePath: selectedPoster?.tempFilePath || ''
    });
  },

  async generatePosterGallery(detailCheckin) {
    const items = [];

    for (let index = 0; index < POSTER_STYLE_PRESETS.length; index += 1) {
      const stylePreset = POSTER_STYLE_PRESETS[index];
      if (wx.showLoading) {
        wx.showLoading({
          title: `海报 ${index + 1}/${POSTER_STYLE_PRESETS.length}`,
          mask: true
        });
      }

      const tempFilePath = await this.generateLongImagePoster(
        detailCheckin,
        stylePreset
      );
      items.push({
        id: stylePreset.id,
        name: stylePreset.name,
        tempFilePath
      });
    }

    return items;
  },

  previewGeneratedPoster(tempFilePath) {
    if (!tempFilePath) {
      return;
    }

    if (wx.previewImage) {
      wx.previewImage({
        current: tempFilePath,
        urls: [tempFilePath]
      });
    }
  },

  savePosterToAlbum(tempFilePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath: tempFilePath,
        success: () => {
          wx.showToast({
            title: '已保存到相册',
            icon: 'success'
          });
          resolve();
        },
        fail: (error) => {
          if (
            String(error?.errMsg || '').includes('auth deny') &&
            wx.showModal
          ) {
            wx.showModal({
              title: '需要相册权限',
              content: '请在设置中允许保存到相册后重试',
              success: (modalRes) => {
                if (modalRes.confirm && wx.openSetting) {
                  wx.openSetting({});
                }
              }
            });
          } else {
            wx.showToast({
              title: '保存失败',
              icon: 'none'
            });
          }
          reject(error);
        }
      });
    });
  },

  openPosterGallery() {
    if (
      !Array.isArray(this.data.posterGalleryItems) ||
      this.data.posterGalleryItems.length === 0
    ) {
      return;
    }

    this.setData({
      posterGalleryVisible: true
    });
  },

  closePosterGallery() {
    this.setData({
      posterGalleryVisible: false
    });
  },

  noop() {},

  handlePosterTemplateSelect(e) {
    const { index } = e.currentTarget.dataset || {};
    this.syncSelectedPoster(index);
  },

  handlePreviewSelectedPoster() {
    this.previewGeneratedPoster(this.data.selectedPoster?.tempFilePath);
  },

  handleSaveSelectedPoster() {
    if (!this.data.selectedPoster?.tempFilePath) {
      return;
    }
    this.savePosterToAlbum(this.data.selectedPoster.tempFilePath);
  },

  /**
   * 处理课程数据，添加模块可见性标志
   */
  processCourseModules(course) {
    const modules = [
      'meditation',
      'question',
      'content',
      'reflection',
      'action',
      'learn',
      'extract',
      'say'
    ];

    modules.forEach((module) => {
      // 判断模块内容是否为空，添加 visible 标志
      const isEmpty = this.isContentEmpty(course[module]);
      course[`${module}Visible`] = !isEmpty;

      // 如果是富文本内容（content），清理 HTML
      if (module === 'content' && course[module]) {
        course[module] = this.cleanHtmlForRichText(course[module]);
        console.log(
          '✅ 已清理富文本 HTML:',
          course[module].substring(0, 100) + '...'
        );
      }
    });

    return course;
  },

  async loadFocusedCheckinDetail(course, periodId, access, prefetchedDetail = null) {
    const detail =
      prefetchedDetail ||
      (await checkinService.getCheckinDetail(this.data.shareCheckinId));
    const checkinItem = this.buildCheckinItem(detail || {});
    const app = getApp();
    const currentUserId =
      app.globalData.userInfo?._id || app.globalData.userInfo?.id;
    const calendar = this.generateCalendar(course);
    const checkedDays = calendar.filter((d) => d.status === 'checked').length;

    course.comments = [checkinItem];
    this.syncShareCheckinMeta(course.comments);

    const isOwnCheckinBool =
      !!currentUserId && String(checkinItem.userId) === String(currentUserId);

    // 动态详情模式不渲染课程富文本内容，只关闭显示开关并移除正文字段，避免富文本块渲染
    const courseForDetail = {
      ...course,
      contentVisible: false
    };
    delete courseForDetail.content;

    this.setData(
      {
        periodId: periodId || this.normalizeId(detail?.periodId),
        paymentStatus: access.paymentStatus || null,
        canAccessCommunity: !!access.canAccessCommunity,
        communityAccessState: access.communityAccessState || 'locked',
        hasUserCheckedIn: isOwnCheckinBool,
        canShareCurrentCheckin: isOwnCheckinBool,
        commentExpanded: { [checkinItem.id]: true },
        commentLoading: {},
        notificationReminder: '',
        course: courseForDetail,
        calendar,
        checkedDays,
        loading: false
      },
      async () => {
        this.syncDetailCheckinState(checkinItem.id);
        try {
          await this.expandCheckinCommentsByIndex(0);
        } catch (error) {
          console.warn('加载打卡详情评论失败:', error);
        }
        this.syncDetailCheckinState(checkinItem.id);
        this.loadNotificationReminder();
      }
    );
  },

  async loadCourseDetail() {
    this.setData({ loading: true });

    try {
      console.log('开始加载课程详情，ID:', this.data.courseId);

      const checkinDetailPromise =
        this.data.isCheckinDetailMode && this.data.shareCheckinId
          ? checkinService.getCheckinDetail(this.data.shareCheckinId)
          : Promise.resolve(null);

      // 优化：当 periodId 已知时，课程、权限、动态详情并行执行
      const knownPeriodId = this.data.periodId;
      let course, access, focusedCheckinDetail;
      if (knownPeriodId) {
        [course, access, focusedCheckinDetail] = await Promise.all([
          courseService.getCourseDetail(this.data.courseId),
          getPeriodAccess(knownPeriodId),
          checkinDetailPromise
        ]);
      } else {
        [course, focusedCheckinDetail] = await Promise.all([
          courseService.getCourseDetail(this.data.courseId),
          checkinDetailPromise
        ]);
        access = await getPeriodAccess(extractId(course.periodId));
      }

      const periodId = extractId(course.periodId) || knownPeriodId;

      // 行为追踪（fire-and-forget，不阻塞渲染）
      activityService.track('course_view', {
        targetType: 'section',
        targetId: this.data.courseId,
        periodId,
        sectionId: this.data.courseId,
        metadata: { title: course.title || course.name || '' }
      });
      const communityEnabled = access.communityAccessState === 'enabled';
      console.log('课程详情权限检查:', {
        courseId: this.data.courseId,
        periodId,
        paymentStatus: access.paymentStatus,
        paymentPending: access.paymentPending,
        communityAccessState: access.communityAccessState,
        canAccessCommunity: access.canAccessCommunity
      });

      // 确保 course.comments 是数组（后端可能不返回这个字段）
      if (!course.comments) {
        course.comments = [];
      }

      // 处理课程模块的可见性
      this.processCourseModules(course);

      console.log('course.comments:', course.comments);
      console.log('comments 是否存在:', !!course.comments);
      console.log(
        'comments 长度:',
        course.comments ? course.comments.length : 0
      );

      if (this.data.isCheckinDetailMode) {
        await this.loadFocusedCheckinDetail(
          course,
          periodId,
          access,
          focusedCheckinDetail
        );
        return;
      }

      if (!communityEnabled) {
        course.comments = [];
        const calendar = this.generateCalendar(course);
        const checkedDays = calendar.filter(
          (d) => d.status === 'checked'
        ).length;

        this.setData({
          periodId,
          paymentStatus: access.paymentStatus || null,
          canAccessCommunity: false,
          communityAccessState: access.communityAccessState || 'locked',
          hasUserCheckedIn: false,
          commentExpanded: {},
          commentLoading: {},
          notificationReminder: '',
          course,
          calendar,
          checkedDays,
          loading: false
        });
        return;
      }

      // 从数据库加载打卡记录
      let dbCheckins = [];
      let checkinHasMore = false;
      try {
        if (!periodId) {
          console.error('❌ periodId 为空，无法加载打卡记录!');
          throw new Error('periodId 为空');
        }

        const checkinRes = await courseService.getSectionCheckins(
          periodId,
          this.data.courseId,
          { limit: SECTION_CHECKIN_FETCH_LIMIT, page: 1 }
        );

        if (checkinRes) {
          dbCheckins = normalizeCheckinListResponse(checkinRes);
          const pagination = checkinRes.pagination;
          checkinHasMore = !!(pagination && pagination.hasNext);
          console.log(`📊 打卡记录首页: ${dbCheckins.length} 条，hasMore=${checkinHasMore}`);
        }
      } catch (error) {
        console.warn('从打卡API加载失败，尝试使用本地存储:', error);
      }

      // 如果数据库没有数据，则从本地存储加载
      if (dbCheckins.length === 0) {
        const storageKey = `checkins_${this.data.courseId}`;
        dbCheckins = wx.getStorageSync(storageKey) || [];
        console.log('本地打卡记录:', dbCheckins);
      }

      // 组织打卡记录的层级结构
      // 打卡(Checkin)为主层级，评论(Comment)为子层级
      let hasUserCheckedIn = false;
      const app = getApp();
      const currentUserId =
        app.globalData.userInfo?._id || app.globalData.userInfo?.id;

      // 为每个打卡记录构建完整的数据结构
      const checkinWithComments = dbCheckins.map((checkin) => {
        const checkinUserId =
          checkin.userId?._id || checkin.userId?.id || checkin.userId;
        if (currentUserId && String(checkinUserId) === String(currentUserId)) {
          hasUserCheckedIn = true;
        }
        return this.buildCheckinItem(checkin);
      });

      // 保存当前用户是否已打卡的状态
      this.setData({ hasUserCheckedIn });

      // 评论改为延迟加载：用户点击"查看评论"时才加载，避免串行 N 次 API 请求
      course.comments = checkinWithComments;
      this.syncShareCheckinMeta(checkinWithComments);

      const calendar = this.generateCalendar(course);
      const checkedDays = calendar.filter((d) => d.status === 'checked').length;

      this.setData(
        {
          periodId,
          paymentStatus: access.paymentStatus || null,
          canAccessCommunity: true,
          communityAccessState: access.communityAccessState || 'enabled',
          course,
          calendar,
          checkedDays,
          loading: false,
          checkinPage: 1,
          checkinHasMore,
          checkinLoadingMore: false
        },
        () => {
          this.loadNotificationReminder();
          this.restoreTargetFocus();
        }
      );

      console.log('页面数据设置完成');
      console.log('this.data.course.comments:', this.data.course.comments);
    } catch (error) {
      console.error('加载课程详情失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  async loadMoreCheckins() {
    if (this.data.checkinLoadingMore || !this.data.checkinHasMore) return;

    this.setData({ checkinLoadingMore: true });
    const nextPage = this.data.checkinPage + 1;

    try {
      const checkinRes = await courseService.getSectionCheckins(
        this.data.periodId,
        this.data.courseId,
        { limit: SECTION_CHECKIN_FETCH_LIMIT, page: nextPage }
      );

      const newRawCheckins = normalizeCheckinListResponse(checkinRes || {});
      const pagination = checkinRes?.pagination;
      const hasMore = !!(pagination?.hasNext);

      const app = getApp();
      const currentUserId = app.globalData.userInfo?._id || app.globalData.userInfo?.id;
      let hasUserCheckedIn = this.data.hasUserCheckedIn;

      const newItems = newRawCheckins.map((checkin) => {
        const checkinUserId = checkin.userId?._id || checkin.userId?.id || checkin.userId;
        if (!hasUserCheckedIn && currentUserId && String(checkinUserId) === String(currentUserId)) {
          hasUserCheckedIn = true;
        }
        return this.buildCheckinItem(checkin);
      });

      const currentComments = this.data.course?.comments || [];
      this.setData({
        'course.comments': [...currentComments, ...newItems],
        checkinPage: nextPage,
        checkinHasMore: hasMore,
        checkinLoadingMore: false,
        hasUserCheckedIn
      });
    } catch (error) {
      console.error('加载更多打卡记录失败:', error);
      this.setData({ checkinLoadingMore: false });
    }
  },

  syncShareCheckinMeta(checkins = []) {
    const { shareCheckinId } = this.data;
    if (!shareCheckinId) {
      return;
    }

    const targetCheckin = checkins.find(
      (item) => String(item.id || item._id) === String(shareCheckinId)
    );

    if (!targetCheckin) {
      return;
    }

    this.setData({
      shareCheckinUserName: targetCheckin.userName || ''
    });
  },

  generateCalendar(course) {
    const calendar = [];
    for (let day = 1; day <= constants.COURSE_DURATION; day++) {
      calendar.push({
        day,
        status: day <= (course.currentDay || 0) ? 'checked' : 'pending',
        statusText: day <= (course.currentDay || 0) ? '✓' : ''
      });
    }
    return calendar;
  },

  async loadNotificationReminder() {
    const app = getApp();
    if (
      !app.globalData.isLogin ||
      this.data.communityAccessState !== 'enabled'
    ) {
      return;
    }

    try {
      const response = await subscribeMessageService.getSettings();
      const scenes = response.scenes || [];
      const commentScene = scenes.find(
        (item) => item.scene === 'comment_received'
      );
      const likeScene = scenes.find((item) => item.scene === 'like_received');
      const needsReminder =
        (commentScene && commentScene.availableCount <= 0) ||
        (likeScene && likeScene.availableCount <= 0);

      this.setData({
        notificationReminder: needsReminder
          ? '评论或点赞提醒已用完，可去消息提醒页补充。'
          : ''
      });
    } catch (error) {
      console.warn('加载课程详情通知提醒失败:', error);
    }
  },

  navigateToNotificationSettings() {
    this.triggerAutoTopUp('course_detail_notification_settings');
    wx.navigateTo({
      url: `/pages/notification-settings/notification-settings?periodId=${this.data.periodId || ''}`
    });
  },

  triggerAutoTopUp(sourceAction) {
    return subscribeAutoTopUp.maybeAutoTopUpSubscriptions({
      sourceAction,
      periodId: this.data.periodId || extractId(this.data.course?.periodId),
      sectionId: this.data.courseId,
      courseId: this.data.courseId,
      sourcePage: 'course-detail',
      sceneKeys: COMMUNITY_AUTO_TOP_UP_SCENES,
      requestMode: 'any'
    });
  },

  handleDayClick(e) {
    const { day } = e.currentTarget.dataset;
    console.log('点击第', day.day, '天');
  },

  handleEnroll() {
    wx.showModal({
      title: '确认报名',
      content: '确定要报名该课程吗？',
      success: (res) => {
        if (res.confirm) {
          // TODO: 调用报名API
          wx.showToast({
            title: '报名成功',
            icon: 'success'
          });
        }
      }
    });
  },

  handleBack() {
    wx.navigateBack();
  },

  handleCheckinDetailTap(e) {
    const { checkinId, sectionId } = e.currentTarget.dataset;
    this.openCheckinDetail(checkinId, sectionId || this.data.courseId);
  },

  openCheckinDetail(checkinId, sectionId = '') {
    const targetSectionId = sectionId || this.data.courseId;

    if (!checkinId || !targetSectionId) {
      wx.showToast({
        title: '缺少详情参数',
        icon: 'none'
      });
      return;
    }

    if (
      this.data.isCheckinDetailMode &&
      String(this.data.shareCheckinId) === String(checkinId) &&
      String(this.data.courseId) === String(targetSectionId)
    ) {
      return;
    }

    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${targetSectionId}&checkinId=${checkinId}`
    });
  },

  async handleCheckin() {
    if (this.data.communityAccessState !== 'enabled') {
      return;
    }

    await this.triggerAutoTopUp('course_detail_checkin');

    // 跳转到打卡页面
    wx.navigateTo({
      url: `/pages/checkin/checkin?courseId=${this.data.courseId}&periodId=${this.data.periodId}`
    });
  },

  /**
   * 切换评论展开/收起（延迟加载）
   */
  async toggleComments(e) {
    if (this.data.communityAccessState !== 'enabled') {
      return;
    }

    this.triggerAutoTopUp('course_detail_expand_comments');

    const { index } = e.currentTarget.dataset;
    const comments = this.data.course.comments;
    const checkin = comments[index];
    if (!checkin) return;

    const expandedKey = `commentExpanded.${checkin.id}`;

    // 已展开 → 收起
    if (this.data.commentExpanded[checkin.id]) {
      this.setData({ [expandedKey]: false });
      return;
    }

    try {
      await this.expandCheckinCommentsByIndex(index);
    } catch (error) {
      console.error('加载评论失败:', error);
      this.setData({ [expandedKey]: false });
      wx.showToast({ title: '加载评论失败', icon: 'none' });
    }
  },

  async expandCheckinCommentsByIndex(index) {
    const comments = this.data.course.comments;
    const checkin = comments[index];
    if (!checkin) return;

    if (checkin.replies && checkin.replies.length > 0) {
      this.setData({ [`commentExpanded.${checkin.id}`]: true });
      return;
    }

    const loadingKey = `commentLoading.${checkin.id}`;
    this.setData({
      [loadingKey]: true,
      [`commentExpanded.${checkin.id}`]: true
    });

    try {
      const checkinComments = await commentService.getCommentsByCheckin(
        checkin.id,
        { limit: 100 }
      );

      if (
        checkinComments &&
        checkinComments.list &&
        checkinComments.list.length > 0
      ) {
        const app = getApp();
        const currentUserId =
          app.globalData.userInfo?._id || app.globalData.userInfo?.id;

        const formattedReplies = checkinComments.list.map((comment) => {
          const formattedNestedReplies = (comment.replies || []).map(
            (reply) => {
              const isLiked =
                Array.isArray(reply.likes) && currentUserId
                  ? reply.likes.some(
                      (l) =>
                        String(
                          l.userId?._id || l.userId?.id || l.userId || l
                        ) === String(currentUserId)
                    )
                  : false;
              return {
                id: reply._id,
                userId: reply.userId?._id || reply.userId,
                userName: reply.userId?.nickname || '匿名用户',
                avatarText: reply.userId?.nickname
                  ? reply.userId.nickname.charAt(0)
                  : '👤',
                avatarUrl: reply.userId?.avatarUrl || '',
                avatarColor: getAvatarColorByUserId(
                  reply.userId?._id ||
                    reply.userId ||
                    reply.userId?.nickname ||
                    '匿名用户'
                ),
                content: reply.content || '',
                createTime: reply.createdAt
                  ? this.formatTime(reply.createdAt)
                  : '刚刚',
                likeCount: reply.likeCount || 0,
                isLiked,
                parentId: comment._id
              };
            }
          );

          const isCommentLiked =
            Array.isArray(comment.likes) && currentUserId
              ? comment.likes.some(
                  (l) =>
                    String(l.userId?._id || l.userId?.id || l.userId || l) ===
                    String(currentUserId)
                )
              : false;

          return {
            id: comment._id,
            userId: comment.userId?._id || comment.userId,
            userName: comment.userId?.nickname || '匿名用户',
            avatarText: comment.userId?.nickname
              ? comment.userId.nickname.charAt(0)
              : '👤',
            avatarUrl: comment.userId?.avatarUrl || '',
            avatarColor: getAvatarColorByUserId(
              comment.userId?._id ||
                comment.userId ||
                comment.userId?.nickname ||
                '匿名用户'
            ),
            content: comment.content || '',
            createTime: comment.createdAt
              ? this.formatTime(comment.createdAt)
              : '刚刚',
            likeCount: comment.likeCount || 0,
            isLiked: isCommentLiked,
            replies: formattedNestedReplies
          };
        });

        this.setData({
          [`course.comments[${index}].replies`]: formattedReplies,
          [loadingKey]: false
        });
        this.syncDetailCheckinState(checkin.id);
        return;
      }

      this.setData({ [loadingKey]: false });
      this.syncDetailCheckinState(checkin.id);
    } catch (error) {
      this.setData({
        [loadingKey]: false,
        [`commentExpanded.${checkin.id}`]: false
      });
      throw error;
    }
  },

  async restoreTargetFocus() {
    if (this.data.communityAccessState !== 'enabled') {
      return;
    }

    const { focusCheckinId, focusCommentId, focusReplyId } = this.data;
    if (!focusCheckinId) {
      return;
    }

    const checkins = this.data.course.comments || [];
    const targetIndex = checkins.findIndex(
      (item) => String(item.id || item._id) === String(focusCheckinId)
    );

    if (targetIndex === -1) {
      return;
    }

    try {
      await this.expandCheckinCommentsByIndex(targetIndex);
    } catch (error) {
      console.warn('恢复评论定位失败:', error);
    }

    this.setData({
      highlightCheckinId: focusCheckinId,
      highlightCommentId: focusCommentId,
      highlightReplyId: focusReplyId
    });

    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
    }

    this.highlightTimer = setTimeout(() => {
      this.setData({
        highlightCheckinId: '',
        highlightCommentId: '',
        highlightReplyId: ''
      });
    }, 2800);

    const selector = focusReplyId
      ? `#reply-${focusReplyId}`
      : focusCommentId
        ? `#comment-${focusCommentId}`
        : `#checkin-${focusCheckinId}`;

    this.scrollToSelector(selector, `#checkin-${focusCheckinId}`);
    this.setData({
      focusCheckinId: '',
      focusCommentId: '',
      focusReplyId: ''
    });
  },

  scrollToSelector(selector, fallbackSelector = '') {
    wx.nextTick(() => {
      wx.pageScrollTo({
        selector,
        duration: 280,
        offsetTop: 96,
        fail: () => {
          if (fallbackSelector && fallbackSelector !== selector) {
            wx.pageScrollTo({
              selector: fallbackSelector,
              duration: 280,
              offsetTop: 96
            });
          }
        }
      });
    });
  },

  /**
   * 点赞打卡记录（顶层列表项是打卡记录，不是评论）
   */
  async handleLikeComment(e) {
    if (this.data.communityAccessState !== 'enabled') {
      return;
    }

    this.triggerAutoTopUp('course_detail_like_checkin');

    const { id } = e.currentTarget.dataset;
    const comments = this.data.course.comments;
    const comment = comments.find((c) => c.id === id);

    if (!comment) {
      return;
    }

    try {
      if (comment.isLiked) {
        // 取消点赞打卡记录
        console.log(`👎 取消点赞打卡: checkinId=${id}`);
        await commentService.unlikeCheckin(id);
        comment.likeCount = Math.max(0, comment.likeCount - 1);
        comment.isLiked = false;
        console.log(`✅ 取消点赞成功: 当前点赞数=${comment.likeCount}`);
      } else {
        // 点赞打卡记录
        console.log(`👍 点赞打卡: checkinId=${id}`);
        await commentService.likeCheckin(id);
        activityService.track('like_create', {
          targetType: 'checkin',
          targetId: id,
          periodId: this.data.periodId || extractId(this.data.course?.periodId),
          sectionId: this.data.courseId
        });
        comment.likeCount += 1;
        comment.isLiked = true;
        console.log(`✅ 点赞成功: 当前点赞数=${comment.likeCount}`);
      }

      this.setData({
        'course.comments': comments
      });
      this.syncDetailCheckinState(id);
    } catch (error) {
      console.error('点赞操作失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 回复评论
   */
  async handleReplyComment(e) {
    if (this.data.communityAccessState !== 'enabled') {
      return;
    }

    this.triggerAutoTopUp('course_detail_reply_checkin');

    const { id } = e.currentTarget.dataset;
    const comments = this.data.course.comments;
    const comment = comments.find((c) => c.id === id);

    if (!comment) {
      return;
    }

    // 使用 wx.showModal 获取回复内容
    wx.showModal({
      title: `回复 ${comment.userName}`,
      editable: true,
      placeholderText: '请输入回复内容...',
      success: async (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          try {
            // 直接创建评论（关联到打卡记录）
            const app = getApp();
            const currentUser = app.globalData.userInfo;

            console.log('📝 创建评论，打卡ID:', id);

            const replyData = await commentService.createComment({
              checkinId: id,
              content: res.content.trim()
            });
            activityService.track('comment_create', {
              targetType: 'checkin',
              targetId: id,
              periodId:
                this.data.periodId || extractId(this.data.course?.periodId),
              sectionId: this.data.courseId
            });

            console.log('✅ 评论已保存到数据库:', replyData);

            // 创建新的回复对象
            const newReply = {
              id: replyData._id || replyData.id || Date.now(),
              userId: currentUser?._id || currentUser?.id,
              userName: currentUser?.nickname || '我',
              avatarText: currentUser?.avatarUrl
                ? ''
                : currentUser?.nickname
                  ? currentUser.nickname.charAt(0)
                  : '我',
              avatarUrl: currentUser?.avatarUrl || '',
              avatarColor: getAvatarColorByUserId(
                currentUser?._id ||
                  currentUser?.id ||
                  currentUser?.nickname ||
                  '我'
              ),
              content: res.content.trim(),
              createTime: '刚刚',
              likeCount: 0,
              isLiked: false
            };

            // 添加到回复列表
            if (!comment.replies) {
              comment.replies = [];
            }
            comment.replies.push(newReply);

            // 更新数据
            this.setData({
              'course.comments': comments
            });
            this.syncDetailCheckinState(id);

            wx.showToast({
              title: '回复成功',
              icon: 'success'
            });
          } catch (error) {
            console.error('回复失败:', error);
            wx.showToast({
              title: '回复失败，请重试',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 点赞评论（回复列表里的项是评论，commentId 是打卡ID，replyId 是评论ID）
   */
  async handleLikeReply(e) {
    if (this.data.communityAccessState !== 'enabled') {
      return;
    }

    this.triggerAutoTopUp('course_detail_like_reply');

    const { commentId, replyId } = e.currentTarget.dataset;
    const comments = this.data.course.comments;
    const comment = comments.find(
      (c) => c.id === commentId || c._id === commentId
    );

    if (!comment || !comment.replies) {
      console.error('评论或回复不存在', { commentId, replyId });
      return;
    }

    let isNestedReply = false;
    let parentCommentId = null;

    let reply = comment.replies.find(
      (r) => r.id === replyId || r._id === replyId
    );

    // 如果在第一层回复(replies)里找不到，就去第二层(replies.replies)里找
    if (!reply) {
      for (const r of comment.replies) {
        if (r.replies && r.replies.length > 0) {
          const nestedReply = r.replies.find(
            (nr) => nr.id === replyId || nr._id === replyId
          );
          if (nestedReply) {
            reply = nestedReply;
            isNestedReply = true;
            parentCommentId = nestedReply.parentId || r.id || r._id;
            break;
          }
        }
      }
    }

    if (!reply) {
      console.error('回复不存在');
      return;
    }

    try {
      if (reply.isLiked) {
        // 取消点赞评论
        console.log(
          `👎 取消点赞回复: checkinId=${commentId}, isNested=${isNestedReply}, parentCommentId=${parentCommentId}, replyId=${replyId}`
        );
        if (isNestedReply) {
          await commentService.unlikeReply(parentCommentId, replyId);
        } else {
          await commentService.unlikeComment(replyId);
        }
        reply.likeCount = Math.max(0, reply.likeCount - 1);
        reply.isLiked = false;
        console.log(`✅ 取消点赞成功: 当前点赞数=${reply.likeCount}`);
      } else {
        // 点赞评论
        console.log(
          `👍 点赞回复: checkinId=${commentId}, isNested=${isNestedReply}, parentCommentId=${parentCommentId}, replyId=${replyId}`
        );
        if (isNestedReply) {
          await commentService.likeReply(parentCommentId, replyId);
        } else {
          await commentService.likeComment(replyId);
        }
        activityService.track('like_create', {
          targetType: isNestedReply ? 'reply' : 'comment',
          targetId: replyId,
          periodId: this.data.periodId || extractId(this.data.course?.periodId),
          sectionId: this.data.courseId
        });
        reply.likeCount = (reply.likeCount || 0) + 1;
        reply.isLiked = true;
        console.log(`✅ 点赞成功: 当前点赞数=${reply.likeCount}`);
      }

      this.setData({
        'course.comments': comments
      });
      this.syncDetailCheckinState(commentId);
    } catch (error) {
      console.error('回复点赞操作失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 回复某条回复
   * 参数：
   *   - checkinId: 打卡记录ID（打卡列表的ID）
   *   - commentId: 评论ID（打卡的评论）
   *   - replyId: 被回复的用户ID（评论的回复者）
   *   - userName: 被回复的用户名
   */
  async handleReplyToReply(e) {
    if (this.data.communityAccessState !== 'enabled') {
      return;
    }

    this.triggerAutoTopUp('course_detail_reply_reply');

    const { checkinId, commentId, replyId, userName } = e.currentTarget.dataset;

    console.log('📝 准备回复:', { checkinId, commentId, replyId, userName });

    // 验证必要参数
    if (!checkinId || !commentId || !replyId) {
      console.error('❌ 参数不完整', { checkinId, commentId, replyId });
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      return;
    }

    // 在 course.comments（打卡列表）中找到这个打卡
    const checkins = this.data.course.comments;
    const checkin = checkins.find((c) => c.id === checkinId);

    if (!checkin || !checkin.replies) {
      console.error('❌ 找不到打卡或评论列表', { checkinId, checkin });
      return;
    }

    // 在打卡的 replies（评论列表）中找到这条评论
    const comment = checkin.replies.find((c) => c.id === commentId);

    if (!comment) {
      console.error('❌ 找不到评论', { commentId });
      return;
    }

    // 使用 wx.showModal 获取回复内容
    wx.showModal({
      title: `回复 ${userName}`,
      editable: true,
      placeholderText: '请输入回复内容...',
      success: async (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          try {
            const app = getApp();
            const currentUser = app.globalData.userInfo;

            console.log(
              '📝 提交回复: commentId=' +
                commentId +
                ', content=' +
                res.content.trim().substring(0, 20)
            );

            // 调用API保存回复到这条评论
            // 后端返回的是整个更新后的 Comment 对象（包含更新的 replies 数组）
            const updatedComment = await commentService.replyComment(
              commentId,
              {
                content: res.content.trim(),
                replyToUserId: replyId // 标记回复的是哪个用户
              }
            );

            console.log('✅ 回复已保存到数据库，更新后的评论:', updatedComment);
            console.log('回复列表长度:', updatedComment.replies?.length);

            // 重新加载该打卡的评论列表，确保前端数据与后端同步
            // （因为后端返回的 replies 数据结构需要格式化才能显示）
            try {
              const refreshedComments =
                await commentService.getCommentsByCheckin(checkinId, {
                  limit: 100
                });

              if (refreshedComments && refreshedComments.list) {
                // 找到这条评论
                const updatedCommentData = refreshedComments.list.find(
                  (c) => c._id === commentId
                );

                if (updatedCommentData && checkin.replies) {
                  // 更新前端的这条评论数据
                  const commentIdx = checkin.replies.findIndex(
                    (c) => c.id === commentId
                  );
                  if (
                    commentIdx !== -1 &&
                    updatedCommentData &&
                    updatedCommentData.replies
                  ) {
                    const formattedReplies = updatedCommentData.replies.map(
                      (reply) => {
                        const isNestedReplyLikedLocally =
                          Array.isArray(reply.likes) && currentUser
                            ? reply.likes.some(
                                (l) =>
                                  String(
                                    l.userId?._id ||
                                      l.userId?.id ||
                                      l.userId ||
                                      l
                                  ) ===
                                  String(currentUser?._id || currentUser?.id)
                              )
                            : false;

                        return {
                          id: reply._id,
                          userId: reply.userId?._id || reply.userId,
                          userName: reply.userId?.nickname || '匿名用户',
                          avatarText: reply.userId?.nickname
                            ? reply.userId.nickname.charAt(0)
                            : '👤',
                          avatarColor: getAvatarColorByUserId(
                            reply.userId?._id ||
                              reply.userId ||
                              reply.userId?.nickname ||
                              '匿名用户'
                          ),
                          content: reply.content || '',
                          createTime: reply.createdAt
                            ? this.formatTime(reply.createdAt)
                            : '刚刚',
                          likeCount: reply.likeCount || 0,
                          isLiked: isNestedReplyLikedLocally
                        };
                      }
                    );

                    checkin.replies[commentIdx].replies = formattedReplies.map(
                      (reply) => ({ ...reply, parentId: commentId })
                    );
                    checkin.replies[commentIdx].replyCount =
                      updatedCommentData.replyCount || 0;

                    // 🔍 调试日志：验证嵌套回复数据结构
                    console.log('✅ 更新后的评论结构:');
                    console.log('   - 评论ID:', checkin.replies[commentIdx].id);
                    console.log(
                      '   - 评论内容:',
                      checkin.replies[commentIdx].content
                    );
                    console.log(
                      '   - 回复总数:',
                      checkin.replies[commentIdx].replyCount
                    );
                    console.log(
                      '   - 回复列表:',
                      checkin.replies[commentIdx].replies
                    );
                    if (
                      checkin.replies[commentIdx].replies &&
                      checkin.replies[commentIdx].replies.length > 0
                    ) {
                      console.log(
                        '   - 最后一条回复:',
                        checkin.replies[commentIdx].replies[
                          checkin.replies[commentIdx].replies.length - 1
                        ]
                      );
                    }
                  }
                }
              }
            } catch (err) {
              console.warn('刷新评论数据失败:', err);
              // 即使刷新失败也继续，不影响用户体验
            }

            // 更新页面数据
            this.setData({
              'course.comments': checkins
            });
            this.syncDetailCheckinState(checkinId);

            wx.showToast({
              title: '回复成功',
              icon: 'success'
            });
          } catch (error) {
            console.error('❌ 回复失败:', error);
            wx.showToast({
              title: '回复失败，请重试',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 格式化时间
   */
  formatTime(dateStr) {
    if (!dateStr) return '刚刚';

    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = Math.floor((now - date) / 1000); // 秒数

      if (diff < 60) return '刚刚';
      if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
      if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
      if (diff < 604800) return Math.floor(diff / 86400) + '天前';

      // 其他情况显示日期
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    } catch (error) {
      return '刚刚';
    }
  },

  /**
   * 点击打卡人头像 - 跳转到他人主页
   */
  handleAvatarClick(e) {
    const { userId } = e.currentTarget.dataset;
    const { course } = this.data;

    console.log('🎯 handleAvatarClick - 开始构造导航URL');
    console.log('   userId:', userId);
    console.log('   course:', course);
    console.log('   course.periodId:', course?.periodId);

    if (!userId) {
      console.error('❌ 用户ID不存在');
      return;
    }

    // 跳转到他人主页，同时传递当前课程所属的期次ID
    let url = `/pages/profile-others/profile-others?userId=${userId}`;
    if (course && course.periodId) {
      // 处理periodId可能是对象的情况（API返回的是populate的对象）
      const periodId = course.periodId._id || course.periodId;
      url += `&periodId=${periodId}`;
      console.log('✅ 成功添加periodId:', periodId);
    } else {
      console.warn('⚠️ course.periodId未找到或为空');
    }

    console.log('🔗 最终导航URL:', url);
    wx.navigateTo({ url });
  },

  handleLongImageShare() {
    const {
      detailCheckin,
      posterGenerating,
      posterGalleryItems,
      posterSourceCheckinId
    } = this.data;

    if (!detailCheckin) {
      wx.showToast({
        title: '暂无可生成的内容',
        icon: 'none'
      });
      return;
    }

    if (this.data.isCheckinDetailMode && !this.data.canShareCurrentCheckin) {
      wx.showToast({
        title: '仅自己的小凡看见可分享',
        icon: 'none'
      });
      return;
    }

    if (posterGenerating) {
      return;
    }

    if (
      Array.isArray(posterGalleryItems) &&
      posterGalleryItems.length > 0 &&
      posterSourceCheckinId === detailCheckin.id
    ) {
      this.openPosterGallery();
      return;
    }

    this.setData({ posterGenerating: true });
    if (wx.showLoading) {
      wx.showLoading({
        title: '生成长图中...',
        mask: true
      });
    }

    this.generatePosterGallery(detailCheckin)
      .then((galleryItems) => {
        this.setData({
          posterGenerating: false,
          posterTempFilePath: galleryItems[0]?.tempFilePath || '',
          posterSourceCheckinId: detailCheckin.id,
          posterGalleryItems: galleryItems,
          posterGalleryVisible: true
        });
        this.syncSelectedPoster(0);
        wx.hideLoading?.();
      })
      .catch((error) => {
        console.error('生成长图失败:', error);
        this.setData({ posterGenerating: false });
        wx.hideLoading?.();
        wx.showToast({
          title: '长图生成失败',
          icon: 'none'
        });
      });
  }
});
