/**
 * 收到分享的一页（随喜 / 觉察）：只读视图。
 * 没有登录、没有权限、分享已停止、记录已删除，一律回到首页；页面里没有转发入口，转发菜单也隐藏。
 * 朋友圈单页模式不能请求接口，只提示「前往小程序」。
 */
const service = require('../share.service');
const richNote = require('../../../utils/rich-note');
const text = require('../awareness-text');
const { tenantStorage } = require('../../../utils/storage');
const constants = require('../../../config/constants');

const HOME = '/pages/index/index';
const MOMENTS_SINGLE_PAGE_SCENE = 1154;

function hasToken() {
  try {
    return Boolean(tenantStorage.get(constants.STORAGE_KEYS.TOKEN));
  } catch (error) {
    return false;
  }
}

// 扫小程序码进来时，scene 里只有 s=<8 位分享码>；点转发卡片进来时是 code=<分享码>
function parseCode(options = {}) {
  const direct = String(options.code || '').toLowerCase();
  if (/^[a-z0-9]{8}$/.test(direct)) return direct;
  let scene = options.scene ? String(options.scene) : '';
  try {
    scene = decodeURIComponent(scene);
  } catch (error) {
    // 保持原样
  }
  const match = scene.match(/(?:^|&)s=([a-z0-9]{8})(?:&|$)/i);
  return match ? match[1].toLowerCase() : '';
}

function nodesOf(html) {
  return html ? richNote.toDisplayHtml(html) : '';
}

function sourceLabel(share) {
  if (!share.periodName) return '';
  const parts = [share.periodName];
  if (share.sectionTitle) {
    const day = share.day === null || share.day === undefined ? NaN : Number(share.day);
    const dayText = Number.isFinite(day) ? (day === 0 ? '开篇' : `第 ${day} 天`) : '';
    parts.push([dayText, share.sectionTitle].filter(Boolean).join(' · '));
  }
  return parts.join(' · ');
}

function buildView(share) {
  const isAwareness = share.kind === 'awareness' && share.awareness;
  const a = share.awareness || {};
  return {
    kind: isAwareness ? 'awareness' : 'joy',
    isOwner: Boolean(share.isOwner),
    title: share.title || '',
    dateLabel: text.dateWithDaypart(share.createdAt),
    sourceLabel: sourceLabel(share),
    author: share.author || { nickname: '书友' },
    content: share.content || '',
    contentNodes: nodesOf(share.contentHtml),
    awareness: isAwareness
      ? {
          facts: a.facts || '',
          factsNodes: nodesOf(a.factsHtml),
          feelings: a.feelings || [],
          feelingNote: a.feelingNote || '',
          bodyText: (a.bodyAreas || []).join('、'),
          asks: (a.asks || []).map(ask => ({
            label: text.LEVEL_LABELS[(ask.level || 1) - 1] || '问',
            question: ask.question || '',
            answer: ask.answer || '',
            answerNodes: nodesOf(ask.answerHtml)
          })),
          choice: a.choice || '',
          choiceNodes: nodesOf(a.choiceHtml),
          followUps: (a.followUps || []).map(item => ({ content: item.content, dateLabel: text.monthDay(item.createdAt) }))
        }
      : null
  };
}

function reasonOf(error) {
  const status = (error && (error.statusCode || error.code)) || 0;
  if (status === 401) return '登录后才能查看这一页';
  if (status === 403) return (error && error.message) || '这一页暂时没法给你看';
  if (status === 404) return '这个分享已经停止了';
  return '这一页暂时打不开';
}

Page({
  data: {
    loading: true,
    singlePage: false,
    view: null
  },

  onLoad(options = {}) {
    // 收到的人不能再转发这一页
    if (typeof wx.hideShareMenu === 'function') {
      wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    }
    let singlePage = false;
    try {
      singlePage = typeof wx.getLaunchOptionsSync === 'function' && wx.getLaunchOptionsSync().scene === MOMENTS_SINGLE_PAGE_SCENE;
    } catch (error) {
      singlePage = false;
    }
    if (singlePage) {
      this.setData({ loading: false, singlePage: true });
      return;
    }
    this._code = parseCode(options);
    if (!this._code) {
      this.goHome('这个分享没找到');
      return;
    }
    if (!hasToken()) {
      this.goHome('登录后才能查看这一页');
      return;
    }
    this.load();
  },

  async load() {
    try {
      const share = await service.read(this._code);
      this.setData({ loading: false, view: buildView(share) });
    } catch (error) {
      this.goHome(reasonOf(error));
    }
  },

  // 打不开就回首页（没登录、没权限、已停止、已删除都一样）
  goHome(message) {
    if (this._leaving) return;
    this._leaving = true;
    wx.switchTab({
      url: HOME,
      success: () => {
        if (message) wx.showToast({ title: message, icon: 'none' });
      },
      fail: () => wx.reLaunch({ url: HOME })
    });
  },

  backHome() {
    wx.switchTab({ url: HOME });
  },

  // 我也来记一记
  goWrite() {
    wx.navigateTo({ url: '/pages/joy-notes/joy-notes' });
  },

  noop() {}
});
