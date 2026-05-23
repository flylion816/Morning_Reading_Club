const request = require('../../utils/request');
const { getAvatarColorByUserId } = require('../../utils/formatters');
const { getLastTextChar } = require('../../utils/avatar');
const { richContentToPlainText } = require('../../utils/markdown');

Page({
  data: {
    sectionId: '',
    sectionTitle: '',
    insights: [],
    loading: true,
    total: 0
  },

  onLoad(options) {
    const sectionId = options.sectionId;
    const sectionTitle = options.sectionTitle ? decodeURIComponent(options.sectionTitle) : '';
    if (!sectionId) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    this.setData({ sectionId, sectionTitle });
    this.loadInsights();
  },

  async loadInsights() {
    this.setData({ loading: true });
    try {
      const res = await request.get(`/insights/section/${this.data.sectionId}`, { limit: 100 });
      const list = (res.list || []).map(item => {
        const targetUser = item.targetUserId || {};
        const userId = targetUser._id || targetUser.id || '';
        const rawPreview = item.content ? richContentToPlainText(item.content).replace(/\s+/g, ' ').trim() : '';
        const shareCount = item.shareCount || 0;
        return {
          id: item._id,
          insightId: item._id,
          userId,
          nickname: targetUser.nickname || '书友',
          avatarUrl: targetUser.avatarUrl || targetUser.avatar || '',
          avatarText: getLastTextChar(targetUser.nickname || '书友', '友'),
          avatarColor: getAvatarColorByUserId(userId),
          preview: rawPreview || '（暂无内容）',
          mediaType: item.mediaType,
          imageUrl: item.imageUrl || '',
          likeCount: item.likeCount || 0,
          danmakuCount: item.danmakuCount || 0,
          shareCount,
          shareLabel: shareCount > 0 ? `已分享 ${shareCount} 次` : '未分享'
        };
      });
      this.setData({ insights: list, total: res.total || list.length, loading: false });
    } catch (err) {
      console.error('加载小凡看见失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  handleInsightTap(e) {
    const { insightId } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/insight-detail/insight-detail?id=${insightId}`
    });
  }
});
