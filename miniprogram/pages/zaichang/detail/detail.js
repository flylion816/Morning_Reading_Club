const imprintService = require('../../../services/imprint.service');
const { maybeAutoTopUpSubscriptions } = require('../../../utils/subscribe-auto-topup');
const { requireLogin } = require('../../../utils/require-login');
const activityService = require('../../../services/activity.service');
const { normalizeDanmakuContent } = require('../../../utils/danmaku');

const REACTION_LABELS = { gonming: '🌱 共鸣', ran: '🔥 燃', xiangqu: '🤗 想去' };

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${min}`;
}

function formatComment(comment) {
  return {
    ...comment,
    content: normalizeDanmakuContent(comment.content || ''),
    _createdAtFormatted: formatDateTime(comment.createdAt)
  };
}

Page({
  data: {
    imprint: null,
    comments: [],
    myReaction: null,
    iAmAttending: false,
    isAuthor: false,
    commentInput: '',
    replyTo: null,
    loading: true,
    commentPage: 1,
    commentPageSize: 20,
    commentHasMore: true,
    submittingComment: false,
    reactionLabels: REACTION_LABELS,
    currentUserId: null,
    showAllAttendees: false
  },

  onLoad(options) {
    if (!options.id || options.id === 'undefined') {
      wx.redirectTo({ url: '/pages/index/index' });
      return;
    }
    const app = getApp();
    const userId = app.globalData.userInfo && app.globalData.userInfo._id;
    this.setData({ currentUserId: userId });
    this._id = options.id;
    activityService.track('zaichang_detail_view', { targetId: options.id });
    this.loadDetail();
    this.loadComments(true);
  },

  onShow() {
    const needRefresh = wx.getStorageSync('zaichang_need_refresh');
    if (needRefresh && this._id) {
      wx.removeStorageSync('zaichang_need_refresh');
      this.loadDetail();
      this._listNeedsRefresh = true;
    }
  },

  async loadDetail() {
    try {
      const res = await imprintService.detail(this._id);
      const imprint = res.imprint || res;
      const myReaction = res.myReaction || null;
      const iAmAttending = !!(imprint.attendees || []).find(
        a => a.userId && a.userId.toString() === this.data.currentUserId
      );
      const isAuthor = !!(imprint.authorId && imprint.authorId.toString() === this.data.currentUserId);
      this.setData({
        imprint: { ...imprint, _happenedAtFormatted: formatDate(imprint.happenedAt) },
        myReaction,
        iAmAttending,
        isAuthor,
        loading: false
      });
      this._prefetchShareImage(imprint);
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  _prefetchShareImage(imprint) {
    const firstMedia = (imprint.mediaList || [])[0];
    if (!firstMedia || firstMedia.type === 'video') return;
    wx.downloadFile({
      url: firstMedia.url,
      success: (res) => {
        if (res.statusCode === 200) this._shareImagePath = res.tempFilePath;
      }
    });
  },

  async loadComments(reset) {
    const page = reset ? 1 : this.data.commentPage;
    try {
      const res = await imprintService.listComments(this._id, { page, pageSize: this.data.commentPageSize });
      const newComments = (res.list || res || []).map(formatComment);
      const comments = reset ? newComments : [...this.data.comments, ...newComments];
      this.setData({
        comments,
        commentPage: page + 1,
        commentHasMore: newComments.length >= this.data.commentPageSize
      });
    } catch (e) {}
  },

  onReachBottom() {
    if (this.data.commentHasMore) this.loadComments(false);
  },

  onTapReaction(e) {
    if (!requireLogin('登录后才能表达共鸣')) return;
    const type = e.currentTarget.dataset.type;
    const prev = this.data.myReaction;
    const imprint = this.data.imprint;
    if (!imprint) return;

    const counts = { ...imprint.reactionCounts };
    if (prev === type) {
      counts[type] = Math.max(0, (counts[type] || 0) - 1);
      this.setData({ myReaction: null, 'imprint.reactionCounts': counts });
      imprintService.cancelReaction(this._id).catch(() => {
        counts[type] = (counts[type] || 0) + 1;
        this.setData({ myReaction: prev, 'imprint.reactionCounts': counts });
      });
    } else {
      if (prev) counts[prev] = Math.max(0, (counts[prev] || 0) - 1);
      counts[type] = (counts[type] || 0) + 1;
      this.setData({ myReaction: type, 'imprint.reactionCounts': counts });
      maybeAutoTopUpSubscriptions({ sceneKeys: ['like_received'], requestMode: 'prompt' }).catch(() => {});
      imprintService.react(this._id, type).then(() => {
        activityService.track('zaichang_imprint_like', { targetId: this._id });
        this._listNeedsRefresh = true;
      }).catch(() => {
        if (prev) counts[prev] = (counts[prev] || 0) + 1;
        counts[type] = Math.max(0, (counts[type] || 0) - 1);
        this.setData({ myReaction: prev, 'imprint.reactionCounts': counts });
      });
    }
  },

  async onTapAttend() {
    if (!requireLogin('登录后才能参加活动')) return;
    const attending = this.data.iAmAttending;
    try {
      if (attending) {
        await imprintService.cancelAttend(this._id);
        const attendees = (this.data.imprint.attendees || []).filter(
          a => !a.userId || a.userId.toString() !== this.data.currentUserId
        );
        this.setData({ iAmAttending: false, 'imprint.attendees': attendees });
      } else {
        await imprintService.attend(this._id);
        const app = getApp();
        const user = app.globalData.userInfo || {};
        const attendees = [...(this.data.imprint.attendees || []), {
          userId: this.data.currentUserId,
          name: user.nickname || '我',
          isRegistered: true,
          addedBy: 'self',
          avatarUrl: user.avatarUrl || ''
        }];
        this.setData({ iAmAttending: true, 'imprint.attendees': attendees });
      }
    } catch (e) {
      wx.showToast({ title: e.message || '操作失败', icon: 'none' });
    }
  },

  onTapReply(e) {
    const { commentId, authorName } = e.currentTarget.dataset;
    this.setData({ replyTo: { commentId, authorName } });
    this.selectComponent('#comment-input') && this.selectComponent('#comment-input').focus();
  },

  onClearReply() {
    this.setData({ replyTo: null });
  },

  onCommentInput(e) {
    this.setData({ commentInput: normalizeDanmakuContent(e.detail.value || '') });
  },

  async onSubmitComment() {
    if (!requireLogin('登录后才能发评论')) return;
    const content = normalizeDanmakuContent(this.data.commentInput || '').trim();
    if (!content) return;
    if (this.data.submittingComment) return;
    this.setData({ submittingComment: true });
    maybeAutoTopUpSubscriptions({ sceneKeys: ['comment_received'], requestMode: 'prompt' }).catch(() => {});
    try {
      const data = { content };
      if (this.data.replyTo) {
        data.parentId = this.data.replyTo.commentId;
      }
      const newComment = await imprintService.createComment(this._id, data);
      const app = getApp();
      const user = app.globalData.userInfo || {};
      const comment = formatComment(newComment.comment || newComment);
      comment.author = comment.author || { nickname: user.nickname, avatarUrl: user.avatarUrl, _id: this.data.currentUserId };
      comment._createdAtFormatted = formatDateTime(comment.createdAt || new Date().toISOString());
      this.setData({
        comments: [...this.data.comments, comment],
        commentInput: '',
        replyTo: null,
        'imprint.commentCount': (this.data.imprint.commentCount || 0) + 1
      });
      activityService.track('zaichang_imprint_comment', { targetId: this._id });
    } catch (e) {
      wx.showToast({ title: '发送失败', icon: 'none' });
    }
    this.setData({ submittingComment: false });
  },

  onDeleteComment(e) {
    const { commentId } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除评论',
      content: '确定删除这条评论吗？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await imprintService.deleteComment(this._id, commentId);
          const comments = this.data.comments.filter(c => c._id !== commentId);
          this.setData({
            comments,
            'imprint.commentCount': Math.max(0, (this.data.imprint.commentCount || 1) - 1)
          });
        } catch (e) {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  },

  onTapImage(e) {
    const index = e.currentTarget.dataset.index;
    const urls = (this.data.imprint.mediaList || []).map(m => m.url);
    wx.previewImage({ current: urls[index], urls });
  },

  onToggleAttendees() {
    this.setData({ showAllAttendees: !this.data.showAllAttendees });
  },

  onUnload() {
    if (this._listNeedsRefresh) {
      wx.setStorageSync('zaichang_need_refresh', true);
    }
  },

  onTapEdit() {
    wx.navigateTo({ url: `/pages/zaichang/publish/publish?id=${this._id}` });
  },

  onTapDelete() {
    wx.showModal({
      title: '删除印记',
      content: '确定删除这条印记吗？删除后无法恢复。',
      confirmColor: '#e74c3c',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await imprintService.remove(this._id);
          wx.setStorageSync('zaichang_need_refresh', true);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 1200);
        } catch (e) {
          wx.showToast({ title: e.message || '删除失败', icon: 'none' });
        }
      }
    });
  },

  onShareAppMessage() {
    const imprint = this.data.imprint;
    if (!imprint) return { title: '在场 · 书友聚会印记', path: '/pages/zaichang/list/list' };
    const imageUrl = this._shareImagePath || '';
    return {
      title: imprint.title || '在场 · 书友聚会印记',
      path: `/pages/zaichang/detail/detail?id=${this._id}`,
      imageUrl
    };
  },

  onShareTimeline() {
    const imprint = this.data.imprint;
    const imageUrl = this._shareImagePath || '';
    return {
      title: imprint ? imprint.title : '在场 · 书友聚会印记',
      query: `id=${this._id}`,
      imageUrl
    };
  }
});
