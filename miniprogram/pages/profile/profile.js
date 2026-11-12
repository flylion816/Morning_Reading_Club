// 我的页面
const userService = require('../../services/user.service');
const enrollmentService = require('../../services/enrollment.service');
const checkinService = require('../../services/checkin.service');
const notificationServiceModule = require('../../services/notification.service');
const constants = require('../../config/constants');
const { hasPaidEnrollment, clearEnrollmentCache } = require('../../utils/period-access');
const { decorateUserAvatar } = require('../../utils/avatar');
const { tenantStorage } = require('../../utils/storage');
const { isAdminUser } = require('../../utils/auth');
const { THEME_PRIMARY } = require('../../utils/theme');
const { MOOD_OPTIONS, getMoodOption } = require('../../utils/mood');

const notificationService = notificationServiceModule.default || notificationServiceModule;

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
const MAX_STAMPS = 6;
const FOOTPRINT_TTL = 5 * 60 * 1000;
const UNKNOWN_PERIOD_NAME = '未知期次';
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;
// 日历上的心情单字标记（与 MOOD_OPTIONS 的值对应）
const MOOD_MARKS = {
  happy: '晴',
  calm: '云',
  thoughtful: '风',
  inspired: '霞',
  low: '雨',
  other: '雾'
};

/**
 * 纯函数：当月出现过的心情图例（按 MOOD_OPTIONS 顺序），没有心情时返回空数组。
 */
function buildMoodLegend(cells) {
  const used = new Set((Array.isArray(cells) ? cells : []).map(c => c.mood).filter(Boolean));
  return MOOD_OPTIONS.filter(o => used.has(o.value)).map(o => ({
    value: o.value,
    mark: MOOD_MARKS[o.value] || o.name,
    name: o.name
  }));
}

/**
 * 东八区的“今天”：UTC 时间加 8 小时取年月日，返回本地 Date(y, m, d)，
 * 这样 getFullYear/getMonth/getDate 与设备时区无关。
 */
function getChinaToday(now = new Date()) {
  const shifted = new Date(now.getTime() + CHINA_OFFSET_MS);
  return new Date(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatMonthKey(year, month) {
  return `${year}-${pad2(month)}`;
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * 纯函数：生成周一开头的月历网格。
 * month 为 1-12；checkedDays 为 'YYYY-MM-DD' 数组；today 为 Date。
 * 返回 { totalDays, leadingBlanks, cells }，cells 含前导空白格（state: blank）。
 * moods 为 { 'YYYY-MM-DD': 心情值 }（可省略）：有心情的格子带 mood / moodName / moodTone。
 * state: blank | normal | checked | today | future
 */
function buildCalendarGrid(year, month, checkedDays = [], today = new Date(), moods = {}) {
  const totalDays = new Date(year, month, 0).getDate();
  const leadingBlanks = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const checked = new Set(Array.isArray(checkedDays) ? checkedDays : []);
  const todayKey = formatDateKey(today);
  const moodMap = moods && typeof moods === 'object' ? moods : {};
  const cells = [];

  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push({ key: `b${i}`, day: 0, state: 'blank' });
  }
  for (let day = 1; day <= totalDays; day += 1) {
    const key = `${formatMonthKey(year, month)}-${pad2(day)}`;
    let state = 'normal';
    if (key === todayKey) state = 'today';
    else if (key > todayKey) state = 'future';
    else if (checked.has(key)) state = 'checked';
    const cell = { key, day, state, checked: checked.has(key) };
    const moodOption = moodMap[key] ? getMoodOption(moodMap[key]) : null;
    if (moodOption) {
      cell.mood = moodOption.value;
      cell.moodName = MOOD_MARKS[moodOption.value] || moodOption.name;
    }
    cells.push(cell);
  }
  return { totalDays, leadingBlanks, cells };
}

function shiftMonth(year, month, delta) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function isCurrentOrFutureMonth(year, month, today = new Date()) {
  return year * 12 + month >= today.getFullYear() * 12 + today.getMonth() + 1;
}

/**
 * 纯函数：把 summary.periods 转成印章列表。
 * 只显示有名字且 status 为 completed（实线章）或 ongoing（虚线章）的期次，其它一律忽略。
 */
function buildStamps(periods) {
  const list = (Array.isArray(periods) ? periods : [])
    .map(item => ({
      ...item,
      displayName: item.name || item.title || ''
    }))
    .filter(item =>
      item.displayName &&
      item.displayName !== UNKNOWN_PERIOD_NAME &&
      (item.status === 'completed' || item.status === 'ongoing')
    );
  const stamps = list.slice(0, MAX_STAMPS).map((item, index) => ({
    key: item.periodId || `p${index}`,
    char: Array.from(item.displayName)[0],
    name: item.displayName,
    periodId: item.periodId || '',
    ended: item.status === 'completed'
  }));
  const current = list.find(item => item.status === 'ongoing');
  // 慢递邮局用的期次：优先进行中，否则取最近一期（接口按最近打卡时间倒序）
  const mailPeriod = current || list[0];
  return {
    slowMailPeriodId: (mailPeriod && mailPeriod.periodId) || '',
    total: list.length,
    stamps,
    moreCount: list.length > MAX_STAMPS ? list.length : 0,
    currentName: current ? current.displayName : ''
  };
}

Page({
  data: {
    userInfo: null,
    stats: {
      totalCheckinDays: 0,
      currentStreak: 0,
      maxStreak: 0
    },
    weekLabels: WEEK_LABELS,
    calendarYear: 0,
    calendarMonth: 0,
    calendarCells: [],
    moodLegend: [],
    calendarError: false,
    canGoNextMonth: false,
    footprints: { total: 0, stamps: [], moreCount: 0, currentName: '', slowMailPeriodId: '' },
    isLogin: false,
    phoneMasked: '',
    hasPhone: false,
    canUsePaidFeatures: false,
    isAdmin: false,
    unreadNotificationCount: 0,
    loading: false,
    themePrimaryColor: THEME_PRIMARY
  },

  onLoad(options = {}) {
    if (options.from === 'share') {
      this._redirectingFromLegacyShare = true;
      wx.reLaunch({ url: '/pages/index/index?from=share' });
    }
  },

  onShow() {
    if (this._redirectingFromLegacyShare) {
      return;
    }

    const app = getApp();
    const isLogin = app.globalData.isLogin;
    this.setData({
      isLogin,
      unreadNotificationCount: isLogin ? this.data.unreadNotificationCount : 0
    });
    if (isLogin) {
      this._loadUserData();
      this.loadUnreadNotificationCount();
    }
  },

  async _loadUserData() {
    this.setData({ loading: true });
    try {
      const [userInfo, stats, userEnrollments] = await Promise.all([
        userService.getUserProfile(),
        userService.getUserStats(),
        enrollmentService.getUserEnrollments({ limit: 100 }).catch(() => ({ list: [] }))
      ]);

      // 处理手机号脱敏
      const phone = userInfo.phone || '';
      const hasPhone = !!phone;
      const phoneMasked = hasPhone
        ? phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
        : '';
      const enrollmentList = userEnrollments.list || userEnrollments || [];
      const canUsePaidFeatures = hasPaidEnrollment(enrollmentList);

      const displayUserInfo = decorateUserAvatar(userInfo);

      this.setData({
        userInfo: displayUserInfo,
        stats: {
          totalCheckinDays: (stats && stats.totalCheckinDays) || 0,
          currentStreak: (stats && stats.currentStreak) || 0,
          maxStreak: (stats && stats.maxStreak) || 0
        },
        hasPhone,
        phoneMasked,
        canUsePaidFeatures,
        isAdmin: isAdminUser(userInfo)
      });

      if (canUsePaidFeatures) {
        this._loadCalendar();
        this._loadFootprints();
      }
    } catch (err) {
      console.error('加载用户数据失败', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 晨读日历：未指定月份时沿用当前显示月（首次为本月）
  async _loadCalendar(year, month) {
    const now = getChinaToday();
    const y = year || this.data.calendarYear || now.getFullYear();
    const m = month || this.data.calendarMonth || now.getMonth() + 1;
    const requestId = (this._calendarRequestId || 0) + 1;
    this._calendarRequestId = requestId;

    // 先画出没有标记的日历，再按接口结果补标记
    this.setData({
      calendarYear: y,
      calendarMonth: m,
      calendarCells: buildCalendarGrid(y, m, [], now).cells,
      moodLegend: [],
      canGoNextMonth: !isCurrentOrFutureMonth(y, m, now),
      calendarError: false
    });

    try {
      const res = await checkinService.getUserCalendar(formatMonthKey(y, m));
      if (requestId !== this._calendarRequestId) return;
      const cells = buildCalendarGrid(y, m, (res && res.days) || [], now, res && res.moods).cells;
      this.setData({
        calendarCells: cells,
        moodLegend: buildMoodLegend(cells)
      });
    } catch (error) {
      if (requestId !== this._calendarRequestId) return;
      console.error('加载晨读日历失败', error);
      this.setData({ calendarError: true });
    }
  },

  retryCalendar() {
    this._loadCalendar(this.data.calendarYear, this.data.calendarMonth);
  },

  goPrevMonth() {
    const next = shiftMonth(this.data.calendarYear, this.data.calendarMonth, -1);
    this._loadCalendar(next.year, next.month);
  },

  goNextMonth() {
    if (!this.data.canGoNextMonth) return;
    const next = shiftMonth(this.data.calendarYear, this.data.calendarMonth, 1);
    this._loadCalendar(next.year, next.month);
  },

  // 共读足迹：失败时整块不显示
  // summary 接口较重：页面没有下拉刷新，用 5 分钟内存缓存，期间再次显示不重复请求
  async _loadFootprints() {
    const now = Date.now();
    if (this._footprintsLoading) return;
    if (this._footprintsLoadedAt && now - this._footprintsLoadedAt < FOOTPRINT_TTL) return;
    this._footprintsLoading = true;
    try {
      const summary = await checkinService.getUserDiarySummary();
      this._footprintsLoadedAt = Date.now();
      this.setData({ footprints: buildStamps(summary && summary.periods) });
    } catch (error) {
      console.error('加载共读足迹失败', error);
    } finally {
      this._footprintsLoading = false;
    }
  },

  async loadUnreadNotificationCount() {
    try {
      const unreadResponse = await notificationService.getUnreadCount();
      this.setData({
        unreadNotificationCount: unreadResponse?.unreadCount || 0
      });
    } catch (error) {
      console.error('加载通知未读数失败', error);
    }
  },

  // 获取/换绑手机号
  async handleGetPhoneNumber(e) {
    if (!this.data.canUsePaidFeatures) {
      wx.showToast({ title: '完成支付后可绑定手机号', icon: 'none' });
      return;
    }

    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      return;
    }
    const code = e.detail.code;
    if (!code) {
      wx.showToast({ title: '没拿到手机号，再试一次', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '正在绑定…' });
      await userService.bindPhone(code);
      wx.hideLoading();
      wx.showToast({ title: '绑定成功', icon: 'success' });
      this._loadUserData();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '没绑定上，再试一次', icon: 'none' });
    }
  },

  goToNotificationSettings() {
    if (!this.data.canUsePaidFeatures) {
      wx.showToast({ title: '完成支付后可管理提醒', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/notification-settings/notification-settings' });
  },

  goToNotifications() {
    wx.navigateTo({ url: '/pages/notifications/notifications' });
  },

  goToMyCheckinRecords() {
    if (!this.data.canUsePaidFeatures) {
      wx.showToast({ title: '完成支付后可查看打卡日记', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/checkin-records/checkin-records' });
  },

  goToMyHighlights() {
    if (!this.data.canUsePaidFeatures) {
      wx.showToast({ title: '完成支付后可查看摘抄本', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/highlights/highlights' });
  },

  goToSeenReceived() {
    if (!this.data.canUsePaidFeatures) {
      wx.showToast({ title: '完成支付后可查看被看见', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/seen-received/seen-received' });
  },

  goToSlowMail() {
    const periodId = this.data.footprints && this.data.footprints.slowMailPeriodId;
    if (!this.data.canUsePaidFeatures || !periodId) return;
    wx.navigateTo({ url: `/pages/slow-mail/slow-mail?periodId=${encodeURIComponent(periodId)}` });
  },

  // 点印章：翻开那一期的纪念册（进行中的期次页面自己会显示还有几天结营）
  goToKeepsake(e) {
    const periodId = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.periodId;
    if (!periodId) return;
    wx.navigateTo({ url: `/pages/keepsake/keepsake?periodId=${encodeURIComponent(periodId)}` });
  },

  goToCompletionReports() {
    if (!this.data.canUsePaidFeatures) {
      wx.showToast({ title: '完成支付后可查看实录报告', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/completion-reports/completion-reports' });
  },

  goToEditProfile() {
    wx.navigateTo({ url: '/pages/edit-profile/edit-profile' });
  },

  goToPrivacy() {
    wx.navigateTo({ url: '/pages/privacy-policy/privacy-policy' });
  },

  goToAgreement() {
    wx.navigateTo({ url: '/pages/user-agreement/user-agreement' });
  },

  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmColor: '#e74c3c',
      success: (res) => {
        if (!res.confirm) return;
        tenantStorage.remove(constants.STORAGE_KEYS.TOKEN);
        tenantStorage.remove(constants.STORAGE_KEYS.REFRESH_TOKEN);
        tenantStorage.remove(constants.STORAGE_KEYS.USER_INFO);
        const app = getApp();
        const previousUserKey =
          app.globalData.userInfo?._id || app.globalData.userInfo?.id || '';
        clearEnrollmentCache(null, previousUserKey);
        app.globalData.isLogin = false;
        app.globalData.userInfo = null;
        app.globalData.token = null;
        app.globalData._enrollmentChanged = false;
        app.globalData._enrollmentCheckedAt = 0;
        wx.reLaunch({ url: '/pages/login/login' });
      }
    });
  },

  goToMyActivities() {
    wx.navigateTo({ url: '/pages/my-community-activities/my-community-activities' });
  },

  goToMyCoupons() {
    wx.navigateTo({ url: '/pages/my-coupons/my-coupons' });
  },

  goToAdminWorkbench() {
    wx.navigateTo({ url: '/pages/admin-workbench/admin-workbench' });
  },

  goToAdminAnalytics() {
    wx.navigateTo({ url: '/pages/admin-analytics/admin-analytics' });
  },

  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  }
});

module.exports = { getChinaToday, buildCalendarGrid, buildMoodLegend, buildStamps, shiftMonth, formatMonthKey };
