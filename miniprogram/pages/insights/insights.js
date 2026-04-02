const insightService = require('../../services/insight.service');
const userService = require('../../services/user.service');
const enrollmentService = require('../../services/enrollment.service');
const logger = require('../../utils/logger');
const { hasPaidEnrollment, redirectAfterCommunityDenied } = require('../../utils/period-access');

Page({
  data: {
    insights: [],
    loading: true,
    userId: null, // 目标用户ID（如果查看他人，此值为他人的ID）
    userName: '小凡看见', // 显示的标题
    isOtherUser: false, // 是否在查看他人的小凡看见
    lockedInsightCount: 0,
    unlockedInsightCount: 0,
    pendingRequestCount: 0,
    rejectedRequestCount: 0,
    headerEmoji: '🦁', // 头部emoji
    headerTitle: '小凡看见', // 头部标题
    headerDesc: '按课程查看个性化反馈' // 头部描述
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
      headerDesc = '按课程查看个性化反馈';
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

  getLockedPreview(requestStatus) {
    if (requestStatus === 'pending') {
      return '';
    }

    if (requestStatus === 'rejected' || requestStatus === 'revoked') {
      return '';
    }

    return '已锁定，点击发起查看申请';
  },

  getRequestStatusText(requestStatus) {
    const statusMap = {
      approved: '已同意',
      pending: '已发送申请',
      rejected: '申请未通过',
      revoked: '授权已撤销'
    };

    return statusMap[requestStatus] || '';
  },

  getLockedPlaceholder(requestStatus) {
    const placeholderMap = {
      pending: {
        text: '等待对方同意后查看'
      },
      rejected: {
        text: '暂未开放，可再次申请'
      },
      revoked: {
        text: '授权已撤销，可重新申请'
      },
      none: {
        text: '点击卡片申请查看'
      }
    };

    return placeholderMap[requestStatus] || placeholderMap.none;
  },

  buildInsightRequestLabel({ periodName = '', dayNumber = null, title = '' } = {}) {
    const parts = [];
    const titleHasDay = /第[一二三四五六七八九十0-9]+天/.test(title);

    if (periodName) {
      parts.push(periodName);
    }

    if (dayNumber && !titleHasDay) {
      parts.push(`第${dayNumber}天`);
    }

    if (title) {
      parts.push(title);
    }

    return parts.join(' · ') || '这条小凡看见';
  },

  updateInsightsSummary(insights) {
    const unlockedInsightCount = insights.filter(item => item.isAccessible).length;
    const lockedInsights = insights.filter(item => !item.isAccessible);
    const pendingRequestCount = lockedInsights.filter(
      item => item.requestStatus === 'pending'
    ).length;
    const rejectedRequestCount = lockedInsights.filter(
      item => item.requestStatus === 'rejected' || item.requestStatus === 'revoked'
    ).length;

    this.setData({
      insights,
      unlockedInsightCount,
      lockedInsightCount: insights.length - unlockedInsightCount,
      pendingRequestCount,
      rejectedRequestCount
    });
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
      logger.debug('🔍 准备加载数据，isOtherUser =', this.data.isOtherUser);

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

      const userEnrollments = await enrollmentService
        .getUserEnrollments({ limit: 100 })
        .catch(() => ({ list: [] }));
      const enrollmentList = userEnrollments.list || userEnrollments || [];

      if (!hasPaidEnrollment(enrollmentList)) {
        this.setData({ insights: [], loading: false });
        redirectAfterCommunityDenied('/pages/profile/profile', '完成支付后可查看');
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
        const isAccessible = item.isAccessible !== false;

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
          dayNumber: item.day || item.sectionId?.day || null,
          courseTitle: item.sectionId?.title || item.title || '学习反馈',
          periodName: periodName || '七个习惯晨读营',
          title: item.sectionId?.title || item.title || periodName || '小凡看见',
          preview: isAccessible
            ? preview || (item.imageUrl ? '点击查看图片反馈' : '暂无内容')
            : this.getLockedPreview(item.requestStatus || 'none'),
          mediaType: item.mediaType || 'text',
          imageUrl: isAccessible ? item.imageUrl || null : null,
          date: item.createdAt ? new Date(item.createdAt).toLocaleDateString('zh-CN') : '',
          periodId: item.periodId?._id || item.periodId || null,
          isAccessible,
          requestStatus: item.requestStatus || (isAccessible ? 'approved' : 'none'),
          requestStatusText: this.getRequestStatusText(item.requestStatus || 'none'),
          lockedPlaceholder: this.getLockedPlaceholder(item.requestStatus || 'none'),
          requestScope: item.requestScope || null,
          requestId: item.requestId || null
        };
      });

      logger.debug('格式化后的insights:', formatted);

      this.updateInsightsSummary(formatted);
      this.setData({ loading: false });
    } catch (error) {
      logger.error('加载失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  onShareAppMessage() {
    return {
      title: this.data.isOtherUser
        ? `${this.data.userName}的小凡看见`
        : '我的小凡看见 - 凡人共读',
      path: '/pages/profile/profile'
    };
  },

  onShareTimeline() {
    return {
      title: this.data.isOtherUser
        ? `${this.data.userName}的小凡看见`
        : '我的小凡看见 - 凡人共读'
    };
  },

  /**
   * 发起查看申请
   */
  async handleRequestInsight(periodId = null, insightId = null, insightMeta = {}) {
    try {
      const response = await userService.createInsightRequest(this.data.userId, periodId, insightId);
      this.updateInsightRequestState({
        insightId,
        periodId,
        requestStatus: 'pending',
        requestScope: insightId ? 'insight' : 'period',
        requestId: response?._id || response?.id || null
      });
      wx.showToast({ title: '申请已发送', icon: 'success' });
    } catch (error) {
      logger.error('发送申请失败:', error);
      wx.showToast({ title: '申请发送失败', icon: 'none' });
    }
  },

  /**
   * 点击 insight 项
   */
  handleInsightClick(e) {
    const { id, accessible, periodId, requestStatus, title, periodName, dayNumber } =
      e.currentTarget.dataset;
    const canAccess = accessible !== false && accessible !== 'false';

    if (!canAccess) {
      this.handleLockedInsightClick(periodId, id, requestStatus, {
        title,
        periodName,
        dayNumber
      });
      return;
    }

    if (!id) {
      console.warn('insight id 不存在，跳过导航');
      return;
    }
    wx.navigateTo({
      url: `/pages/insight-detail/insight-detail?id=${id}`
    });
  },

  handleLockedInsightClick(periodId, insightId, requestStatus = 'none', insightMeta = {}) {
    const { userName } = this.data;
    const requestLabel = this.buildInsightRequestLabel(insightMeta);

    if (requestStatus === 'pending') {
      wx.showToast({ title: '这条申请已发送，请等待对方同意', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '内容已锁定',
      content:
        requestStatus === 'rejected' || requestStatus === 'revoked'
          ? `「${requestLabel}」之前未获授权，是否向 ${userName} 重新发起查看申请？`
          : `「${requestLabel}」暂未授权，是否向 ${userName} 发起查看申请？`,
      confirmText: '发起申请',
      success: res => {
        if (res.confirm) {
          this.handleRequestInsight(periodId || null, insightId || null, insightMeta);
        }
      }
    });
  },

  updateInsightRequestState({ insightId = null, periodId = null, requestStatus, requestScope, requestId }) {
    const nextInsights = this.data.insights.map(item => {
      const shouldUpdate = insightId
        ? item.id === insightId
        : !!periodId && item.periodId === periodId && !item.isAccessible;

      if (!shouldUpdate) {
        return item;
      }

      return {
        ...item,
        requestStatus,
        requestStatusText: this.getRequestStatusText(requestStatus),
        requestScope,
        requestId,
        preview: this.getLockedPreview(requestStatus)
      };
    });

    this.updateInsightsSummary(nextInsights);
  }
});
