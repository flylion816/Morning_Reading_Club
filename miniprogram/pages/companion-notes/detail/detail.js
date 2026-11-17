const service = require('../../../services/companion-note.service');
const appDialog = require('../../../utils/dialog');
const { getUserAvatarDisplay } = require('../../../utils/avatar');

const PROMPT_PREFIX = 'companion-note-read-prompt:';
const COMMENT_MAX = 500;
const DOWNLOAD_RETRY_LIMIT = 1;

function decode(value = '') {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return String(value || '');
  }
}

function payloadOf(result) {
  if (!result || typeof result !== 'object') return {};
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) return result.data;
  return result;
}

function currentUser() {
  try {
    const app = typeof getApp === 'function' ? getApp() : null;
    return (app && app.globalData && app.globalData.userInfo) || {};
  } catch (error) {
    return {};
  }
}

function userIdOf(user) {
  if (!user) return '';
  if (typeof user === 'object') return String(user._id || user.id || user.userId || '');
  return String(user);
}

function decorateAuthor(user, fallbackName = '书友') {
  const source = user && typeof user === 'object' ? user : { _id: user, nickname: fallbackName };
  const name = source.nickname || source.name || source.userName || fallbackName;
  const display = getUserAvatarDisplay(source, { userId: userIdOf(source), displayName: name });
  return { ...source, name, ...display };
}

function normalizeReply(reply = {}, note = {}) {
  const author = reply.user || reply.userId || reply.author || {};
  const id = String(reply._id || reply.id || reply.replyId || '');
  const isLiked = reply.isLiked === true;
  return {
    ...reply,
    id,
    _id: id,
    content: reply.content || '',
    author: decorateAuthor(author, reply.userName || '书友'),
    userId: userIdOf(author) || String(reply.userId || ''),
    likeCount: Number(reply.likeCount) || 0,
    isLiked,
    isCompanion: reply.isCompanion === true || (note.companionUserId && userIdOf(author) === note.companionUserId),
    createdAt: reply.createdAt || ''
  };
}

function normalizeComment(comment = {}, note = {}) {
  const author = comment.user || comment.userId || comment.author || {};
  const id = String(comment._id || comment.id || comment.commentId || '');
  const replies = Array.isArray(comment.replies) ? comment.replies.map(reply => normalizeReply(reply, note)) : [];
  return {
    ...comment,
    id,
    _id: id,
    content: comment.content || '',
    author: decorateAuthor(author, comment.userName || '书友'),
    userId: userIdOf(author) || String(comment.userId || ''),
    likeCount: Number(comment.likeCount) || 0,
    isLiked: comment.isLiked === true,
    isPinned: comment.isPinned === true,
    isHidden: comment.hidden === true,
    isCompanion: comment.isCompanion === true || (note.companionUserId && userIdOf(author) === note.companionUserId),
    createdAt: comment.createdAt || '',
    replies,
    replyCount: Number(comment.replyCount) || replies.length
  };
}

function commentsFrom(result) {
  const payload = payloadOf(result);
  if (Array.isArray(payload)) return payload;
  return payload.list || payload.items || payload.comments || [];
}

function errorCode(error) {
  return Number(error?.statusCode || error?.code || error?.data?.code || error?.data?.statusCode || 0) || 0;
}

function readPromptKey(noteId) {
  try {
    return wx.getStorageSync(`${PROMPT_PREFIX}${noteId}`) === true;
  } catch (error) {
    return false;
  }
}

function writePromptKey(noteId) {
  try {
    wx.setStorageSync(`${PROMPT_PREFIX}${noteId}`, true);
  } catch (error) {
    // private mode or disabled storage should not block the prompt flow
  }
}

function getPromptText(error) {
  const code = errorCode(error);
  if (code === 400) return '这句话没有通过检查，换个说法试试';
  if (code === 503 || code >= 500) return '现在发不出去，内容先帮你留着，过一会儿再试';
  return error?.message || '没发出去，内容先帮你留着，再试一次';
}

function getDownloadUrl(result) {
  const payload = payloadOf(result);
  return payload.url || payload.downloadUrl || payload.fileUrl || payload.ticketUrl || '';
}

function findCurrentUserComment(comments = []) {
  const me = userIdOf(currentUser());
  if (!me) return false;
  return comments.some(comment => {
    if (String(comment.userId || '') === me) return true;
    return (comment.replies || []).some(reply => String(reply.userId || '') === me);
  });
}

function setCommentById(comments, id, updater) {
  return comments.map(comment => String(comment.id || comment._id) === String(id) ? updater(comment) : comment);
}

Page({
  normalizeComment,
  normalizeReply,
  getPromptText,

  data: {
    loading: true,
    error: false,
    gone: false,
    note: null,
    comments: [],
    commentsLoading: false,
    downloading: false,
    downloadProgress: 0,
    downloadLoaded: 0,
    downloadTotal: 0,
    downloadError: '',
    isOpening: false,
    composer: { visible: false, text: '', placeholder: '留一句回响……', commentId: '', replyToUserId: '' },
    posting: false,
    postReadPrompt: false,
    promptSuggestions: ['谢谢这份陪伴', '我也有过这样的时刻', '今天想试一试……'],
    focusCommentId: ''
  },

  onLoad(options = {}) {
    this._id = decode(options.id || options.noteId || '');
    this._focusCommentId = decode(options.commentId || options.focusCommentId || '');
    this.setData({ focusCommentId: this._focusCommentId });
    if (typeof wx.hideShareMenu === 'function') wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    this.load();
  },

  onShow() {
    if (this._didOpenDocument) {
      this._didOpenDocument = false;
      this.maybeShowPostReadPrompt();
    }
  },

  onUnload() {
    if (this._downloadTask && this._downloadTask.abort) this._downloadTask.abort();
    this._downloadTask = null;
  },

  async load() {
    if (!this._id) {
      this.setData({ loading: false, gone: true });
      return;
    }
    this.setData({ loading: true, error: false, gone: false });
    try {
      const [rawNote, rawComments] = await Promise.all([
        service.getOne(this._id),
        service.getComments(this._id, { limit: 50 })
      ]);
      const note = service.normalizeNote(rawNote);
      note.recentLikes = (note.recentLikes || []).map(item => ({
        ...item,
        ...getUserAvatarDisplay(item, {
          userId: userIdOf(item.userId || item),
          displayName: item.nickname || item.name || '书友'
        })
      }));
      if (!note.id) {
        this.setData({ loading: false, gone: true });
        return;
      }
      const comments = commentsFrom(rawComments).map(item => normalizeComment(item, note));
      this.setData({
        loading: false,
        note,
        comments,
        commentsLoading: false,
        composer: { ...this.data.composer, visible: false },
        postReadPrompt: false
      }, () => this.focusComment());
    } catch (error) {
      const code = errorCode(error);
      if (code === 404 || /不存在|未找到/.test(error?.message || '')) {
        this.setData({ loading: false, gone: true });
        return;
      }
      this.setData({ loading: false, error: true });
    }
  },

  retry() {
    this.load();
  },

  focusComment() {
    if (!this._focusCommentId || typeof wx.pageScrollTo !== 'function') return;
    setTimeout(() => {
      wx.pageScrollTo({ selector: `#companion-comment-${this._focusCommentId}`, offsetTop: 120, duration: 360 });
    }, 80);
  },

  async openDocument() {
    const note = this.data.note;
    if (!note || this.data.downloading || this.data.isOpening) return;
    if (this._tempFilePath) {
      this.openDownloadedFile(this._tempFilePath);
      return;
    }
    this.setData({ downloading: true, downloadProgress: 0, downloadLoaded: 0, downloadTotal: 0, downloadError: '' });
    await this.downloadNote(0);
  },

  async downloadNote(attempt) {
    try {
      const ticket = await service.getFileTicket(this.data.note.id);
      const url = getDownloadUrl(ticket);
      if (!url) throw new Error('下载链接没取到');
      await this.downloadUrl(url);
    } catch (error) {
      if (attempt < DOWNLOAD_RETRY_LIMIT && [401, 403, 404].includes(errorCode(error))) {
        return this.downloadNote(attempt + 1);
      }
      this.setData({ downloading: false, downloadError: '手札没取到，点这里再试一次' });
    }
  },

  downloadUrl(url) {
    return new Promise((resolve, reject) => {
      if (typeof wx.downloadFile !== 'function') {
        reject(new Error('当前微信版本不支持下载'));
        return;
      }
      const task = wx.downloadFile({
        url,
        success: response => {
          this._downloadTask = null;
          if (response.statusCode && response.statusCode >= 400) {
            const error = new Error('下载链接已失效');
            error.statusCode = response.statusCode;
            reject(error);
            return;
          }
          if (!response.tempFilePath) {
            reject(new Error('下载文件为空'));
            return;
          }
          this._tempFilePath = response.tempFilePath;
          this.setData({ downloading: false, downloadProgress: 100, downloadLoaded: 0, downloadTotal: 0 });
          this.openDownloadedFile(response.tempFilePath);
          resolve(response.tempFilePath);
        },
        fail: error => {
          this._downloadTask = null;
          reject(error);
        }
      });
      this._downloadTask = task;
      if (task && typeof task.onProgressUpdate === 'function') {
        task.onProgressUpdate(progress => {
          this.setData({
            downloadProgress: Number(progress.progress) || 0,
            downloadLoaded: Number(progress.totalBytesWritten) || 0,
            downloadTotal: Number(progress.totalBytesExpectedToWrite) || 0
          });
        });
      }
    });
  },

  cancelDownload() {
    if (this._downloadTask && this._downloadTask.abort) this._downloadTask.abort();
    this._downloadTask = null;
    this.setData({ downloading: false, downloadProgress: 0, downloadError: '' });
  },

  retryDownload() {
    if (this.data.downloading) return;
    this.setData({ downloadError: '' });
    this.openDocument();
  },

  openDownloadedFile(filePath) {
    if (this.data.isOpening) return;
    this.setData({ isOpening: true, downloadError: '' });
    const open = typeof wx.openDocument === 'function' ? wx.openDocument : null;
    if (!open) {
      this.setData({ isOpening: false, downloadError: '这台手机打不开 PDF，可以稍后在电脑版微信里看' });
      return;
    }
    open({
      filePath,
      fileType: 'pdf',
      showMenu: false,
      success: () => {
        this.setData({ isOpening: false });
        this._didOpenDocument = true;
        this.markRead();
      },
      fail: () => {
        this.setData({ isOpening: false, downloadError: '这台手机打不开 PDF，可以稍后在电脑版微信里看' });
      }
    });
  },

  async markRead() {
    const note = this.data.note;
    if (!note || note.isRead) return;
    const previous = note;
    this.setData({ note: { ...note, isRead: true, readerCount: note.readerCount + 1 } });
    try {
      const result = await service.markRead(note.id);
      const payload = payloadOf(result);
      if (payload.readerCount !== undefined) this.setData({ note: { ...this.data.note, readerCount: Number(payload.readerCount) || 0 } });
    } catch (error) {
      // 本地已读状态让刚刚读过的页面即时反馈；服务端幂等接口会在下次进入时校正。
      if (previous.isRead) this.setData({ note: previous });
    }
  },

  maybeShowPostReadPrompt() {
    const note = this.data.note;
    if (!note || readPromptKey(note.id) || this.data.postReadPrompt) return;
    if (note.hasCommented === true || note.userCommented === true || findCurrentUserComment(this.data.comments)) return;
    writePromptKey(note.id);
    this.setData({ postReadPrompt: true });
  },

  closePostReadPrompt() {
    this.setData({ postReadPrompt: false });
  },

  choosePrompt(event) {
    const text = event.currentTarget.dataset.text || '';
    this.setData({ postReadPrompt: false, composer: { visible: true, text, placeholder: '留一句回响……', commentId: '', replyToUserId: '' } });
  },

  openCommentInput(event) {
    const dataset = event.currentTarget.dataset || {};
    const commentId = String(dataset.commentId || '');
    const replyToUserId = String(dataset.userId || '');
    const name = dataset.userName || '';
    this.setData({
      postReadPrompt: false,
      composer: {
        visible: true,
        text: '',
        placeholder: commentId ? `回复 ${name || '这位书友'}……` : '留一句回响……',
        commentId,
        replyToUserId
      }
    });
  },

  closeComposer() {
    if (this.data.posting) return;
    this.setData({ composer: { ...this.data.composer, visible: false } });
  },

  onComposerInput(event) {
    this.setData({ composer: { ...this.data.composer, text: event.detail.value || '' } });
  },

  async submitComposer() {
    if (this.data.posting) return;
    const composer = this.data.composer;
    const content = String(composer.text || '').trim();
    if (!content) {
      wx.showToast({ title: '先写一句回响吧', icon: 'none' });
      return;
    }
    if (Array.from(content).length > COMMENT_MAX) {
      wx.showToast({ title: `最多 ${COMMENT_MAX} 字`, icon: 'none' });
      return;
    }
    const me = decorateAuthor(currentUser(), '我');
    const tempId = `pending-${Date.now()}`;
    const pending = normalizeComment({ _id: tempId, content, userId: me.userId, user: me, createdAt: new Date().toISOString() }, this.data.note);
    const pendingReply = normalizeReply({ _id: tempId, content, userId: me.userId, user: me, createdAt: new Date().toISOString(), replyToUserId: composer.replyToUserId }, this.data.note);
    const previousComments = this.data.comments;
    const nextComments = composer.commentId
      ? setCommentById(previousComments, composer.commentId, comment => ({ ...comment, replies: [...(comment.replies || []), pendingReply], replyCount: (comment.replyCount || 0) + 1 }))
      : [pending, ...previousComments];
    this.setData({ comments: nextComments, posting: true });
    try {
      const result = composer.commentId
        ? await service.reply(composer.commentId, content, composer.replyToUserId)
        : await service.createComment(this.data.note.id, content);
      const replySource = result && Array.isArray(result.replies)
        ? result.replies[result.replies.length - 1]
        : (result && result.reply) || result;
      const saved = composer.commentId
        ? normalizeReply(replySource, this.data.note)
        : normalizeComment(result, this.data.note);
      const replaced = composer.commentId
        ? setCommentById(nextComments, composer.commentId, comment => ({
            ...comment,
            replies: (comment.replies || []).map(reply => String(reply.id) === tempId ? saved : reply)
          }))
        : nextComments.map(comment => String(comment.id) === tempId ? saved : comment);
      this.setData({
        comments: replaced,
        posting: false,
        composer: { ...composer, visible: false, text: '' },
        note: { ...this.data.note, commentCount: this.data.note.commentCount + (composer.commentId ? 0 : 1), hasCommented: true }
      });
      wx.showToast({ title: '回响已发出', icon: 'success' });
    } catch (error) {
      this.setData({ comments: previousComments, posting: false });
      wx.showToast({ title: getPromptText(error), icon: 'none' });
    }
  },

  handleCommentLongPress(event) {
    const dataset = event.currentTarget.dataset || {};
    const commentId = String(dataset.commentId || '');
    const replyId = String(dataset.replyId || '');
    if (!commentId) return;
    appDialog.showActionSheet({
      itemList: ['删除'],
      success: result => {
        if (result && result.tapIndex === 0) this.deleteCommentOrReply(commentId, replyId);
      }
    });
  },

  async deleteCommentOrReply(commentId, replyId = '') {
    try {
      if (replyId) await service.removeReply(commentId, replyId);
      else await service.removeComment(commentId);
      const comments = replyId
        ? setCommentById(this.data.comments, commentId, comment => ({ ...comment, replies: (comment.replies || []).filter(reply => String(reply.id) !== replyId), replyCount: Math.max((comment.replyCount || 1) - 1, 0) }))
        : this.data.comments.filter(comment => String(comment.id) !== commentId);
      this.setData({ comments, note: { ...this.data.note, commentCount: replyId ? this.data.note.commentCount : Math.max(this.data.note.commentCount - 1, 0) } });
      wx.showToast({ title: '已删除', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: error?.message || '没删掉，再试一次', icon: 'none' });
    }
  },

  async toggleLike() {
    const note = this.data.note;
    if (!note) return;
    const liked = !note.isLiked;
    const previous = note;
    this.setData({ note: { ...note, isLiked: liked, likeCount: Math.max(note.likeCount + (liked ? 1 : -1), 0) } });
    try {
      await (liked ? service.like(note.id) : service.unlike(note.id));
    } catch (error) {
      this.setData({ note: previous });
      wx.showToast({ title: error?.message || '没更新上，再试一次', icon: 'none' });
    }
  },

  async toggleCommentLike(event) {
    const dataset = event.currentTarget.dataset || {};
    const commentId = String(dataset.commentId || '');
    const replyId = String(dataset.replyId || '');
    if (!commentId) return;
    let previous;
    const comments = this.data.comments.map(comment => {
      if (String(comment.id) !== commentId) return comment;
      if (!replyId) {
        previous = { isLiked: comment.isLiked, likeCount: comment.likeCount };
        const isLiked = !comment.isLiked;
        return { ...comment, isLiked, likeCount: Math.max(comment.likeCount + (isLiked ? 1 : -1), 0) };
      }
      return {
        ...comment,
        replies: (comment.replies || []).map(reply => {
          if (String(reply.id) !== replyId) return reply;
          previous = { isLiked: reply.isLiked, likeCount: reply.likeCount };
          const isLiked = !reply.isLiked;
          return { ...reply, isLiked, likeCount: Math.max(reply.likeCount + (isLiked ? 1 : -1), 0) };
        })
      };
    });
    this.setData({ comments });
    try {
      const target = this.data.comments.find(comment => String(comment.id) === commentId);
      const item = replyId ? (target?.replies || []).find(reply => String(reply.id) === replyId) : target;
      await (item && item.isLiked ? service.likeComment(commentId, replyId) : service.unlikeComment(commentId, replyId));
    } catch (error) {
      this.setData({ comments: setCommentById(this.data.comments, commentId, comment => {
        if (!replyId) return { ...comment, ...previous };
        return { ...comment, replies: (comment.replies || []).map(reply => String(reply.id) === replyId ? { ...reply, ...previous } : reply) };
      }) });
    }
  },

  noop() {}
});
