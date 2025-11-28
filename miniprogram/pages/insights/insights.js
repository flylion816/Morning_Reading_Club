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

      // 获取当前登录用户信息
      const app = getApp();
      const currentUserId = app.globalData.userInfo?._id;

      if (!currentUserId) {
        console.warn('用户未登录，无法加载小凡看见');
        this.setData({ loading: false });
        return;
      }

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

      // 过滤：只显示 targetUserId 是当前用户的 insights
      const filtered = insightsList.filter(item => {
        // 如果 targetUserId 存在，只有当 targetUserId 等于当前用户ID时才显示
        if (item.targetUserId) {
          const targetId = item.targetUserId._id || item.targetUserId;
          return targetId === currentUserId;
        }
        // 如果没有设置 targetUserId，不显示
        return false;
      });

      console.log('过滤后的insights:', filtered);

      // 获取所有期次信息用于映射期次名称
      const periods = app.globalData.periods || [];
      const periodMap = {};
      periods.forEach(period => {
        periodMap[period._id] = period.name || period.title;
      });

      // 格式化数据以匹配WXML期望的字段
      const formatted = filtered.map(item => {
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

        // 从 API 响应中获取期次名称，或从本地 periodMap 中查找
        const periodName = item.periodId?.name || item.periodId?.title || periodMap[item.periodId?._id || item.periodId] || '';

        return {
          id: item._id || item.id,
          dayNumber: item.day || 1,
          periodName: periodName,  // 添加期次名称
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
