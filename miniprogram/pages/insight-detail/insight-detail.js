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
    isDev: env.currentEnv === 'dev'
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
      path: `/pages/insight-detail/insight-detail?id=${this.data.insightId}`,
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
      path: `/pages/insight-detail/insight-detail?id=${this.data.insightId}`
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
      path: `/pages/insight-detail/insight-detail?id=${this.data.insightId}`,
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
      query: `id=${this.data.insightId}`,
      imageUrl: '/assets/images/share-insight.jpg' // 使用新的"小凡看见"专属分享图
    };
  }
});
