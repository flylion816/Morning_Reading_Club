/**
 * 陪伴手札小程序接口。
 * 这份服务放在主包：首页、课程详情和手札分包都会引用。
 */
const request = require('../utils/request');
const env = require('../config/env');

const quiet = { suppressError: true };

// 后端返回的封面是相对路径（/uploads/...），image 组件需要完整 URL
function absoluteCoverUrl(url) {
  const value = String(url || '');
  if (!value || /^https?:\/\//.test(value)) return value;
  const origin = String(env.apiBaseUrl || '').replace(/\/api\/v1\/?$/, '');
  return `${origin}${value.startsWith('/') ? '' : '/'}${value}`;
}

function idOf(value) {
  if (value && typeof value === 'object') return value._id || value.id || '';
  return value || '';
}

function formatBytes(size) {
  if (!size || size <= 0) return 0;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function normalizeNote(item = {}) {
  const file = item.file && typeof item.file === 'object' ? item.file : {};
  const rawSectionLabels = Array.isArray(item.sectionLabels) ? item.sectionLabels.filter(Boolean) : [];
  const sections = Array.isArray(item.sections)
    ? item.sections
    : Array.isArray(item.sectionList)
      ? item.sectionList
      : rawSectionLabels.filter(section => typeof section === 'object');
  const sectionIds = (Array.isArray(item.sectionIds) ? item.sectionIds : rawSectionLabels.map(section => section && section.sectionId))
    .map(idOf)
    .filter(Boolean)
    .map(String);
  const sectionLabels = rawSectionLabels.length
    ? rawSectionLabels.map(section => typeof section === 'object' ? (section.title || section.name || '') : String(section)).filter(Boolean)
    : sections.map(section => section.title || section.name || '').filter(Boolean);
  const sectionDays = (sections.length ? sections : rawSectionLabels)
    .map(section => Number(section && section.day))
    .filter(Number.isFinite);
  const id = String(idOf(item._id || item.id || item.noteId) || '');
  const periodId = String(idOf(item.periodId) || '');
  const period = item.period && typeof item.period === 'object' ? item.period : {};
  const periodName = item.periodName || period.name || period.title || '';
  const pageCount = Number(item.pageCount || file.pageCount || 0) || 0;
  const likeCount = Number(item.likeCount) || 0;
  const commentCount = Number(item.commentCount) || 0;
  const readerCount = Number(item.readerCount) || 0;

  return {
    ...item,
    id,
    _id: id,
    title: item.title || '未命名手札',
    summary: item.summary || '',
    companionName: item.companionName || item.authorName || '陪伴人',
    companionUserId: String(idOf(item.companionUserId) || ''),
    companionUserIds: (Array.isArray(item.companionUserIds) ? item.companionUserIds : [])
      .map(idOf)
      .filter(Boolean)
      .map(String),
    coverUrl: absoluteCoverUrl(item.coverUrl || item.cover || ''),
    originalName: String(file.originalName || item.originalName || ''),
    periodId,
    periodName,
    sectionIds,
    sectionLabels,
    sectionDays,
    sectionTitle: item.sectionTitle || sectionLabels[0] || '',
    pageCount,
    // 字节数转成可读的 KB/MB，别把 1771961 这种原始值直接渲染到页面上
    fileSize: formatBytes(Number(item.fileSize || file.size || 0) || 0),
    likeCount,
    commentCount,
    readerCount,
    isRead: item.isRead === true,
    isNew: item.isNew === true,
    isLiked: item.isLiked === true,
    publishedAt: item.publishedAt || item.createdAt || '',
    sortOrder: Number(item.sortOrder) || 0,
    locked: item.locked === true
  };
}

function listFrom(response) {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== 'object') return [];
  return response.list || response.items || response.notes || response.data || [];
}

const service = {
  getList(params = {}) {
    return request.get('/companion-notes', params, quiet);
  },

  getSection(sectionId) {
    return request.get(`/companion-notes/section/${encodeURIComponent(sectionId)}`, {}, quiet);
  },

  getOverview(periodId) {
    return request.get(`/companion-notes/period/${encodeURIComponent(periodId)}/overview`, {}, quiet);
  },

  getOne(noteId) {
    return request.get(`/companion-notes/${encodeURIComponent(noteId)}`, {}, quiet);
  },

  getFileTicket(noteId) {
    return request.post(`/companion-notes/${encodeURIComponent(noteId)}/file-ticket`, {}, quiet);
  },

  markRead(noteId) {
    return request.post(`/companion-notes/${encodeURIComponent(noteId)}/read`, {}, quiet);
  },

  like(noteId) {
    return request.post(`/companion-notes/${encodeURIComponent(noteId)}/like`, {}, quiet);
  },

  unlike(noteId) {
    return request.delete(`/companion-notes/${encodeURIComponent(noteId)}/like`, {}, quiet);
  },

  getComments(noteId, params = {}) {
    return request.get(`/companion-notes/${encodeURIComponent(noteId)}/comments`, params, quiet);
  },

  createComment(noteId, content) {
    return request.post(`/companion-notes/${encodeURIComponent(noteId)}/comments`, { content }, quiet);
  },

  reply(commentId, content, replyToUserId = '') {
    const data = { content };
    if (replyToUserId) data.replyToUserId = replyToUserId;
    return request.post(`/companion-notes/comments/${encodeURIComponent(commentId)}/replies`, data, quiet);
  },

  removeComment(commentId) {
    return request.delete(`/companion-notes/comments/${encodeURIComponent(commentId)}`, {}, quiet);
  },

  removeReply(commentId, replyId) {
    return request.delete(
      `/companion-notes/comments/${encodeURIComponent(commentId)}/replies/${encodeURIComponent(replyId)}`,
      {},
      quiet
    );
  },

  likeComment(commentId, replyId = '') {
    const suffix = replyId
      ? `/replies/${encodeURIComponent(replyId)}`
      : '';
    return request.post(`/companion-notes/comments/${encodeURIComponent(commentId)}${suffix}/like`, {}, quiet);
  },

  unlikeComment(commentId, replyId = '') {
    const suffix = replyId
      ? `/replies/${encodeURIComponent(replyId)}`
      : '';
    return request.delete(`/companion-notes/comments/${encodeURIComponent(commentId)}${suffix}/like`, {}, quiet);
  },

  normalizeNote,
  listFrom,
  idOf
};

module.exports = service;
