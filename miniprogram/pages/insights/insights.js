const insightService = require('../../services/insight.service');

Page({
  data: {
    insights: [],
    loading: true
  },

  onLoad() {
    this.loadInsights();
  },

  async loadInsights() {
    try {
      this.setData({ loading: true });

      // 获取所有insights
      const res = await insightService.getInsightsList({ limit: 100 });
      console.log('获取insights列表:', res);

      // 处理响应数据
      let insightsList = [];
      if (res && res.list) {
        insightsList = res.list;
      } else if (Array.isArray(res)) {
        insightsList = res;
      }

      console.log('原始insights数据:', insightsList);

      // 格式化数据以匹配WXML期望的字段
      const formatted = insightsList.map(item => {
        let preview = item.summary || '';
        if (!preview && item.content) {
          // 提取纯文本（去除所有HTML标签）
          const plainText = item.content.replace(/<[^>]*>/g, '').trim();
          // 取前150个字符
          preview = plainText.substring(0, 150);
          if (plainText.length > 150) {
            preview += '...';
          }
        }

        return {
          id: item._id || item.id,
          dayNumber: item.day || 1,
          title: item.sectionId?.title || item.title || '学习反馈',
          preview: preview || '暂无预览',
          date: item.createdAt ? new Date(item.createdAt).toLocaleDateString('zh-CN') : ''
        };
      });

      console.log('格式化后的insights:', formatted);

      this.setData({
        insights: formatted,
        loading: false
      });
    } catch (error) {
      console.error('加载失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  handleInsightClick(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/insight-detail/insight-detail?id=${id}`
    });
  }
});
