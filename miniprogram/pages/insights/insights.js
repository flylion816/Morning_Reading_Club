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
      const constants = require('../../config/constants');
      const token = wx.getStorageSync(constants.STORAGE_KEYS.TOKEN);

      console.log('=== 加载小凡看见 ===');
      console.log('当前用户ID:', currentUserId);
      console.log('Token存在?:', !!token);
      console.log('app.globalData.userInfo:', app.globalData.userInfo);

      if (!currentUserId) {
        console.warn('用户未登录，无法加载小凡看见');
        this.setData({ loading: false });
        return;
      }

      if (!token) {
        console.warn('Token不存在，需要重新登录');
        wx.showToast({
          title: '登录已过期，请重新登录',
          icon: 'none'
        });
        this.setData({ loading: false });
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/login/login'
          });
        }, 1500);
        return;
      }

      // 获取所有insights
      const res = await insightService.getInsightsList({ limit: 100 });
      console.log('获取insights列表响应:', res);

      // 处理响应数据
      let insightsList = [];
      if (res && res.list) {
        insightsList = res.list;
      } else if (Array.isArray(res)) {
        insightsList = res;
      }

      console.log('原始insights数据:', insightsList);
      console.log('原始insights数据长度:', insightsList.length);

      // 过滤：只显示 targetUserId 是当前用户的 insights
      const filtered = insightsList.filter(item => {
        console.log('检查item:', item);
        console.log('  - item._id:', item._id);
        console.log('  - item.targetUserId:', item.targetUserId);
        console.log('  - 类型:', typeof item.targetUserId);

        // 如果 targetUserId 存在，只有当 targetUserId 等于当前用户ID时才显示
        if (item.targetUserId) {
          // targetUserId 可能是字符串或对象
          const targetId = typeof item.targetUserId === 'object' ? item.targetUserId._id : item.targetUserId;
          const currentId = String(currentUserId);
          const compareId = String(targetId);

          console.log('  - targetId:', compareId);
          console.log('  - currentUserId:', currentId);
          console.log('  - 相等?:', compareId === currentId);
          return compareId === currentId;
        }
        // 如果没有设置 targetUserId，不显示
        console.log('  - 没有targetUserId，过滤掉');
        return false;
      });

      console.log('过滤后的insights:', filtered);
      console.log('过滤后的长度:', filtered.length);

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
