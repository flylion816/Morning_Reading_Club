/**
 * 被看见：本人收到的看见卡列表
 */

const seenCardService = require('../../services/seen-card.service');
const { guardSocialPage } = require('../../utils/social-access');
const { getUserAvatarDisplay } = require('../../utils/avatar');
const { formatTimeAgo } = require('../../utils/formatters');
const { getSeenPhraseText } = require('../../utils/seen-phrases');

const PAGE_SIZE = 20;

function buildQueryString(params = {}) {
  return Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
}

function decorateCard(card = {}) {
  const avatar = getUserAvatarDisplay(
    { avatarUrl: card.avatarUrl, nickname: card.nickname },
    { userId: card.userId, displayName: card.nickname }
  );
  return {
    ...card,
    avatarUrl: avatar.avatarUrl,
    avatarText: avatar.avatarText,
    avatarColor: avatar.avatarColor,
    phraseText: getSeenPhraseText(card.phrase),
    timeText: formatTimeAgo(card.createdAt)
  };
}

Page({
  data: {
    socialAccessGranted: false,
    list: [],
    total: 0,
    page: 1,
    hasMore: true,
    loading: true,
    loadingMore: false,
    loadError: false
  },

  onShow() {
    if (!guardSocialPage(this)) return;
    this.loadFirstPage();
  },

  onPullDownRefresh() {
    Promise.resolve(this.loadFirstPage()).finally(() => {
      if (typeof wx.stopPullDownRefresh === 'function') wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    this.loadMore();
  },

  async loadFirstPage() {
    if (!this.data.list.length) this.setData({ loading: true });
    this.setData({ loadError: false });
    try {
      const result = await seenCardService.getReceived({ page: 1, limit: PAGE_SIZE });
      const list = (result.list || []).map(decorateCard);
      const total = result.total || 0;
      this.setData({
        list,
        total,
        page: 1,
        hasMore: list.length < total,
        loading: false
      });
    } catch (error) {
      this.setData({ loading: false, loadError: true });
    }
  },

  async loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore || this.data.loadError) return;
    const nextPage = this.data.page + 1;
    this.setData({ loadingMore: true });
    try {
      const result = await seenCardService.getReceived({ page: nextPage, limit: PAGE_SIZE });
      const more = (result.list || []).map(decorateCard);
      const list = this.data.list.concat(more);
      const total = result.total || this.data.total;
      this.setData({
        list,
        total,
        page: nextPage,
        hasMore: more.length > 0 && list.length < total,
        loadingMore: false
      });
    } catch (error) {
      this.setData({ loadingMore: false, hasMore: false });
    }
  },

  handleRetry() {
    this.loadFirstPage();
  },

  handleCardTap(event) {
    const { sectionId, checkinId } = event.currentTarget.dataset;
    if (!sectionId || !checkinId) return;
    const query = buildQueryString({ id: sectionId, checkinId, focus: 'comments' });
    wx.navigateTo({ url: `/pages/course-detail/course-detail?${query}` });
  }
});
