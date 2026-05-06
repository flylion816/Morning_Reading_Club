// 个人中心页面
const userService = require('../../services/user.service');
const authService = require('../../services/auth.service');
const courseService = require('../../services/course.service');
const enrollmentService = require('../../services/enrollment.service');
const checkinService = require('../../services/checkin.service');
const notificationServiceModule = require('../../services/notification.service');
const activityService = require('../../services/activity.service');
const constants = require('../../config/constants');
const { formatNumber, formatDate } = require('../../utils/formatters');
const { richContentToPlainText } = require('../../utils/markdown');
const { getPeriodAccess, hasPaidEnrollment } = require('../../utils/period-access');

const notificationService =
  notificationServiceModule.default || notificationServiceModule;

function formatRelativeTime(dateString) {
  if (!dateString) return '刚刚';

  const createdTime = new Date(dateString).getTime();
  const now = Date.now();
  const diffMs = now - createdTime;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return new Date(dateString).toLocaleDateString('zh-CN');
}

function buildInsightRequestDisplay(item) {
  const fromUser = item.fromUserId || {};
  const periodName =
    item.requestPeriodName ||
    item.periodId?.name ||
    item.periodId?.title ||
    '未知期次';
  const insightTitle =
    item.requestInsightTitle ||
    item.insightId?.sectionId?.title ||
    item.insightId?.title ||
    '学习反馈';
  const insightDay =
    item.requestInsightDay ||
    item.insightId?.day ||
    item.insightId?.sectionId?.day ||
    null;
  const titleHasDay = /第[一二三四五六七八九十0-9]+天/.test(insightTitle);
  const dayText = insightDay && !titleHasDay ? `第${insightDay}天` : '';
  const metaParts = [periodName];
  if (dayText) metaParts.push(dayText);
  if (insightTitle) metaParts.push(insightTitle);

  const statusMap = {
    pending: { text: '待处理', className: 'pending' },
    approved: { text: '已同意', className: 'approved' },
    rejected: { text: '已拒绝', className: 'rejected' },
    revoked: { text: '已撤销', className: 'revoked' }
  };
  const statusInfo = statusMap[item.status] || statusMap.pending;

  return {
    id: item._id || item.id,
    _id: item._id || item.id,
    fromUserId: fromUser._id || fromUser.id || item.fromUserId || null,
    fromUserName: fromUser.nickname || fromUser.name || '用户',
    fromUserAvatar: fromUser.avatar || fromUser.nickname?.charAt(0) || '😊',
    avatarColor: fromUser.avatarColor || '#4a90e2',
    toUserId: item.toUserId,
    time: formatRelativeTime(item.createdAt),
    status: item.status,
    statusText: statusInfo.text,
    statusClass: statusInfo.className,
    createdAt: item.createdAt,
    periodId: item.periodId?._id || item.periodId || null,
    insightId: item.insightId?._id || item.insightId || null,
    requestPeriodName: periodName,
    requestInsightTitle: insightTitle,
    requestInsightDay: insightDay,
    requestDayText: dayText,
    requestMeta: metaParts.join(' · '),
    requestSummary: dayText ? `${periodName} · ${dayText}` : periodName,
    canApprove: item.status === 'pending',
    canReject: item.status === 'pending'
  };
}

function formatRecentCheckinDate(dateString) {
  if (!dateString) {
    return '';
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}.${day}`;
}

function buildRecentCheckinCard(item) {
  const previewSource = richContentToPlainText(item.note || item.content || '')
    .replace(/\s+/g, ' ')
    .trim();
  const preview = previewSource || '这篇打卡还没有填写正文';
  const periodInfo =
    item.periodId && typeof item.periodId === 'object' ? item.periodId : {};
  const sectionInfo =
    item.sectionId && typeof item.sectionId === 'object' ? item.sectionId : {};

  return {
    id: item._id || item.id,
    sectionId: sectionInfo._id || sectionInfo.id || item.sectionId || '',
    periodId: periodInfo._id || periodInfo.id || item.periodId || '',
    periodTitle: periodInfo.title || periodInfo.name || '我的打卡',
    sectionTitle: sectionInfo.title || '打卡日记',
    preview,
    likeCount: item.likeCount || 0,
    dayLabel: sectionInfo.day ? `第${sectionInfo.day}天` : '',
    dateLabel: formatRecentCheckinDate(item.checkinDate || item.createdAt),
    icon: periodInfo.coverEmoji || periodInfo.icon || '📘',
    color: periodInfo.coverColor || periodInfo.color || '#4a90e2'
  };
}

Page({
  data: {
    // 用户信息
    userInfo: null,
    isLogin: false,
    hasValidSignature: false,

    // 当前期次
    currentPeriod: null,
    currentPeriodPaymentStatus: null,
    canAccessCurrentPeriodCommunity: false,
    currentPeriodCommunityState: 'locked',
    canUsePaidFeatures: false,

    // 今日课节
    todaySection: null,

    // 统计信息
    stats: {
      current_day: 1,
      total_days: 23
    },

    // 最近的小凡看见（最多3条）
    recentInsights: [],

    // 最近的打卡日记（最多3条）
    recentCheckins: [],

    // 收到的小凡看见请求列表
    insightRequests: [],
    allInsightRequests: [],
    insightRequestTotal: 0,
    unreadNotificationCount: 0,

    // 腾讯会议
    hasMeeting: false,
    meetingId: '',
    meetingJoinUrl: '',

    // 加载状态
    loading: true,

    // 编辑个人信息相关
    showEditProfile: false,
    isSavingProfile: false,
    avatarOptions: [
      '🦁',
      '🐯',
      '🐻',
      '🐼',
      '🐨',
      '🦊',
      '🦝',
      '🐶',
      '🐱',
      '🦌',
      '🦅',
      '⭐'
    ],
    editForm: {
      avatar: '🦁',
      nickname: '',
      signature: ''
    }
  },

  onLoad(options) {
    console.log('🟢🟢🟢 PROFILE.JS ONLOAD CALLED 🟢🟢🟢', options);
    console.log('个人中心加载', options);
  },

  onShow() {
    console.log('🟢🟢🟢 PROFILE.JS ONSHOW CALLED 🟢🟢🟢');
    this.checkLoginStatus({ refreshUserData: true });
  },

  onPullDownRefresh() {
    console.log('下拉刷新');
    this.loadUserData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus(options = {}) {
    const { refreshUserData = false } = options;
    const app = getApp();
    const token = wx.getStorageSync(constants.STORAGE_KEYS.TOKEN);
    const storedUserInfo = token
      ? wx.getStorageSync(constants.STORAGE_KEYS.USER_INFO)
      : null;
    const isLogin = !!(token && storedUserInfo);
    const userInfo = isLogin ? storedUserInfo : null;
    const hasValidSignature = !!(
      userInfo && this.isValidSignature(userInfo.signature)
    );

    if (isLogin) {
      console.log('🔄 onShow: 更新 globalData');
      app.globalData.isLogin = true;
      app.globalData.userInfo = userInfo;
      app.globalData.token = token;
    } else {
      console.log('⚠️ onShow: 未登录，显示访客视图');
      app.globalData.isLogin = false;
      app.globalData.userInfo = null;
      app.globalData.token = null;
    }

    const nextData = {
      isLogin,
      userInfo,
      hasValidSignature,
      loading: isLogin ? !!refreshUserData : false
    };

    if (!isLogin) {
      Object.assign(nextData, {
        currentPeriod: null,
        currentPeriodPaymentStatus: null,
        canAccessCurrentPeriodCommunity: false,
        currentPeriodCommunityState: 'locked',
        canUsePaidFeatures: false,
        todaySection: null,
        recentCheckins: [],
        recentInsights: [],
        insightRequests: [],
        allInsightRequests: [],
        insightRequestTotal: 0,
        unreadNotificationCount: 0,
        hasMeeting: false,
        meetingId: '',
        meetingJoinUrl: ''
      });
    }

    this.setData(nextData, () => {
      this.updateTabBarVisibility(isLogin);

      if (isLogin && refreshUserData) {
        this.loadUserData(true);
        this.loadUnreadNotificationCount();
      }
    });
  },

  /**
   * 更新tabBar显示状态
   * 始终显示tabBar，让用户可以浏览其他页面（符合微信审核规范）
   */
  updateTabBarVisibility(isLogin) {
    wx.showTabBar();
  },

  /**
   * 加载用户数据
   */
  async loadUserData(forceLoggedIn = false) {
    if (!(forceLoggedIn || this.data.isLogin)) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });

    try {
      // ── Wave 1: 所有独立请求并行 ──────────────────────────────
      const [userInfo, stats, periods, userEnrollments, taskRes] =
        await Promise.all([
          userService.getUserProfile(),
          userService.getUserStats(),
          courseService.getPeriods(),
          enrollmentService
            .getUserEnrollments({ limit: 100 })
            .catch(() => ({ list: [] })),
          courseService.getTodayTask().catch(() => null)
        ]);

      const app = getApp();
      app.globalData.userInfo = userInfo;

      // 计算当前期次
      const periodsList = periods.list || periods.items || periods || [];
      const enrollmentList = userEnrollments.list || userEnrollments || [];
      const enrolledPeriodIds = enrollmentList
        .filter((e) => e.status === 'active' || e.status === 'completed')
        .map((e) => e.periodId?._id || e.periodId);
      const enrolledPeriods = periodsList.filter((p) =>
        enrolledPeriodIds.includes(p._id)
      );

      let currentPeriod = null;
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      for (const period of enrolledPeriods) {
        const startDate = new Date(period.startDate || period.startTime || 0);
        const endDate = new Date(period.endDate || period.endTime || 0);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        if (todayDate >= startDate && todayDate <= endDate) {
          currentPeriod = period;
          break;
        }
      }
      if (!currentPeriod)
        currentPeriod =
          enrolledPeriods.find((p) => p.status === 'ongoing') || null;
      if (!currentPeriod && enrolledPeriods.length > 0) {
        currentPeriod = [...enrolledPeriods].sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        )[0];
      }

      const hasValidTask = !!(taskRes && taskRes.sectionId);

      // taskRes 返回了 periodId，优先用它来确定当前期次
      if (hasValidTask && taskRes.periodId && periodsList.length > 0) {
        const foundPeriod = periodsList.find(
          (p) => p._id === taskRes.periodId || p.id === taskRes.periodId
        );
        if (foundPeriod) currentPeriod = foundPeriod;
      }

      const currentPeriodId = currentPeriod?._id || currentPeriod?.id || null;

      // ── Wave 2: 依赖 Wave1 的两个请求并行 ──────────────────────
      const [sectionRes, currentPeriodAccess] = await Promise.all([
        hasValidTask
          ? courseService.getSectionDetail(taskRes.sectionId)
          : Promise.resolve(null),
        currentPeriodId
          ? getPeriodAccess(currentPeriodId, {
              enrollmentList,
              skipRequest: true
            })
          : Promise.resolve({
              canAccessCommunity: false,
              communityAccessState: 'locked',
              paymentStatus: null
            })
      ]);

      // 构建 todaySection（只保留展示需要的字段，避免传输全课节内容）
      let todaySection = null;
      const d = new Date();
      const displayDate = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} 全天`;

      if (hasValidTask && sectionRes) {
        todaySection = {
          _id: sectionRes._id || taskRes.sectionId,
          id: sectionRes.id || taskRes.sectionId,
          day: taskRes.day,
          title: sectionRes.title,
          periodId: taskRes.periodId,
          periodTitle: taskRes.periodTitle,
          checkinCount: taskRes.checkinCount || 0,
          checkinUsers: (taskRes.checkinUsers || []).slice(0, 3),
          isCheckedIn: !!(taskRes.isCheckedIn || sectionRes.isCheckedIn),
          progress: taskRes.isCheckedIn || sectionRes.isCheckedIn ? 100 : 0,
          coverColor:
            sectionRes.coverColor || currentPeriod?.coverColor || '#4a90e2',
          coverEmoji:
            sectionRes.coverEmoji || currentPeriod?.coverEmoji || '🏔️',
          subtitleDisplay: (sectionRes.subtitle || '').replace(/至$/, ''),
          displayDate
        };
      } else if (!hasValidTask && currentPeriodId) {
        // 降级方案：从期次课节列表取第一个未打卡课节
        try {
          const sectionsRes =
            await courseService.getPeriodSections(currentPeriodId);
          const sections =
            sectionsRes.list || sectionsRes.items || sectionsRes || [];
          const section =
            sections.filter((s) => s.day > 0).find((s) => !s.isCheckedIn) ||
            sections.filter((s) => s.day > 0)[0];
          if (section) {
            todaySection = {
              _id: section._id,
              id: section.id,
              day: section.day,
              title: section.title,
              periodId: currentPeriodId,
              periodTitle: currentPeriod?.title,
              checkinCount: section.checkinCount || 0,
              checkinUsers: [],
              isCheckedIn: !!section.isCheckedIn,
              progress: section.isCheckedIn ? 100 : 0,
              coverColor: currentPeriod?.coverColor || '#4a90e2',
              coverEmoji: currentPeriod?.coverEmoji || '🏔️',
              subtitleDisplay: (section.subtitle || '').replace(/至$/, ''),
              displayDate
            };
          }
        } catch (e) {
          console.error('降级获取课节失败:', e);
        }
      }

      const communityEnabled = currentPeriodAccess.canAccessCommunity === true;
      const paidFeatureAccessEnabled =
        communityEnabled || hasPaidEnrollment(enrollmentList);

      // ── Wave 3: 社区数据并行加载 ────────────────────────────────
      const [recentCheckins, recentInsights, allInsightRequests] =
        paidFeatureAccessEnabled
          ? await Promise.all([
              this.loadRecentCheckins().catch(() => []),
              this.loadRecentInsights(currentPeriod).catch(() => []),
              this.loadInsightRequests(false).catch(() => [])
            ])
          : [[], [], []];

      // 只存展示字段，避免 setData 传输整个 period 对象
      const currentPeriodDisplay = currentPeriod
        ? {
            _id: currentPeriod._id,
            id: currentPeriod.id,
            name: currentPeriod.name,
            title: currentPeriod.title,
            coverColor: currentPeriod.coverColor,
            coverEmoji: currentPeriod.coverEmoji,
            status: currentPeriod.status,
            meetingId: currentPeriod.meetingId || '',
            meetingJoinUrl: currentPeriod.meetingJoinUrl || ''
          }
        : null;

      this.setData({
        userInfo,
        hasValidSignature: !!this.isValidSignature(
          userInfo && userInfo.signature
        ),
        userStats: stats,
        currentPeriod: currentPeriodDisplay,
        currentPeriodPaymentStatus: currentPeriodAccess.paymentStatus || null,
        canAccessCurrentPeriodCommunity: communityEnabled,
        currentPeriodCommunityState:
          currentPeriodAccess.communityAccessState || 'locked',
        canUsePaidFeatures: paidFeatureAccessEnabled,
        todaySection: todaySection || null,
        recentCheckins,
        recentInsights,
        allInsightRequests,
        insightRequests: allInsightRequests.slice(0, 3),
        insightRequestTotal: allInsightRequests.length,
        hasMeeting: !!(
          currentPeriod &&
          (currentPeriod.meetingId || currentPeriod.meetingJoinUrl)
        ),
        meetingId: currentPeriod?.meetingId || '',
        meetingJoinUrl: currentPeriod?.meetingJoinUrl || '',
        loading: false
      });
    } catch (error) {
      console.error('加载用户数据失败:', error);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败,请重试', icon: 'none' });
    }
  },

  async loadRecentCheckins() {
    try {
      const res = await checkinService.getUserCheckinsWithStats({
        page: 1,
        limit: 6
      });

      const list = Array.isArray(res?.list)
        ? res.list
        : Array.isArray(res)
          ? res
          : [];
      return list
        .filter((item) => {
          const text = richContentToPlainText(
            item.note || item.content || ''
          ).trim();
          return text.length > 0;
        })
        .slice(0, 3)
        .map(buildRecentCheckinCard);
    } catch (error) {
      console.error('加载最近打卡失败:', error);
      return [];
    }
  },

  /**
   * 加载最近的小凡看见记录
   * 改为加载所有小凡看见（不限期次），然后只取最新的2条
   * 这样可以保证即使当前期次判断有误，也能显示用户的最新小凡看见
   */
  async loadRecentInsights(currentPeriod) {
    try {
      const insightService = require('../../services/insight.service');

      const res = await insightService.getInsightsList({ limit: 10 });

      // request.js 会自动提取 data.data，所以这里 res 应该是 { list: [...], pagination: {...} }
      let insights = [];
      if (res && res.list) {
        // 标准格式
        insights = res.list;
      } else if (Array.isArray(res)) {
        // 直接是数组
        insights = res;
      }

      if (!insights || insights.length === 0) {
        return [];
      }

      // 按创建时间倒序排列（最新的在前）
      insights.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      // 格式化数据
      const { getInsightTypeConfig } = require('../../utils/formatters');
      const formatted = insights.map((item) => {
        // 提取preview：和insights.js保持一致逻辑
        let preview = richContentToPlainText(item.summary || '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!preview && item.content) {
          const plainText = richContentToPlainText(item.content)
            .replace(/\s+/g, ' ')
            .trim();
          // 直接取前150个字符
          preview = plainText.substring(0, 150);
          if (plainText.length > 150) {
            preview += '...';
          }
        }

        // 获取类型配置
        const typeConfig = getInsightTypeConfig(item.type);

        return {
          id: item._id || item.id,
          day: `第${item.day}天`,
          title: item.sectionId?.title || '学习反馈',
          courseTitle: item.sectionId?.title || item.title || '学习反馈',
          preview: preview || (item.imageUrl ? '点击查看图片反馈' : '暂无内容'),
          mediaType: item.mediaType || 'text',
          imageUrl: item.imageUrl || null,
          periodId: item.periodId,
          type: item.type,
          typeConfig: typeConfig
        };
      });

      return formatted.slice(0, 2);
    } catch (error) {
      console.error('加载小凡看见失败:', error);
      return [];
    }
  },

  /**
   * 加载收到的小凡看见请求
   */
  async loadInsightRequests(updatePage = true) {
    try {
      const insightService = require('../../services/insight.service');
      const app = getApp();
      const currentUser = app.globalData.userInfo;

      if (!currentUser || !currentUser._id) {
        console.warn('用户未登录，无法加载小凡看见请求');
        if (updatePage) {
          this.setData({
            insightRequests: [],
            allInsightRequests: [],
            insightRequestTotal: 0
          });
        }
        return [];
      }

      const res = await insightService.getReceivedRequests();

      let receivedRequests = [];
      if (Array.isArray(res)) {
        receivedRequests = res;
      } else if (res && Array.isArray(res.data)) {
        receivedRequests = res.data;
      } else if (res && Array.isArray(res.list)) {
        receivedRequests = res.list;
      }

      const formatted = receivedRequests.map(buildInsightRequestDisplay);

      if (updatePage) {
        this.setData({
          allInsightRequests: formatted,
          insightRequests: formatted.slice(0, 3),
          insightRequestTotal: formatted.length
        });
      }

      return formatted;
    } catch (error) {
      console.error('加载小凡看见请求失败:', error);
      if (updatePage) {
        this.setData({
          insightRequests: [],
          allInsightRequests: [],
          insightRequestTotal: 0
        });
      }
      return [];
    }
  },

  ensureCurrentPeriodCommunityAccess(title = '完成支付后可查看') {
    if (this.data.currentPeriodCommunityState === 'enabled') {
      return true;
    }

    wx.showToast({
      title,
      icon: 'none'
    });
    return false;
  },

  ensurePaidFeatureAccess(title = '完成支付后可查看') {
    if (this.data.canUsePaidFeatures) {
      return true;
    }

    wx.showToast({
      title,
      icon: 'none'
    });
    return false;
  },

  /**
   * 微信一键登录
   */
  async handleWechatLogin() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      console.log('开始获取用户信息...');

      // 1. 必须在点击事件中同步调用getUserProfile
      const userInfo = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善会员资料',
          success: (res) => {
            console.log('获取用户信息成功:', res.userInfo);
            resolve(res.userInfo);
          },
          fail: (err) => {
            console.error('获取用户信息失败:', err);
            reject(err);
          }
        });
      });

      console.log('用户信息获取完成，开始登录...');

      // 2. 使用Mock登录（因为没有后端服务器）
      const envConfig = require('../../config/env');
      let loginData;

      if (envConfig.useMock) {
        // Mock模式
        loginData = await authService.wechatLoginMock(userInfo);
      } else {
        // 生产模式
        loginData = await authService.wechatLogin(userInfo);
      }

      console.log('登录成功:', loginData);

      // 3. 更新全局状态
      const app = getApp();
      app.globalData.isLogin = true;
      app.globalData.userInfo = loginData.user;
      app.globalData.token = loginData.access_token;

      // 4. 更新页面状态
      this.setData({
        isLogin: true,
        userInfo: loginData.user,
        loading: false
      });

      // 5. 显示tabBar
      this.updateTabBarVisibility(true);

      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 2000
      });

      // 6. 加载用户数据
      this.loadUserData();
    } catch (error) {
      console.error('登录失败:', error);

      this.setData({ loading: false });

      // 处理用户拒绝授权的情况
      if (
        error.errMsg &&
        error.errMsg.includes('getUserProfile:fail auth deny')
      ) {
        wx.showToast({
          title: '您拒绝了授权',
          icon: 'none',
          duration: 2000
        });
      } else {
        wx.showToast({
          title: '登录失败,请重试',
          icon: 'none',
          duration: 2000
        });
      }
    }
  },

  /**
   * 跳转到登录页（包含隐私协议）
   */
  goToLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  /**
   * 返回首页
   */
  handleBackHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  /**
   * 点击头像
   */
  handleAvatarClick() {
    if (!this.data.isLogin) {
      this.handleLogin();
      return;
    }

    // 跳转到编辑资料页面
    wx.navigateTo({
      url: '/pages/edit-profile/edit-profile'
    });
  },

  /**
   * 授权请求 - 同意查看小凡看见
   */
  handleApproveRequest(e) {
    if (!this.ensurePaidFeatureAccess('完成支付后可处理申请')) {
      return;
    }
    const { request } = e.currentTarget.dataset;
    this.approveRequest(request);
  },

  /**
   * 拒绝请求
   */
  handleRejectRequest(e) {
    if (!this.ensurePaidFeatureAccess('完成支付后可处理申请')) {
      return;
    }
    const { request } = e.currentTarget.dataset;
    this.rejectRequest(request);
  },

  /**
   * 点击请求记录 - 跳转到他人主页
   */
  handleInsightRequestTap(e) {
    if (!this.ensurePaidFeatureAccess('完成支付后可查看请求')) {
      return;
    }
    const { request } = e.currentTarget.dataset;
    const userId = request?.fromUserId;
    const periodId = request?.periodId;

    if (!userId) {
      console.warn('请求记录缺少发起用户ID，无法跳转');
      return;
    }

    let url = `/pages/profile-others/profile-others?userId=${userId}`;
    if (periodId) {
      url += `&periodId=${periodId}`;
    }

    wx.navigateTo({ url });
  },

  /**
   * 批准请求
   */
  async approveRequest(request) {
    if (!this.ensurePaidFeatureAccess('完成支付后可处理申请')) {
      return;
    }
    try {
      console.log('📨 批准请求:', request);

      const insightService = require('../../services/insight.service');
      const app = getApp();

      const requestId = request._id || request.id;

      // 调用后端API批准申请
      await insightService.approveRequest(requestId, {
        periodId: request.periodId || ''
      });
      activityService.track('insight_request_approve', {
        targetType: 'insight_request',
        targetId: requestId,
        periodId: request.periodId || null,
        metadata: {
          fromUserId: request.fromUserId || null
        }
      });

      console.log('✅ 申请已批准');
      this.updateInsightRequestStatus(requestId, 'approved');

      wx.showToast({
        title: '已批准申请',
        icon: 'success'
      });
    } catch (error) {
      console.error('❌ 批准申请失败:', error);
      wx.showToast({
        title: '批准失败',
        icon: 'none'
      });
    }
  },

  /**
   * 拒绝请求
   */
  async rejectRequest(request) {
    if (!this.ensurePaidFeatureAccess('完成支付后可处理申请')) {
      return;
    }
    try {
      console.log('📨 拒绝请求:', request);

      const insightService = require('../../services/insight.service');
      const requestId = request._id || request.id;

      // 调用后端API拒绝申请
      await insightService.rejectRequest(requestId, {
        reason: '暂不同意'
      });

      console.log('✅ 申请已拒绝');
      this.updateInsightRequestStatus(requestId, 'rejected');

      wx.showToast({
        title: '已拒绝申请',
        icon: 'success'
      });
    } catch (error) {
      console.error('❌ 拒绝申请失败:', error);
      wx.showToast({
        title: '拒绝失败',
        icon: 'none'
      });
    }
  },

  updateInsightRequestStatus(requestId, nextStatus) {
    const statusMap = {
      approved: { text: '已同意', className: 'approved' },
      rejected: { text: '已拒绝', className: 'rejected' }
    };
    const statusInfo = statusMap[nextStatus];
    if (!statusInfo) return;

    const updatedAll = (this.data.allInsightRequests || []).map((item) =>
      (item._id || item.id) === requestId
        ? {
            ...item,
            status: nextStatus,
            statusText: statusInfo.text,
            statusClass: statusInfo.className,
            canApprove: false,
            canReject: false
          }
        : item
    );

    this.setData({
      allInsightRequests: updatedAll,
      insightRequests: updatedAll.slice(0, 3)
    });
  },

  navigateToInsightRequests() {
    if (!this.ensurePaidFeatureAccess('完成支付后可查看请求')) {
      return;
    }
    wx.navigateTo({
      url: '/pages/insight-requests/insight-requests'
    });
  },

  /**
   * 点击今日课节卡片
   */
  handleTodaySectionClick() {
    console.log('🚨🚨🚨 handleTodaySectionClick 被触发 🚨🚨🚨');

    const { todaySection } = this.data;
    const sectionId = todaySection && (todaySection.id || todaySection._id);

    if (!sectionId) {
      console.error('今日课节信息不存在');
      wx.showToast({
        title: '课节信息不存在',
        icon: 'none'
      });
      return;
    }

    // 跳转到课程详情页
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${sectionId}`
    });
  },

  handleRecentCheckinTap(e) {
    if (!this.ensurePaidFeatureAccess('完成支付后可查看打卡日记')) {
      return;
    }

    const { checkinId, sectionId, periodId } = e.currentTarget.dataset || {};
    if (!checkinId) {
      wx.showToast({
        title: '打卡记录不存在',
        icon: 'none'
      });
      return;
    }

    return this.openCheckinDetail(checkinId, sectionId, periodId);
  },

  async loadUnreadNotificationCount() {
    if (!this.data.isLogin) {
      this.setData({ unreadNotificationCount: 0 });
      return;
    }

    try {
      const unreadResponse = await notificationService.getUnreadCount();
      this.setData({
        unreadNotificationCount: unreadResponse?.unreadCount || 0
      });
    } catch (error) {
      console.error('加载首页通知未读数失败:', error);
    }
  },

  navigateToNotifications() {
    wx.navigateTo({
      url: '/pages/notifications/notifications'
    });
  },

  async openCheckinDetail(checkinId, sectionId = '', periodId = '') {
    let targetSectionId = sectionId;
    let targetPeriodId = periodId;

    try {
      if (!targetSectionId) {
        wx.showLoading({
          title: '正在打开...',
          mask: true
        });

        const detail = await checkinService.getCheckinDetail(checkinId);
        targetSectionId = detail?.sectionId?._id || detail?.sectionId || '';
        targetPeriodId = detail?.periodId?._id || detail?.periodId || targetPeriodId;
      }

      if (!targetSectionId) {
        throw new Error('sectionId missing');
      }

      wx.navigateTo({
        url:
          `/pages/course-detail/course-detail?id=${targetSectionId}&checkinId=${checkinId}` +
          (targetPeriodId ? `&periodId=${targetPeriodId}` : '')
      });
    } catch (error) {
      console.error('打开打卡详情失败:', error);
      wx.showToast({
        title: '打开详情失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading?.();
    }
  },

  navigateToCheckinRecords() {
    if (!this.ensurePaidFeatureAccess('完成支付后可查看打卡日记')) {
      return;
    }

    wx.navigateTo({
      url: '/pages/checkin-records/checkin-records'
    });
  },

  /**
   * 点击小凡看见条目
   */
  handleInsightClick(e) {
    if (!this.ensurePaidFeatureAccess('完成支付后可查看反馈')) {
      return;
    }
    console.log('🚨🚨🚨 handleInsightClick 被触发 🚨🚨🚨');
    console.log('Event:', e);

    const { id } = e.currentTarget.dataset;
    console.log('Insight ID:', id);

    if (!id) {
      console.error('❌ ID不存在');
      return;
    }

    // 暂时添加Toast以确认函数被调用
    wx.showToast({
      title: '正在跳转详情...',
      icon: 'none'
    });

    const url = `/pages/insight-detail/insight-detail?id=${id}`;
    console.log('🚀 准备跳转:', url);

    wx.navigateTo({
      url: url,
      success: () => console.log('✅ 跳转成功'),
      fail: (err) => console.error('❌ 跳转失败:', err)
    });
  },

  /**
   * 跳转到小凡看见列表
   */
  navigateToInsights() {
    if (!this.ensurePaidFeatureAccess('完成支付后可查看反馈')) {
      return;
    }
    console.log('🚨🚨🚨 navigateToInsights 被触发 🚨🚨🚨');

    wx.showToast({
      title: '正在跳转列表...',
      icon: 'none'
    });

    const url = '/pages/insights/insights';
    console.log('🚀 准备跳转:', url);

    wx.navigateTo({
      url: url,
      success: () => console.log('✅ 跳转成功'),
      fail: (err) => console.error('❌ 跳转失败:', err)
    });
  },

  /**
   * 去打卡 - 跳转到打卡页面（或显示已打卡提示）
   */
  handleCreateCheckin() {
    console.log('⚠️⚠️⚠️ handleCreateCheckin 被触发! ⚠️⚠️⚠️');

    const { currentPeriod, todaySection, currentPeriodCommunityState } =
      this.data;

    if (!currentPeriod || !todaySection) {
      wx.showToast({
        title: '无法获取课程信息',
        icon: 'none'
      });
      return;
    }

    if (currentPeriodCommunityState !== 'enabled') {
      this.handleTodaySectionClick();
      return;
    }

    // 检查是否已经打卡
    if (todaySection.isCheckedIn) {
      wx.showToast({
        title: '今天已打卡，继续加油！',
        icon: 'success'
      });
      return;
    }

    const periodId = currentPeriod._id || currentPeriod.id;
    const sectionId = todaySection._id || todaySection.id;

    wx.navigateTo({
      url: `/pages/checkin/checkin?periodId=${periodId}&sectionId=${sectionId}`
    });
  },

  /**
   * 去晨读
   * 桌面端给出浏览器打开指引
   * 手机端优先走腾讯会议小程序
   */
  handleJoinMeeting() {
    const meetingId = this.data.meetingId;
    const meetingJoinUrl = this.normalizeMeetingJoinUrl(
      this.data.meetingJoinUrl
    );
    const desktopLikePlatform = this.isDesktopLikePlatform();
    activityService.track('meeting_enter', {
      targetType: 'meeting',
      periodId:
        this.data.currentPeriod?._id || this.data.currentPeriod?.id || null,
      metadata: {
        meetingId: meetingId || null,
        hasJoinUrl: !!meetingJoinUrl
      }
    });

    if (!meetingId && !meetingJoinUrl) {
      wx.showToast({ title: '会议号未配置', icon: 'none' });
      return;
    }

    if (meetingJoinUrl) {
      if (desktopLikePlatform) {
        this.showInviteLinkGuide(meetingJoinUrl);
        return;
      }

      this.showMeetingLaunchOptions({
        meetingId,
        meetingJoinUrl
      });
      return;
    }

    if (desktopLikePlatform) {
      this.promptManualMeetingJoin(
        meetingId,
        '当前期次还没有配置腾讯会议邀请链接，暂时无法直接拉起桌面客户端。'
      );
      return;
    }

    this.openMeetingMiniProgram(meetingId);
  },

  getCurrentPlatform() {
    const app = getApp();
    const platform =
      app?.globalData?.platform || wx.getSystemInfoSync().platform || '';
    return String(platform).toLowerCase();
  },

  showInviteLinkGuide(meetingJoinUrl) {
    wx.showModal({
      title: '请在浏览器中打开腾讯会议',
      content: '复制链接后，请在浏览器中打开腾讯会议。',
      confirmText: '复制链接',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.copyMeetingValue(meetingJoinUrl, '邀请链接已复制');
        }
      }
    });
  },

  showMeetingLaunchOptions({ meetingId, meetingJoinUrl }) {
    const itemList = [];
    const actions = [];

    const pushAction = (label, action) => {
      itemList.push(label);
      actions.push(action);
    };

    if (meetingId) {
      pushAction('打开腾讯会议小程序', () =>
        this.openMeetingMiniProgram(meetingId)
      );
    }

    pushAction('复制邀请链接', () => {
      this.showInviteLinkGuide(meetingJoinUrl);
    });

    wx.showActionSheet({
      itemList,
      success: (res) => {
        const action = actions[res.tapIndex];
        if (action) {
          action();
        }
      },
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.includes('cancel')) {
          return;
        }

        if (meetingId) {
          this.openMeetingMiniProgram(meetingId);
          return;
        }

        this.promptManualMeetingJoin(meetingId);
      }
    });
  },

  copyMeetingValue(value, title) {
    if (!value) {
      wx.showToast({
        title: '暂无可复制内容',
        icon: 'none'
      });
      return;
    }

    wx.setClipboardData({
      data: value,
      success: () => {
        wx.showToast({
          title,
          icon: 'success'
        });
      }
    });
  },

  isDesktopPlatform() {
    const platform = this.getCurrentPlatform();
    return platform === 'windows' || platform === 'mac';
  },

  isDesktopLikePlatform() {
    const platform = this.getCurrentPlatform();
    return (
      platform === 'windows' || platform === 'mac' || platform === 'devtools'
    );
  },

  normalizeMeetingJoinUrl(url) {
    if (!url || typeof url !== 'string') {
      return '';
    }

    const trimmedUrl = url.trim();
    const allowedHostPattern =
      /^https:\/\/(meeting\.tencent\.com|wemeet\.qq\.com|voovmeeting\.com)\//i;
    return allowedHostPattern.test(trimmedUrl) ? trimmedUrl : '';
  },

  openMeetingWebView(meetingJoinUrl, meetingId = '') {
    wx.navigateTo({
      url:
        '/pages/meeting-webview/meeting-webview?url=' +
        encodeURIComponent(meetingJoinUrl) +
        '&meetingId=' +
        encodeURIComponent(meetingId || ''),
      fail: () => {
        this.promptManualMeetingJoin(
          meetingId,
          '当前环境无法打开腾讯会议邀请链接。'
        );
      }
    });
  },

  openMeetingMiniProgram(meetingId) {
    const cleanId = String(meetingId || '').replace(/[-\s]/g, '');
    if (!cleanId) {
      this.promptManualMeetingJoin(meetingId);
      return;
    }

    wx.navigateToMiniProgram({
      appId: 'wx33fd6cdc62520063',
      path: `pages/sub-preMeeting/join-meeting/join-meeting?scene=m=${cleanId}`,
      success: () => console.log('跳转腾讯会议成功'),
      fail: () => {
        this.promptManualMeetingJoin(meetingId);
      }
    });
  },

  promptManualMeetingJoin(meetingId, prefix = '') {
    const contentParts = [];
    if (prefix) {
      contentParts.push(prefix);
    }
    if (meetingId) {
      contentParts.push(`请手动打开腾讯会议APP，输入会议号：${meetingId}`);
    } else {
      contentParts.push('请手动打开腾讯会议APP或浏览器中的腾讯会议邀请链接。');
    }

    wx.showModal({
      title: '无法直接打开腾讯会议',
      content: contentParts.join('\n'),
      confirmText: meetingId ? '复制会议号' : '知道了',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm && meetingId) {
          wx.setClipboardData({ data: meetingId });
        }
      }
    });
  },

  /**
   * 格式化数字
   */
  formatNumber(num) {
    return formatNumber(num);
  },

  /**
   * 格式化加入时间
   */
  formatJoinDate(date) {
    if (!date) return '';
    return '加入于 ' + formatDate(date, 'YYYY-MM-DD');
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    return {
      title: '凡人共读｜每日晨读',
      path: '/pages/index/index',
      imageUrl: '/assets/images/share-default.jpg'
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: '凡人共读｜每日晨读',
      query: '',
      imageUrl: '/assets/images/share-default.jpg'
    };
  },

  /**
   * 打开编辑个人信息模态框
   */
  openEditProfile() {
    const { userInfo } = this.data;
    if (!userInfo) return;

    this.setData({
      showEditProfile: true,
      editForm: {
        avatar: userInfo.avatar || '🦁',
        nickname: userInfo.nickname || userInfo.name || '',
        signature: userInfo.signature || ''
      }
    });
  },

  /**
   * 关闭编辑个人信息模态框
   */
  closeEditProfile() {
    this.setData({
      showEditProfile: false
    });
  },

  /**
   * 防止事件冒泡
   */
  stopPropagation() {
    return false;
  },

  /**
   * 选择头像
   */
  selectAvatar(e) {
    const { avatar } = e.currentTarget.dataset;
    this.setData({
      'editForm.avatar': avatar
    });
  },

  /**
   * 昵称输入事件
   */
  onNicknameInput(e) {
    const { value } = e.detail;
    this.setData({
      'editForm.nickname': value
    });
  },

  /**
   * 签名输入事件
   */
  onSignatureInput(e) {
    const { value } = e.detail;
    this.setData({
      'editForm.signature': value
    });
  },

  /**
   * 检查签名是否有效（不为空、不只有空白字符和换行）
   */
  isValidSignature(signature) {
    if (!signature) return false;
    // 移除所有空白字符和换行，如果还有内容则认为有效
    return signature.trim().length > 0;
  },

  /**
   * 更新签名有效性状态
   */
  updateSignatureValidation() {
    const { userInfo } = this.data;
    const hasValidSignature =
      userInfo && this.isValidSignature(userInfo.signature);
    this.setData({ hasValidSignature });
  },

  /**
   * 保存用户个人信息
   */
  async saveUserProfile() {
    const { editForm, userInfo } = this.data;

    if (!editForm.nickname.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    if (editForm.nickname.length > 20) {
      wx.showToast({
        title: '昵称不能超过20个字符',
        icon: 'none'
      });
      return;
    }

    if (editForm.signature && editForm.signature.length > 200) {
      wx.showToast({
        title: '签名不能超过200个字符',
        icon: 'none'
      });
      return;
    }

    this.setData({ isSavingProfile: true });

    try {
      const app = getApp();

      // 调用更新用户信息API
      const response = await userService.updateUserProfile({
        avatar: editForm.avatar,
        nickname: editForm.nickname,
        signature: editForm.signature || null
      });

      // 如果没有异常，说明request.js已经验证了响应成功
      // 此时response是解包后的用户数据对象
      if (response && response._id) {
        activityService.track('profile_update', {
          targetType: 'profile'
        });

        // 更新本地用户信息
        const updatedUserInfo = {
          ...userInfo,
          avatar: editForm.avatar,
          nickname: editForm.nickname,
          signature: editForm.signature || null
        };

        this.setData({
          userInfo: updatedUserInfo,
          hasValidSignature: !!this.isValidSignature(updatedUserInfo.signature)
        });

        // 更新全局应用数据
        app.globalData.userInfo = updatedUserInfo;

        // 保存到本地存储（使用 constants 中定义的 key 保持一致）
        const constants = require('../../config/constants');
        wx.setStorageSync(constants.STORAGE_KEYS.USER_INFO, updatedUserInfo);

        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });

        // 关闭对话框
        this.setData({ showEditProfile: false });

        // 延迟 500ms 后刷新页面数据，确保签名等信息立即显示
        setTimeout(() => {
          this.loadUserData();
        }, 500);
      } else {
        wx.showToast({
          title: '保存失败，请重试',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('保存用户信息失败:', error);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ isSavingProfile: false });
    }
  }
});
