const insightService = require('../../services/insight.service');

/**
 * 将纯文本转换为HTML格式
 */
function textToHtml(text) {
  if (!text) return '';

  // 1. 转义HTML特殊字符
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // 2. 将换行符转换为<br>标签
  const withLineBreaks = escaped.replace(/\n/g, '<br/>');

  // 3. 检测段落（通过两个或更多连续换行）并用<p>标签包装
  const withParagraphs = withLineBreaks
    .split(/<br\/><br\/>/g)
    .map(paragraph => `<p>${paragraph.replace(/<br\/>/g, '<br/>')}</p>`)
    .join('');

  return withParagraphs;
}

Page({
  data: {
    insightId: null,
    insight: {}
  },

  onLoad(options) {
    this.setData({ insightId: options.id });
    this.loadInsightDetail();
  },

  async loadInsightDetail() {
    try {
      const insight = await insightService.getInsightDetail(this.data.insightId);

      // 添加 dayNumber 字段用于显示
      if (insight && !insight.dayNumber) {
        insight.dayNumber = insight.day || 1;
      }

      // 将纯文本内容转换为HTML格式以支持rich-text渲染
      if (insight && insight.content) {
        insight.content = textToHtml(insight.content);
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
   * 分享到微信好友（系统原生分享）
   */
  onShareAppMessage() {
    const { insight } = this.data;
    return {
      title: `${insight.title || '晨读营'} - 小凡看见`,
      path: `/pages/insight-detail/insight-detail?id=${this.data.insightId}`,
      imageUrl: '/assets/images/share-insight.png' // 使用新的"小凡看见"专属分享图
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    const { insight } = this.data;
    return {
      title: `${insight.title || '晨读营'} - 小凡看见`,
      query: `id=${this.data.insightId}`,
      imageUrl: '/assets/images/share-insight.png' // 使用新的"小凡看见"专属分享图
    };
  }
});
