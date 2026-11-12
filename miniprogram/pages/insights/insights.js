const insightService = require('../../services/insight.service');
const { isInsightUnread } = require('../../utils/insight-unread');
const userService = require('../../services/user.service');
const enrollmentService = require('../../services/enrollment.service');
const activityService = require('../../services/activity.service');
const courseService = require('../../services/course.service');
const logger = require('../../utils/logger');
const { tenantStorage } = require('../../utils/storage');
const { richContentToPlainText } = require('../../utils/markdown');
const subscribeAutoTopUp = require('../../utils/subscribe-auto-topup');
const { getUserAvatarDisplay } = require('../../utils/avatar');
const { THEME_PRIMARY } = require('../../utils/theme');
const { formatShortLessonLabel } = require('../../utils/lesson');
const { getBrandName } = require('../../utils/brand');
const {
  hasPaidEnrollment,
  redirectAfterCommunityDenied
} = require('../../utils/period-access');
const { isAdminUser } = require('../../utils/auth');

function getTimeValue(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getInsightPeriodSortTime(insight) {
  const period = insight?.periodId || {};
  return getTimeValue(period.endDate || period.startDate);
}

function getInsightDaySortValue(insight) {
  const day = insight?.sectionId?.day ?? insight?.day ?? 0;
  return Number(day) || 0;
}

function compareInsightsByPeriodAndDayDesc(a, b) {
  const periodDiff = getInsightPeriodSortTime(b) - getInsightPeriodSortTime(a);
  if (periodDiff !== 0) return periodDiff;

  const dayDiff = getInsightDaySortValue(b) - getInsightDaySortValue(a);
  if (dayDiff !== 0) return dayDiff;

  return getTimeValue(b.updatedAt || b.createdAt) - getTimeValue(a.updatedAt || a.createdAt);
}

const { guardSocialPage } = require('../../utils/social-access');

// 这封信是不是写给我、而我还没打开过
function isUnreadForMe(item) {
  const user = (getApp().globalData && getApp().globalData.userInfo) || {};
  return isInsightUnread(item, user._id || user.id || '');
}

Page({
  data: {
    socialAccessGranted: false,
    insights: [],
    loading: true,
    insightsHasMore: false,
    insightsLoadingMore: false,
    insightsTotal: 0,
    activeTab: 'mine',
    otherInsights: [],
    otherInsightsLoaded: false,
    otherInsightsLoading: false,
    otherHasMore: false,
    otherLoadingMore: false,
    userId: null, // 目标用户ID（如果查看他人，此值为他人的ID）
    userName: '小凡看见', // 显示的标题
    isOtherUser: false, // 是否在查看他人的小凡看见
    isAdmin: false,
    lockedInsightCount: 0,
    unlockedInsightCount: 0,
    pendingRequestCount: 0,
    rejectedRequestCount: 0,
    headerEmoji: '🦁', // 头部emoji
    headerAvatarUrl: '',
    headerAvatarText: '用',
    headerAvatarColor: THEME_PRIMARY,
    themePrimaryColor: THEME_PRIMARY,
    headerTitle: '小凡看见', // 头部标题
    headerDesc: '按课程查看个性化反馈', // 头部描述
    showRequestSharePrompt: false,
    pendingShareRequest: null,
    searchKeyword: '',
    activeSearchKeyword: '',
    isSearchMode: false,
    searchLoading: false,
    searchResults: [],
    otherSearchResults: [],
    periodOptions: [{ id: '', name: '所有期次' }],
    selectedPeriodIndex: 0,
    selectedPeriodId: ''
  },

  onLoad(options) {
    if (!guardSocialPage(this)) return;
    // 检查是否是查看他人的小凡看见
    const targetUserId = options.userId;
    const initialTab = (!targetUserId && (options.tab === 'others' || options.tab === 'mine')) ? options.tab : 'mine';
    const targetUserName = options.userName
      ? decodeURIComponent(options.userName)
      : '小凡看见';

    const app = getApp();
    const currentUser = app.globalData.userInfo;
    this._insightsPage = 0;
    this._insightsLoadedPeriodId = '';
    this._insightsLoaded = false;
    this._otherAdminPage = 0;
    this._otherUserQueue = [];
    this._insightsRequestInFlight = false;

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
      isAdmin: isAdminUser(app.globalData.userInfo || {}),
      activeTab: initialTab,
      headerEmoji,
      headerAvatarUrl,
      headerAvatarText: initialHeaderAvatar.avatarText,
      headerAvatarColor: initialHeaderAvatar.avatarColor,
      headerTitle,
      headerDesc,
      selectedPeriodId: options.periodId || ''
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

    this.loadPeriodOptions();
    if (initialTab === 'mine') {
      this.loadInsights();
    }

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
    const titleHasLesson = /第[一二三四五六七八九十0-9]+[天课]/.test(title);

    if (periodName) {
      parts.push(periodName);
    }

    if (dayNumber !== null && dayNumber !== undefined && !titleHasLesson) {
      parts.push(formatShortLessonLabel(dayNumber));
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
    this.applyInsightFilters();
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });

    if (tab === 'others' && !this.data.otherInsightsLoaded && !this.data.otherInsightsLoading) {
      this.loadOtherInsights();
    } else {
      if (
        tab === 'mine' &&
        (!this._insightsLoaded ||
          this._insightsLoadedPeriodId !== String(this.data.selectedPeriodId || ''))
      ) {
        this.loadInsights();
      }
      this.applyInsightFilters();
    }
  },

  async loadPeriodOptions() {
    const app = getApp();
    let periods = app.globalData.periods || [];

    if (!periods.length) {
      try {
        const res = await courseService.getPeriods();
        periods = res.list || res.items || (Array.isArray(res) ? res : []);
        app.globalData.periods = periods;
      } catch (error) {
        logger.warn('加载小凡看见期次筛选失败:', error);
      }
    }

    const seenIds = new Set();
    const periodOptions = [{ id: '', name: '所有期次' }];
    periods.forEach((period) => {
      const id = period?._id || period?.id;
      if (!id || seenIds.has(String(id))) return;
      seenIds.add(String(id));
      periodOptions.push({
        id: String(id),
        name: period.name || period.title || '未命名期次'
      });
    });

    const selectedPeriodIndex = Math.max(
      0,
      periodOptions.findIndex(
        (option) => option.id === String(this.data.selectedPeriodId || '')
      )
    );
    const selectedPeriodId = periodOptions[selectedPeriodIndex]?.id || '';

    this.setData({ periodOptions, selectedPeriodIndex, selectedPeriodId });
    this.applyInsightFilters();
  },

  filterInsightList(insights = []) {
    const periodId = String(this.data.selectedPeriodId || '');
    const keyword = (this.data.activeSearchKeyword || '').trim().toLowerCase();

    return insights.filter((item) => {
      const matchesPeriod =
        !periodId || String(item.periodId || '') === periodId;
      if (!matchesPeriod) return false;
      if (!keyword) return true;

      return [item.title, item.courseTitle, item.preview]
        .some((value) => String(value || '').toLowerCase().includes(keyword));
    });
  },

  applyInsightFilters() {
    const hasActiveFilter = Boolean(
      this.data.selectedPeriodId || this.data.activeSearchKeyword
    );
    this.setData({
      searchResults: this.filterInsightList(this.data.insights),
      otherSearchResults: this.filterInsightList(this.data.otherInsights),
      isSearchMode: hasActiveFilter
    });
  },

  onPeriodChange(e) {
    const selectedPeriodIndex = Number(e.detail.value) || 0;
    const selectedPeriodId =
      this.data.periodOptions[selectedPeriodIndex]?.id || '';
    this.setData({ selectedPeriodIndex, selectedPeriodId });
    if (
      !this.data.isOtherUser &&
      this.data.activeTab === 'mine' &&
      this._insightsLoadedPeriodId !== String(selectedPeriodId || '')
    ) {
      this.loadInsights();
    }
    this.applyInsightFilters();
  },

  formatInsightList(rawList, overrideAvatar) {
    const app = getApp();
    const periods = app.globalData.periods || [];
    const periodMap = {};
    periods.forEach((p) => { periodMap[p._id] = p.name || p.title; });

    return rawList.map((item) => {
      let preview = (typeof richContentToPlainText === 'function' ? richContentToPlainText(item.summary || '') : (item.summary || '')).replace(/\s+/g, ' ').trim();
      const isAccessible = item.isAccessible !== false;

      if (!preview && item.content) {
        const plainText = (typeof richContentToPlainText === 'function' ? richContentToPlainText(item.content) : item.content).replace(/\s+/g, ' ').trim();
        preview = plainText.substring(0, 150) + (plainText.length > 150 ? '...' : '');
      }

      const periodName =
        item.periodId?.name ||
        item.periodId?.title ||
        periodMap[item.periodId?._id || item.periodId] ||
        '';

      let avatarDisplay;
      if (overrideAvatar) {
        avatarDisplay = overrideAvatar;
      } else {
        const currentUser = app.globalData.userInfo || {};
        const targetUserId = this.data.userId;
        const nickname = targetUserId
          ? (this.data.userName || '用户')
          : (currentUser.nickname || currentUser.name || '用户');
        const avatarUrl = targetUserId
          ? (this.data.headerAvatarUrl || '')
          : (currentUser.avatarUrl || '');
        const uid = targetUserId || currentUser._id || currentUser.id;
        avatarDisplay = getUserAvatarDisplay(
          { avatarUrl, nickname },
          { userId: uid, displayName: nickname }
        );
      }

      return {
        id: item._id || item.id,
        dayNumber: item.day ?? item.sectionId?.day ?? null,
        courseTitle: item.sectionId?.title || item.title || '学习反馈',
        periodName: periodName || '七个习惯晨读营',
        title: item.sectionId?.title || item.title || periodName || '小凡看见',
        preview: isAccessible
          ? preview || (item.imageUrl ? '点击查看图片反馈' : '内容还在路上')
          : this.getLockedPreview(item.requestStatus || 'none'),
        mediaType: item.mediaType || 'text',
        unread: isUnreadForMe(item),
        letterType: item.type === 'weekly' || item.type === 'monthly' ? item.type : '',
        imageUrl: isAccessible ? item.imageUrl || null : null,
        date: item.updatedAt || item.createdAt
          ? new Date(item.updatedAt || item.createdAt).toLocaleDateString('zh-CN')
          : '',
        periodId: item.periodId?._id || item.periodId || null,
        isAccessible,
        requestStatus: item.requestStatus || (isAccessible ? 'approved' : 'none'),
        requestStatusText: this.getRequestStatusText(item.requestStatus || 'none'),
        lockedPlaceholder: this.getLockedPlaceholder(item.requestStatus || 'none'),
        requestScope: item.requestScope || null,
        requestId: item.requestId || null,
        targetUserAvatarUrl: avatarDisplay.avatarUrl,
        targetUserAvatarText: avatarDisplay.avatarText,
        targetUserAvatarColor: avatarDisplay.avatarColor
      };
    });
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  onSearchClear() {
    this.setData({
      searchKeyword: '',
      activeSearchKeyword: ''
    });
    this.applyInsightFilters();
  },

  onSearchSubmit() {
    const keyword = (this.data.searchKeyword || '').trim();
    if (!keyword) {
      this.setData({
        activeSearchKeyword: ''
      });
      this.applyInsightFilters();
      return;
    }
    this.setData({ activeSearchKeyword: keyword });
    this.applyInsightFilters();
  },

  doSearch(keyword) {
    this.setData({ activeSearchKeyword: (keyword || '').trim() });
    this.applyInsightFilters();
  },

  _normalizeOtherAdminInsight(insight) {
    const populatedTarget =
      insight.targetUserId && typeof insight.targetUserId === 'object'
        ? insight.targetUserId
        : null;
    const populatedCreator =
      insight.userId && typeof insight.userId === 'object' ? insight.userId : null;
    const displayUser = populatedTarget || populatedCreator || {};
    return {
      ...insight,
      _targetUserId:
        displayUser._id || insight.targetUserId || insight.userId || null,
      _targetNickname: displayUser.nickname || displayUser.name || '用户',
      _targetAvatarUrl: displayUser.avatarUrl || displayUser.avatar || ''
    };
  },

  formatOtherRawItems(allRaw) {
    const app = getApp();
    const periods = app.globalData.periods || [];
    const periodMap = {};
    periods.forEach(p => { periodMap[p._id] = p.name || p.title; });

    return allRaw.map(item => {
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
        dayNumber: item.day ?? item.sectionId?.day ?? null,
        preview: preview || (item.imageUrl ? '点击查看图片反馈' : '内容还在路上'),
        mediaType: item.mediaType || 'text',
        unread: isUnreadForMe(item),
        letterType: item.type === 'weekly' || item.type === 'monthly' ? item.type : '',
        imageUrl: item.imageUrl || null,
        date: item.updatedAt || item.createdAt
          ? new Date(item.updatedAt || item.createdAt).toLocaleDateString('zh-CN')
          : '',
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
  },

  updateOtherInsightItems(newRawItems, reset = false) {
    const existingRaw = reset ? [] : this._otherRawInsights || [];
    const byId = new Map();
    [...existingRaw, ...newRawItems].forEach(item => {
      const id = String(item._id || item.id || '');
      if (id) byId.set(id, item);
    });
    this._otherRawInsights = [...byId.values()]
      .sort(compareInsightsByPeriodAndDayDesc);
    const formatted = this.formatOtherRawItems(this._otherRawInsights);
    this.setData({
      otherInsights: formatted,
      otherInsightsLoaded: true
    });
    this.applyInsightFilters();
  },

  async _fetchOtherAdminPage(page) {
    const res = await insightService.getMobileAdminInsights({ page, limit: 20 });
    const list = res.list || (Array.isArray(res) ? res : []);
    const pagination = res.pagination || {};
    const pages = Math.max(Number(pagination.pages) || 1, 1);
    return {
      items: list.map(item => this._normalizeOtherAdminInsight(item)),
      hasMore: page < pages
    };
  },

  async _prepareOtherUserQueue() {
    const sentRes = await insightService.getSentRequests({
      status: 'approved',
      limit: 100
    });
    const approvedRequests = sentRes.list || (Array.isArray(sentRes) ? sentRes : []);
    const userMap = new Map();
    approvedRequests.forEach(req => {
      const userObj = req.toUserId;
      const uid = (typeof userObj === 'object' ? userObj?._id : userObj) || null;
      if (uid && !userMap.has(String(uid))) userMap.set(String(uid), userObj);
    });
    this._otherUserQueue = [...userMap.entries()].map(([userId, userInfo]) => ({
      userId,
      userInfo,
      nextPage: 1,
      pages: 1
    }));
  },

  async _fetchOtherUserBatch(batchSize = 4) {
    const batch = this._otherUserQueue.slice(0, batchSize);
    const batches = await Promise.all(batch.map(async entry => {
      try {
        const res = await insightService.getUserInsightsList(entry.userId, {
          page: entry.nextPage,
          limit: 20
        });
        const pagination = res.pagination || {};
        entry.pages = Math.max(Number(pagination.pages) || 1, 1);
        entry.nextPage += 1;
        const list = (res.list || (Array.isArray(res) ? res : []))
          .filter(item => item.isAccessible !== false);
        const nickname = (typeof entry.userInfo === 'object'
          ? entry.userInfo?.nickname || entry.userInfo?.name
          : '') || '用户';
        const avatarUrl = (typeof entry.userInfo === 'object'
          ? entry.userInfo?.avatarUrl
          : '') || '';
        return list.map(insight => ({
          ...insight,
          _targetUserId: entry.userId,
          _targetNickname: nickname,
          _targetAvatarUrl: avatarUrl
        }));
      } catch (error) {
        logger.warn('加载单个用户的小凡看见失败:', {
          userId: entry.userId,
          error: error?.message || error
        });
        return [];
      }
    }));

    this._otherUserQueue = this._otherUserQueue.filter(
      entry => entry.nextPage <= entry.pages
    );
    return batches.flat();
  },

  async loadOtherInsights() {
    if (this.data.otherInsightsLoading) return;
    this.setData({ otherInsightsLoading: true, otherHasMore: false });
    try {
      let items = [];
      let hasMore = false;
      if (this.data.isAdmin) {
        this._otherAdminPage = 1;
        const result = await this._fetchOtherAdminPage(1);
        items = result.items;
        hasMore = result.hasMore;
      } else {
        await this._prepareOtherUserQueue();
        items = await this._fetchOtherUserBatch();
        hasMore = this._otherUserQueue.length > 0;
      }
      this.updateOtherInsightItems(items, true);
      this.setData({ otherHasMore: hasMore });
    } catch (err) {
      logger.error('加载他人洞见失败:', err);
    } finally {
      this.setData({ otherInsightsLoading: false });
    }
  },

  async loadMoreOtherInsights() {
    if (
      !this.data.otherHasMore ||
      this.data.otherInsightsLoading ||
      this.data.otherLoadingMore
    ) return;
    this.setData({ otherLoadingMore: true });
    try {
      let items = [];
      let hasMore = false;
      if (this.data.isAdmin) {
        const nextPage = this._otherAdminPage + 1;
        const result = await this._fetchOtherAdminPage(nextPage);
        this._otherAdminPage = nextPage;
        items = result.items;
        hasMore = result.hasMore;
      } else {
        items = await this._fetchOtherUserBatch();
        hasMore = this._otherUserQueue.length > 0;
      }
      this.updateOtherInsightItems(items, false);
      this.setData({ otherHasMore: hasMore && items.length > 0 });
    } catch (error) {
      logger.error('加载更多他人洞见失败:', error);
    } finally {
      this.setData({ otherLoadingMore: false });
    }
  },

  async loadInsights(options = {}) {
    try {
      const reset = options.reset !== false;
      if (this._insightsRequestInFlight || this.data.insightsLoadingMore) return;
      const page = reset ? 1 : Number(this._insightsPage || 0) + 1;
      this._insightsRequestInFlight = true;
      this.setData({
        loading: reset,
        insightsLoadingMore: !reset
      });

      // 获取当前登录用户信息
      const app = getApp();
      const currentUserId =
        app.globalData.userInfo?._id || app.globalData.userInfo?.id;
      const constants = require('../../config/constants');
      const token = tenantStorage.get(constants.STORAGE_KEYS.TOKEN);

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
          '/pages/index/index',
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
          page,
          limit: 20,
          ...(this.data.selectedPeriodId ? { periodId: this.data.selectedPeriodId } : {})
        });
        activityService.track('other_insight_view', {
          targetType: 'user',
          targetId: this.data.userId,
          metadata: { page: 'insights' }
        });
      } else {
        // 查看自己的小凡看见
        logger.debug('📖 加载自己的小凡看见...');
        res = await insightService.getInsightsList({
          page,
          limit: 20,
          ...(this.data.selectedPeriodId ? { periodId: this.data.selectedPeriodId } : {})
        });
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
          dayNumber: item.day ?? item.sectionId?.day ?? null,
          courseTitle: item.sectionId?.title || item.title || '学习反馈',
          periodName: periodName || '七个习惯晨读营',
          title:
            item.sectionId?.title || item.title || periodName || '小凡看见',
          preview: isAccessible
            ? preview || (item.imageUrl ? '点击查看图片反馈' : '内容还在路上')
            : this.getLockedPreview(item.requestStatus || 'none'),
          mediaType: item.mediaType || 'text',
        unread: isUnreadForMe(item),
        letterType: item.type === 'weekly' || item.type === 'monthly' ? item.type : '',
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

      const existingItems = reset ? [] : this.data.insights;
      const mergedById = new Map();
      [...existingItems, ...formatted].forEach(item => {
        if (item.id) mergedById.set(String(item.id), item);
      });
      const mergedInsights = [...mergedById.values()];
      const total = Number(res?.pagination?.total) || mergedInsights.length;
      this._insightsPage = page;
      this._insightsLoadedPeriodId = String(this.data.selectedPeriodId || '');
      this._insightsLoaded = true;

      this.updateInsightsSummary(mergedInsights);
      this.setData({
        loading: false,
        insightsLoadingMore: false,
        insightsHasMore: mergedInsights.length < total,
        insightsTotal: total
      });
    } catch (error) {
      logger.error('加载失败:', error);
      this.setData({ loading: false, insightsLoadingMore: false });
      wx.showToast({
        title: '没加载出来，稍后再试试',
        icon: 'none'
      });
    } finally {
      this._insightsRequestInFlight = false;
    }
  },

  async loadMoreInsights() {
    if (
      !this.data.insightsHasMore ||
      this.data.loading ||
      this.data.insightsLoadingMore
    ) return;
    await this.loadInsights({ reset: false });
  },

  onReachBottom() {
    if (this.data.activeTab === 'mine') {
      this.loadMoreInsights();
    } else {
      this.loadMoreOtherInsights();
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
        : `我的小凡看见 - ${getBrandName()}`,
      path: '/pages/index/index'
    };
  },

  onShareTimeline() {
    return {
      title: this.data.isOtherUser
        ? `${this.data.userName}的小凡看见`
        : `我的小凡看见 - ${getBrandName()}`
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
      await subscribeAutoTopUp
        .maybeAutoTopUpSubscriptions({
          sourceAction: 'insight_request_sent',
          sourcePage: 'insights',
          sceneKeys: ['insight_request_approved'],
          requestMode: 'prompt'
        })
        .catch((subscribeError) => {
          logger.warn('补充小凡看见通过提醒授权失败:', subscribeError);
        });

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
      wx.showToast({ title: '申请已发送', icon: 'success' });
      this.openRequestSharePrompt({
        requestId,
        insightId,
        periodId,
        insightMeta
      });
    } catch (error) {
      logger.error('发送申请失败:', error);
      wx.showToast({ title: '申请没发出去，再试一次', icon: 'none' });
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

    return `/pages/index/index?${query}`;
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

    // 点开就算读过了，回到列表时红点已经消掉
    if (canAccess && id) {
      const markRead = list => (list || []).map(item => (item.id === id && item.unread ? { ...item, unread: false } : item));
      this.setData({ insights: markRead(this.data.insights), searchResults: markRead(this.data.searchResults) });
    }

    if (!canAccess && !this.data.isAdmin) {
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
    const kw = this.data.isSearchMode ? (this.data.activeSearchKeyword || '') : '';
    const kwParam = kw ? `&keyword=${encodeURIComponent(kw)}` : '';
    wx.navigateTo({
      url: `/pages/insight-detail/insight-detail?id=${id}${kwParam}`
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
