const insightService = require('../../services/insight.service');
const logger = require('../../utils/logger');

Page({
  data: {
    insights: [],
    loading: true,
    userId: null, // 目标用户ID（如果查看他人，此值为他人的ID）
    userName: '小凡看见', // 显示的标题
    isOtherUser: false, // 是否在查看他人的小凡看见
    headerEmoji: '🦁', // 头部emoji
    headerTitle: '小凡看见', // 头部标题
    headerDesc: '按章节查看个性化反馈' // 头部描述
  },

  onLoad(options) {
    // 检查是否是查看他人的小凡看见
    const targetUserId = options.userId;
    const targetUserName = options.userName ? decodeURIComponent(options.userName) : '小凡看见';

    const app = getApp();
    const currentUser = app.globalData.userInfo;

    // 初始化数据（在获取用户信息前）
    let headerEmoji, headerTitle, headerDesc;

    if (targetUserId) {
      // 查看他人的小凡看见 - 先用默认值，稍后从用户缓存中获取
      headerEmoji = '👤';
      headerTitle = targetUserName;
      headerDesc = '的个性化学习反馈';
    } else {
      // 查看自己的小凡看见
      headerEmoji = currentUser?.avatar || currentUser?.avatarText || '🦁';
      headerTitle = '我的小凡看见';
      headerDesc = '按章节查看个性化反馈';
    }

    this.setData({
      userId: targetUserId || null,
      userName: targetUserName,
      isOtherUser: !!targetUserId,
      headerEmoji,
      headerTitle,
      headerDesc
    });

    logger.debug('📋 insights.onLoad - 参数:', {
      targetUserId,
      targetUserName,
      isOtherUser: !!targetUserId,
      headerEmoji,
      headerTitle
    });

    // 如果是查看他人的小凡看见，从缓存或存储中获取目标用户的头像
    if (targetUserId) {
      this.loadTargetUserInfo();
    }

    this.loadInsights();
  },

  async loadTargetUserInfo() {
    try {
      const app = getApp();
      const targetUser = app.globalData.targetUserForInsights;

      if (targetUser) {
        // 从目标用户信息中获取头像
        const headerEmoji = targetUser.avatar || targetUser.avatarText || '👤';
        this.setData({ headerEmoji });
        logger.debug('✅ 已获取目标用户头像:', headerEmoji);
        // 清理临时变量，避免内存泄漏
        app.globalData.targetUserForInsights = null;
      } else {
        logger.warn('⚠️ 无法从全局变量中获取用户信息，使用默认值');
      }
    } catch (error) {
      logger.warn('获取目标用户头像出错:', error);
    }
  },

  async loadInsights() {
    try {
      this.setData({ loading: true });

      // 获取当前登录用户信息
      const app = getApp();
      const currentUserId = app.globalData.userInfo?._id;
      const constants = require('../../config/constants');
      const token = wx.getStorageSync(constants.STORAGE_KEYS.TOKEN);

      logger.debug('=== 加载小凡看见 ===');
      logger.debug('当前用户ID:', currentUserId);
      logger.debug('Token存在?:', !!token);
      logger.debug('是否查看他人:', this.data.isOtherUser);
      logger.debug('目标用户ID:', this.data.userId);

      if (!currentUserId) {
        logger.warn('用户未登录，无法加载小凡看见');
        this.setData({ loading: false });
        return;
      }

      if (!token) {
        logger.warn('Token不存在，需要重新登录');
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

      // 根据是否查看他人来调用不同的API
      let res;
      if (this.data.isOtherUser) {
        // 查看他人的小凡看见（需要已获得权限）
        logger.debug('📖 加载他人的小凡看见...');
        res = await insightService.getUserInsightsList(this.data.userId, { limit: 100 });
      } else {
        // 查看自己的小凡看见
        logger.debug('📖 加载自己的小凡看见...');
        res = await insightService.getInsightsList({ limit: 100 });
      }

      logger.debug('获取insights列表响应:', res);

      // 处理响应数据
      let insightsList = [];
      if (res && res.list) {
        insightsList = res.list;
      } else if (Array.isArray(res)) {
        insightsList = res;
      }

      logger.debug('原始insights数据:', insightsList);
      logger.debug('原始insights数据长度:', insightsList.length);

      // API已经返回了当前用户相关的所有insights
      // 包括：1) 当前用户创建的 2) 分配给当前用户的
      // 无需额外过滤，直接使用
      const filtered = insightsList;

      logger.debug('过滤后的insights:', filtered);
      logger.debug('过滤后的长度:', filtered.length);

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
        const periodName =
          item.periodId?.name ||
          item.periodId?.title ||
          periodMap[item.periodId?._id || item.periodId] ||
          '';

        return {
          id: item._id || item.id,
          dayNumber: item.day || 1,
          periodName: periodName, // 添加期次名称
          title: item.sectionId?.title || item.title || '学习反馈',
          preview: preview || '暂无预览',
          date: item.createdAt ? new Date(item.createdAt).toLocaleDateString('zh-CN') : ''
        };
      });

      logger.debug('格式化后的insights:', formatted);

      this.setData({
        insights: formatted,
        loading: false
      });
    } catch (error) {
      logger.error('加载失败:', error);
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
