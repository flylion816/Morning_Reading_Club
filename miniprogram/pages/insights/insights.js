const insightService = require('../../services/insight.service');
const userService = require('../../services/user.service');
const enrollmentService = require('../../services/enrollment.service');
const activityService = require('../../services/activity.service');
const logger = require('../../utils/logger');
const { richContentToPlainText } = require('../../utils/markdown');
const subscribeAutoTopUp = require('../../utils/subscribe-auto-topup');
const { getUserAvatarDisplay } = require('../../utils/avatar');
const {
  hasPaidEnrollment,
  redirectAfterCommunityDenied
} = require('../../utils/period-access');

Page({
  data: {
    insights: [],
    loading: true,
    activeTab: 'mine',
    otherInsights: [],
    otherInsightsLoaded: false,
    otherInsightsLoading: false,
    userId: null, // 目标用户ID（如果查看他人，此值为他人的ID）
    userName: '小凡看见', // 显示的标题
    isOtherUser: false, // 是否在查看他人的小凡看见
    lockedInsightCount: 0,
    unlockedInsightCount: 0,
    pendingRequestCount: 0,
    rejectedRequestCount: 0,
    headerEmoji: '🦁', // 头部emoji
    headerAvatarUrl: '',
    headerAvatarText: '用',
    headerAvatarColor: '#4a90e2',
    headerTitle: '小凡看见', // 头部标题
    headerDesc: '按课程查看个性化反馈', // 头部描述
    showRequestSharePrompt: false,
    pendingShareRequest: null
  },

  onLoad(options) {
    // 检查是否是查看他人的小凡看见
    const targetUserId = options.userId;
    const initialTab = (!targetUserId && (options.tab === 'others' || options.tab === 'mine')) ? options.tab : 'mine';
    const targetUserName = options.userName
      ? decodeURIComponent(options.userName)
      : '小凡看见';

    const app = getApp();
    const currentUser = app.globalData.userInfo;

    // 初始化数据（在获取用户信息前）
    let headerEmoji, headerAvatarUrl, headerTitle, headerDesc;

    if (targetUserId) {
      // 查看他人的小凡看见 - 先用默认值，稍后从用户缓存中获取
      headerEmoji = '👤';
      headerAvatarUrl = '';
      headerTitle = targetUserName;
      headerDesc = '的个性化学习反馈';
    } else {
      // 查看自己的小凡看见
      const currentAvatar = getUserAvatarDisplay(currentUser || {});
      headerEmoji = currentAvatar.avatarText;
      headerAvatarUrl = currentAvatar.avatarUrl;
      headerTitle = '我的小凡看见';
      headerDesc = '按课程查看个性化反馈';
    }
    const initialHeaderAvatar = getUserAvatarDisplay(
      targetUserId ? { nickname: targetUserName } : currentUser || {},
      {
        userId: targetUserId || currentUser?._id || currentUser?.id,
        displayName: targetUserId
          ? targetUserName
          : currentUser?.nickname || currentUser?.name || '用户'
      }
    );

    this.setData({
      userId: targetUserId || null,
      userName: targetUserName,
      isOtherUser: !!targetUserId,
      activeTab: initialTab,
      headerEmoji,
      headerAvatarUrl,
      headerAvatarText: initialHeaderAvatar.avatarText,
      headerAvatarColor: initialHeaderAvatar.avatarColor,
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

    if (!targetUserId && initialTab === 'others') {
      this.loadOtherInsights();
    }

    // 查看自己的小凡看见时，静默补充订阅次数
    if (!targetUserId) {
      subscribeAutoTopUp
        .maybeAutoTopUpSubscriptions({
          sourceAction: 'insights_page_load',
          sourcePage: 'insights',
          sceneKeys: ['insight_created'],
          requestMode: 'remembered'
        })
        .catch(() => {});
    }
  },

  async loadTargetUserInfo() {
    try {
      const app = getApp();
      const targetUser = app.globalData.targetUserForInsights;

      if (targetUser) {
        // 从目标用户信息中获取头像
        const targetAvatar = getUserAvatarDisplay(targetUser);
        this.setData({
          headerEmoji: targetAvatar.avatarText,
          headerAvatarUrl: targetAvatar.avatarUrl,
          headerAvatarText: targetAvatar.avatarText,
          headerAvatarColor: targetAvatar.avatarColor
        });
        logger.debug('✅ 已获取目标用户头像:', targetAvatar.avatarText);
        // 清理临时变量，避免内存泄漏
        app.globalData.targetUserForInsights = null;
      } else {
        const targetUserId = this.data.userId;
        if (!targetUserId) {
          logger.warn('⚠️ 无法从全局变量中获取用户信息，使用默认值');
          return;
        }

        const fetchedUser = await userService.getUserById(targetUserId);
        const fetchedAvatar = getUserAvatarDisplay(fetchedUser);
        this.setData({
          headerEmoji: fetchedAvatar.avatarText,
          headerAvatarUrl: fetchedAvatar.avatarUrl,
          headerAvatarText: fetchedAvatar.avatarText,
          headerAvatarColor: fetchedAvatar.avatarColor,
          headerTitle: fetchedUser.nickname || this.data.headerTitle
        });
        logger.debug('✅ 已从接口获取目标用户头像:', fetchedAvatar.avatarText);
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
        text: '等待对方同意后查看，可点击再次提醒'
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

  buildInsightRequestLabel({
    periodName = '',
    dayNumber = null,
    title = ''
  } = {}) {
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
    const unlockedInsightCount = insights.filter(
      (item) => item.isAccessible
    ).length;
    const lockedInsights = insights.filter((item) => !item.isAccessible);
    const pendingRequestCount = lockedInsights.filter(
      (item) => item.requestStatus === 'pending'
    ).length;
    const rejectedRequestCount = lockedInsights.filter(
      (item) =>
        item.requestStatus === 'rejected' || item.requestStatus === 'revoked'
    ).length;

    this.setData({
      insights,
      unlockedInsightCount,
      lockedInsightCount: insights.length - unlockedInsightCount,
      pendingRequestCount,
      rejectedRequestCount
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
    if (tab === 'others' && !this.data.otherInsightsLoaded && !this.data.otherInsightsLoading) {
      this.loadOtherInsights();
    }
  },

  async loadOtherInsights() {
    this.setData({ otherInsightsLoading: true });
    try {
      const sentRes = await insightService.getSentRequests({ status: 'approved', limit: 100 });
      const approvedRequests = sentRes.list || (Array.isArray(sentRes) ? sentRes : []);

      const userMap = {};
      approvedRequests.forEach(req => {
        const userObj = req.toUserId;
        const uid = (typeof userObj === 'object' ? userObj?._id : userObj) || null;
        if (uid && !userMap[uid]) userMap[uid] = userObj;
      });

      const allRaw = [];
      await Promise.all(Object.entries(userMap).map(async ([userId, userInfo]) => {
        const res = await insightService.getUserInsightsList(userId, { limit: 100 });
        const list = (res.list || (Array.isArray(res) ? res : [])).filter(item => item.isAccessible !== false);
        const nickname = (typeof userInfo === 'object' ? userInfo?.nickname || userInfo?.name : '') || '用户';
        const avatarUrl = (typeof userInfo === 'object' ? userInfo?.avatarUrl : '') || '';
        list.forEach(insight => {
          allRaw.push({ ...insight, _targetUserId: userId, _targetNickname: nickname, _targetAvatarUrl: avatarUrl });
        });
      }));

      allRaw.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      const app = getApp();
      const periods = app.globalData.periods || [];
      const periodMap = {};
      periods.forEach(p => { periodMap[p._id] = p.name || p.title; });

      const formatted = allRaw.map(item => {
        let preview = richContentToPlainText(item.summary || '').replace(/\s+/g, ' ').trim();
        if (!preview && item.content) {
          const plain = richContentToPlainText(item.content).replace(/\s+/g, ' ').trim();
          preview = plain.substring(0, 150) + (plain.length > 150 ? '...' : '');
        }
        const periodName = item.periodId?.name || item.periodId?.title || periodMap[item.periodId?._id || item.periodId] || '';
        const nickname = item._targetNickname;
        const targetAvatar = getUserAvatarDisplay(
          { avatarUrl: item._targetAvatarUrl, nickname },
          { userId: item._targetUserId, displayName: nickname }
        );
        return {
          id: item._id || item.id,
          title: item.sectionId?.title || item.title || periodName || '小凡看见',
          periodName: periodName || '七个习惯晨读营',
          dayNumber: item.day || item.sectionId?.day || null,
          preview: preview || (item.imageUrl ? '点击查看图片反馈' : '暂无内容'),
          mediaType: item.mediaType || 'text',
          imageUrl: item.imageUrl || null,
          date: item.updatedAt || item.createdAt ? new Date(item.updatedAt || item.createdAt).toLocaleDateString('zh-CN') : '',
          periodId: item.periodId?._id || item.periodId || null,
          isAccessible: true,
          requestStatus: 'approved',
          requestStatusText: '',
          lockedPlaceholder: { text: '' },
          requestScope: null,
          requestId: null,
          targetUserAvatarUrl: targetAvatar.avatarUrl,
          targetUserAvatarText: targetAvatar.avatarText,
          targetUserAvatarColor: targetAvatar.avatarColor
        };
      });

      this.setData({ otherInsights: formatted, otherInsightsLoaded: true });
    } catch (err) {
      logger.error('加载他人洞见失败:', err);
    } finally {
      this.setData({ otherInsightsLoading: false });
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
        redirectAfterCommunityDenied(
          '/pages/profile/profile',
          '完成支付后可查看'
        );
        return;
      }

      // 根据是否查看他人来调用不同的API
      let res;
      if (this.data.isOtherUser) {
        // 查看他人的小凡看见（需要已获得权限）
        logger.debug('📖 加载他人的小凡看见...');
        res = await insightService.getUserInsightsList(this.data.userId, {
          limit: 100
        });
        activityService.track('other_insight_view', {
          targetType: 'user',
          targetId: this.data.userId,
          metadata: { page: 'insights' }
        });
      } else {
        // 查看自己的小凡看见
        logger.debug('📖 加载自己的小凡看见...');
        res = await insightService.getInsightsList({ limit: 100 });
        activityService.track('own_insight_view', {
          targetType: 'insight_list',
          metadata: { page: 'insights' }
        });
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
      periods.forEach((period) => {
        periodMap[period._id] = period.name || period.title;
      });

      // 格式化数据以匹配WXML期望的字段
      const targetUserId2 = this.data.userId;
      let targetNickname, targetAvatarUrl, targetUid;
      if (targetUserId2) {
        // 查看他人：从缓存取
        const cachedUser = app.globalData.targetUserForInsights || {};
        targetNickname = cachedUser.nickname || cachedUser.name || this.data.userName || '用户';
        targetAvatarUrl = cachedUser.avatarUrl || this.data.headerAvatarUrl || '';
        targetUid = targetUserId2;
      } else {
        // 查看自己
        targetNickname = currentUserId ? (app.globalData.userInfo?.nickname || app.globalData.userInfo?.name || '用户') : '用户';
        targetAvatarUrl = app.globalData.userInfo?.avatarUrl || '';
        targetUid = currentUserId;
      }
      const listAvatar = getUserAvatarDisplay(
        { avatarUrl: targetAvatarUrl, nickname: targetNickname },
        { userId: targetUid, displayName: targetNickname }
      );
      const formatted = filtered.map((item) => {
        let preview = richContentToPlainText(item.summary || '')
          .replace(/\s+/g, ' ')
          .trim();
        const isAccessible = item.isAccessible !== false;

        if (!preview && item.content) {
          const plainText = richContentToPlainText(item.content)
            .replace(/\s+/g, ' ')
            .trim();
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
          title:
            item.sectionId?.title || item.title || periodName || '小凡看见',
          preview: isAccessible
            ? preview || (item.imageUrl ? '点击查看图片反馈' : '暂无内容')
            : this.getLockedPreview(item.requestStatus || 'none'),
          mediaType: item.mediaType || 'text',
          imageUrl: isAccessible ? item.imageUrl || null : null,
          date: item.updatedAt || item.createdAt
            ? new Date(item.updatedAt || item.createdAt).toLocaleDateString('zh-CN')
            : '',
          periodId: item.periodId?._id || item.periodId || null,
          isAccessible,
          requestStatus:
            item.requestStatus || (isAccessible ? 'approved' : 'none'),
          requestStatusText: this.getRequestStatusText(
            item.requestStatus || 'none'
          ),
          lockedPlaceholder: this.getLockedPlaceholder(
            item.requestStatus || 'none'
          ),
          requestScope: item.requestScope || null,
          requestId: item.requestId || null,
          targetUserAvatarUrl: listAvatar.avatarUrl,
          targetUserAvatarText: listAvatar.avatarText,
          targetUserAvatarColor: listAvatar.avatarColor
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

  onShareAppMessage(event = {}) {
    const shareRequest = this.data.pendingShareRequest;
    const shareType = event?.target?.dataset?.shareType;

    if (shareRequest && (event.from === 'button' || shareType === 'insightRequest')) {
      const shareConfig = {
        title: shareRequest.shareTitle,
        path: shareRequest.sharePath,
        imageUrl: '/assets/images/share-insight.jpg'
      };

      this.closeRequestSharePrompt();
      return shareConfig;
    }

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
  async handleRequestInsight(
    periodId = null,
    insightId = null,
    insightMeta = {}
  ) {
    try {
      const response = await userService.createInsightRequest(
        this.data.userId,
        periodId,
        insightId
      );
      const requestId = response?._id || response?.id || null;
      this.updateInsightRequestState({
        insightId,
        periodId,
        requestStatus: 'pending',
        requestScope: insightId ? 'insight' : 'period',
        requestId
      });
      subscribeAutoTopUp
        .maybeAutoTopUpSubscriptions({
          sourceAction: 'insight_request_sent',
          sourcePage: 'insights',
          sceneKeys: ['insight_request_approved'],
          requestMode: 'prompt'
        })
        .catch((subscribeError) => {
          logger.warn('补充小凡看见通过提醒授权失败:', subscribeError);
        });
      wx.showToast({ title: '申请已发送', icon: 'success' });
      this.openRequestSharePrompt({
        requestId,
        insightId,
        periodId,
        insightMeta
      });
    } catch (error) {
      logger.error('发送申请失败:', error);
      wx.showToast({ title: '申请发送失败', icon: 'none' });
    }
  },

  buildRequestSharePath({ requestId, insightId = null, periodId = null }) {
    const query = [
      ['from', 'insightRequestShare'],
      ['focusRequestId', requestId],
      ['focusInsightId', insightId || ''],
      ['focusPeriodId', periodId || '']
    ]
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    return `/pages/profile/profile?${query}`;
  },

  openRequestSharePrompt({ requestId, insightId, periodId, insightMeta = {} }) {
    if (!requestId) {
      return;
    }

    const app = getApp();
    const fromUserName =
      app.globalData.userInfo?.nickname || app.globalData.userInfo?.name || '有人';
    const requestLabel = this.buildInsightRequestLabel(insightMeta);
    const toUserName = this.data.userName || '对方';

    this.setData({
      showRequestSharePrompt: true,
      pendingShareRequest: {
        requestId,
        insightId: insightId || null,
        periodId: periodId || null,
        requestLabel,
        toUserName,
        shareTitle: `${fromUserName} 想查看你的「${requestLabel}」`,
        sharePath: this.buildRequestSharePath({
          requestId,
          insightId,
          periodId
        })
      }
    });
  },

  closeRequestSharePrompt() {
    this.setData({
      showRequestSharePrompt: false,
      pendingShareRequest: null
    });
  },

  stopTap() {},

  /**
   * 点击 insight 项
   */
  handleInsightClick(e) {
    const {
      id,
      accessible,
      periodId,
      requestStatus,
      title,
      periodName,
      dayNumber
    } = e.currentTarget.dataset;
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

  handleLockedInsightClick(
    periodId,
    insightId,
    requestStatus = 'none',
    insightMeta = {}
  ) {
    const { userName } = this.data;
    const requestLabel = this.buildInsightRequestLabel(insightMeta);

    if (requestStatus === 'pending') {
      this.handleRequestInsight(
        periodId || null,
        insightId || null,
        insightMeta
      );
      return;
    }

    wx.showModal({
      title: '内容已锁定',
      content:
        requestStatus === 'rejected' || requestStatus === 'revoked'
          ? `「${requestLabel}」之前未获授权，是否向 ${userName} 重新发起查看申请？`
          : `「${requestLabel}」暂未授权，是否向 ${userName} 发起查看申请？`,
      confirmText: '发起申请',
      success: (res) => {
        if (res.confirm) {
          this.handleRequestInsight(
            periodId || null,
            insightId || null,
            insightMeta
          );
        }
      }
    });
  },

  updateInsightRequestState({
    insightId = null,
    periodId = null,
    requestStatus,
    requestScope,
    requestId
  }) {
    const nextInsights = this.data.insights.map((item) => {
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
