jest.mock('../../services/user.service', () => ({
  getUserProfile: jest.fn(),
  getUserStats: jest.fn()
}));

jest.mock('../../services/checkin.service', () => ({
  getUserCalendar: jest.fn(),
  getUserDiarySummary: jest.fn()
}));

jest.mock('../../services/enrollment.service', () => ({
  getUserEnrollments: jest.fn()
}));

jest.mock('../../services/notification.service', () => ({
  getUnreadCount: jest.fn()
}));

jest.mock('../../config/constants', () => ({
  STORAGE_KEYS: {
    TOKEN: 'token',
    REFRESH_TOKEN: 'refresh_token',
    USER_INFO: 'user_info'
  }
}));

jest.mock('../../utils/period-access', () => ({
  hasPaidEnrollment: jest.fn(() => true)
}));

const fs = require('fs');
const path = require('path');

describe('profile page', () => {
  let pageConfig;
  let pageInstance;
  let userService;
  let enrollmentService;
  let checkinService;
  let notificationService;
  let periodAccess;

  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;

    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });
    global.getApp = jest.fn(() => ({
      globalData: {
        isLogin: true
      }
    }));

    wx.navigateTo.mockClear();
    wx.reLaunch.mockClear();
    wx.showToast.mockClear();

    userService = require('../../services/user.service');
    enrollmentService = require('../../services/enrollment.service');
    checkinService = require('../../services/checkin.service');
    notificationService = require('../../services/notification.service');
    periodAccess = require('../../utils/period-access');

    userService.getUserProfile.mockResolvedValue({
      nickname: '小狐狸',
      phone: '13812345678',
      role: 'user'
    });
    userService.getUserStats.mockResolvedValue({
      totalCheckinDays: 12
    });
    enrollmentService.getUserEnrollments.mockResolvedValue({
      list: [{ status: 'active', periodId: 'period_1' }]
    });
    notificationService.getUnreadCount.mockResolvedValue({
      unreadCount: 6
    });
    checkinService.getUserCalendar.mockReset();
    checkinService.getUserCalendar.mockResolvedValue({ month: '2026-11', days: ['2026-11-04'] });
    checkinService.getUserDiarySummary.mockReset();
    checkinService.getUserDiarySummary.mockResolvedValue({ periods: [] });
    periodAccess.hasPaidEnrollment.mockClear();
    periodAccess.hasPaidEnrollment.mockReturnValue(true);

    require('../../pages/profile/profile');

    pageInstance = {
      ...pageConfig,
      data: JSON.parse(JSON.stringify(pageConfig.data)),
      setData(update) {
        this.data = {
          ...this.data,
          ...update
        };
      }
    };
  });

  afterEach(() => {
    delete global.Page;
    delete global.getApp;
  });

  test('should load profile data without blocking on unread notifications', async () => {
    await pageInstance._loadUserData.call(pageInstance);

    expect(notificationService.getUnreadCount).not.toHaveBeenCalled();
    expect(pageInstance.data.phoneMasked).toBe('138****5678');
  });

  test('should load unread notification count separately', async () => {
    await pageInstance.loadUnreadNotificationCount.call(pageInstance);

    expect(notificationService.getUnreadCount).toHaveBeenCalled();
    expect(pageInstance.data.unreadNotificationCount).toBe(6);
  });

  test('should navigate to notifications page', () => {
    pageInstance.goToNotifications.call(pageInstance);

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/notifications/notifications'
    });
  });

  test('should expose admin analytics entry for admin user', async () => {
    userService.getUserProfile.mockResolvedValue({
      nickname: '管理员',
      phone: '13812345678',
      role: 'admin'
    });

    await pageInstance._loadUserData.call(pageInstance);
    pageInstance.goToAdminAnalytics.call(pageInstance);

    expect(pageInstance.data.isAdmin).toBe(true);
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/admin-analytics/admin-analytics'
    });
  });

  test('should navigate to admin workbench for admin user', async () => {
    userService.getUserProfile.mockResolvedValue({
      nickname: '管理员',
      phone: '13812345678',
      role: 'admin'
    });

    await pageInstance._loadUserData.call(pageInstance);
    pageInstance.goToAdminWorkbench.call(pageInstance);

    expect(pageInstance.data.isAdmin).toBe(true);
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/admin-workbench/admin-workbench'
    });
  });

  test('should keep admin analytics hidden for normal user', async () => {
    await pageInstance._loadUserData.call(pageInstance);

    expect(pageInstance.data.isAdmin).toBe(false);
  });

  test('should redirect legacy share entry to home page', () => {
    pageInstance.onLoad.call(pageInstance, { from: 'share' });

    expect(wx.reLaunch).toHaveBeenCalledWith({
      url: '/pages/index/index?from=share'
    });
  });

  test('should let logged-out visitors browse courses', () => {
    pageInstance.goToCourses.call(pageInstance);

    expect(wx.switchTab).toHaveBeenCalledWith({
      url: '/pages/periods/periods'
    });
  });

  test('should not navigate to checkin records without paid access', () => {
    pageInstance.setData({ canUsePaidFeatures: false });

    pageInstance.goToMyCheckinRecords.call(pageInstance);

    expect(wx.showToast).toHaveBeenCalledWith({
      title: '完成支付后可查看打卡日记',
      icon: 'none'
    });
    expect(wx.navigateTo).not.toHaveBeenCalledWith({
      url: '/pages/checkin-records/checkin-records'
    });
  });

  test('should navigate to completion reports with paid access', () => {
    pageInstance.setData({ canUsePaidFeatures: true });

    pageInstance.goToCompletionReports.call(pageInstance);

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: '/pages/completion-reports/completion-reports'
    });
  });

  test('should not navigate to completion reports without paid access', () => {
    pageInstance.setData({ canUsePaidFeatures: false });

    pageInstance.goToCompletionReports.call(pageInstance);

    expect(wx.showToast).toHaveBeenCalledWith({
      title: '完成支付后可查看实录报告',
      icon: 'none'
    });
    expect(wx.navigateTo).not.toHaveBeenCalledWith({
      url: '/pages/completion-reports/completion-reports'
    });
  });

  test('should hide completion reports entry without paid access', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../pages/profile/profile.wxml'),
      'utf8'
    );

    expect(wxml).toContain('我的实录报告');
    expect(wxml).toContain('wx:if="{{canUsePaidFeatures}}" class="settings-cell" bindtap="goToCompletionReports"');
  });

  test('should keep profile menu grouped in expected order', () => {
    const wxml = fs.readFileSync(
      path.join(__dirname, '../../pages/profile/profile.wxml'),
      'utf8'
    );
    const expectedOrder = [
      '手机号管理',
      '编辑资料',
      '消息通知',
      '消息提醒设置',
      '我的活动',
      '我的打卡日记',
      '我的实录报告',
      '我的优惠券',
      '管理工作台',
      '数据分析',
      '隐私政策',
      '用户协议'
    ];
    const positions = expectedOrder.map(label => wxml.indexOf(label));

    expect(positions.every(index => index >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  describe('晨读手账', () => {
    const flush = () => new Promise(resolve => setImmediate(resolve));

    test('buildCalendarGrid: 周一开头、天数与状态', () => {
      const { buildCalendarGrid } = require('../../pages/profile/profile');
      // 2026-11-01 是周日 -> 前面 6 个空格
      const grid = buildCalendarGrid(2026, 11, ['2026-11-04', '2026-11-10'], new Date(2026, 10, 10));
      expect(grid.leadingBlanks).toBe(6);
      expect(grid.totalDays).toBe(30);
      expect(grid.cells).toHaveLength(36);
      const byDay = d => grid.cells.find(c => c.day === d);
      expect(byDay(4).state).toBe('checked');
      expect(byDay(5).state).toBe('normal');
      expect(byDay(10).state).toBe('today');
      expect(byDay(10).checked).toBe(true);
      expect(byDay(11).state).toBe('future');
    });

    test('buildCalendarGrid: 闰年二月与周一起始无空格', () => {
      const { buildCalendarGrid } = require('../../pages/profile/profile');
      const grid = buildCalendarGrid(2024, 2, [], new Date(2026, 10, 10));
      expect(grid.totalDays).toBe(29);
      expect(grid.leadingBlanks).toBe(3);
      expect(buildCalendarGrid(2026, 6, [], new Date(2026, 10, 10)).leadingBlanks).toBe(0);
    });

    test('shiftMonth 跨年', () => {
      const { shiftMonth } = require('../../pages/profile/profile');
      expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
      expect(shiftMonth(2025, 12, 1)).toEqual({ year: 2026, month: 1 });
    });

    test('buildStamps: 取首字、最多 6 枚、已结束/进行中', () => {
      const { buildStamps } = require('../../pages/profile/profile');
      const periods = Array.from({ length: 8 }, (_, i) => ({
        periodId: `p${i}`,
        name: i === 0 ? '韧性之树' : `期次${i}`,
        status: i === 0 ? 'ongoing' : 'completed'
      }));
      const result = buildStamps(periods);
      expect(result.stamps).toHaveLength(6);
      expect(result.stamps[0]).toMatchObject({ char: '韧', ended: false });
      expect(result.stamps[1].ended).toBe(true);
      expect(result.moreCount).toBe(8);
      expect(result.currentName).toBe('韧性之树');
      expect(buildStamps(undefined).total).toBe(0);
    });

    test('getChinaToday 按东八区取日期，与设备时区无关', () => {
      const { getChinaToday, buildCalendarGrid } = require('../../pages/profile/profile');
      // UTC 11-10 17:00 = 东八区 11-11 01:00
      const today = getChinaToday(new Date('2026-11-10T17:00:00Z'));
      expect([today.getFullYear(), today.getMonth() + 1, today.getDate()]).toEqual([2026, 11, 11]);
      // UTC 11-10 15:59 = 东八区 11-10 23:59
      const early = getChinaToday(new Date('2026-11-10T15:59:00Z'));
      expect(early.getDate()).toBe(10);
      // 月末跨月：UTC 10-31 16:30 = 东八区 11-01
      const crossMonth = getChinaToday(new Date('2026-10-31T16:30:00Z'));
      expect([crossMonth.getMonth() + 1, crossMonth.getDate()]).toEqual([11, 1]);

      const grid = buildCalendarGrid(2026, 11, ['2026-11-11'], today);
      expect(grid.cells.find(c => c.day === 11).state).toBe('today');
      expect(grid.cells.find(c => c.day === 11).checked).toBe(true);
      expect(grid.cells.find(c => c.day === 12).state).toBe('future');
    });

    test('buildStamps 只显示有名字的 completed / ongoing 期次', () => {
      const { buildStamps } = require('../../pages/profile/profile');
      const result = buildStamps([
        { periodId: 'a', name: '韧性之树', status: 'completed' },
        { periodId: 'b', name: '未知期次', status: null },
        { periodId: 'c', name: '未知期次', status: 'ongoing' },
        { periodId: 'd', name: '协同', status: 'not_started' },
        { periodId: 'e', name: '', status: 'completed' },
        { periodId: 'f', name: '自我更新', status: 'ongoing' },
        { periodId: 'g', name: '秩序', status: 'weird' }
      ]);
      expect(result.total).toBe(2);
      expect(result.stamps.map(x => x.char)).toEqual(['韧', '自']);
      expect(result.stamps.map(x => x.ended)).toEqual([true, false]);
      expect(result.currentName).toBe('自我更新');
      expect(buildStamps([{ name: '未知期次', status: 'ongoing' }]).currentName).toBe('');
    });

    test('足迹 5 分钟内复用缓存，日历每次显示都刷新', async () => {
      await pageInstance._loadUserData.call(pageInstance);
      await flush();
      await pageInstance._loadUserData.call(pageInstance);
      await flush();
      expect(checkinService.getUserDiarySummary).toHaveBeenCalledTimes(1);
      expect(checkinService.getUserCalendar).toHaveBeenCalledTimes(2);

      pageInstance._footprintsLoadedAt = Date.now() - 6 * 60 * 1000;
      await pageInstance._loadUserData.call(pageInstance);
      await flush();
      expect(checkinService.getUserDiarySummary).toHaveBeenCalledTimes(2);
    });

    test('足迹请求失败后不记缓存，下次仍会重试', async () => {
      checkinService.getUserDiarySummary.mockRejectedValueOnce(new Error('boom'));
      await pageInstance._loadUserData.call(pageInstance);
      await flush();
      await pageInstance._loadUserData.call(pageInstance);
      await flush();
      expect(checkinService.getUserDiarySummary).toHaveBeenCalledTimes(2);
    });

    test('今天已打卡与未打卡样式可区分', () => {
      const wxss = fs.readFileSync(path.join(__dirname, '../../pages/profile/profile.wxss'), 'utf8');
      expect(wxss).toMatch(/\.cal-day-today-checked\s*{/);
      expect(wxss).toMatch(/\.cal-day-today\s*{[^}]*background: transparent/);
    });

    test('已付费用户加载本月日历与足迹，三个数字缺失时为 0', async () => {
      userService.getUserStats.mockResolvedValue({ totalCheckinDays: 5, currentStreak: 2 });
      checkinService.getUserDiarySummary.mockResolvedValue({
        periods: [{ periodId: 'a', name: '韧性之树', status: 'completed' }]
      });
      await pageInstance._loadUserData.call(pageInstance);
      await flush();

      const now = new Date();
      const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      expect(checkinService.getUserCalendar).toHaveBeenCalledWith(key);
      expect(pageInstance.data.stats).toEqual({ totalCheckinDays: 5, currentStreak: 2, maxStreak: 0 });
      expect(pageInstance.data.canGoNextMonth).toBe(false);
      expect(pageInstance.data.footprints.stamps[0].char).toBe('韧');
    });

    test('未付费不加载日历与足迹', async () => {
      periodAccess.hasPaidEnrollment.mockReturnValue(false);
      await pageInstance._loadUserData.call(pageInstance);
      await flush();
      expect(checkinService.getUserCalendar).not.toHaveBeenCalled();
      expect(checkinService.getUserDiarySummary).not.toHaveBeenCalled();
    });

    test('月份切换：可往回翻，不能翻到未来', async () => {
      await pageInstance._loadUserData.call(pageInstance);
      await flush();
      const { calendarYear, calendarMonth } = pageInstance.data;
      checkinService.getUserCalendar.mockClear();

      await pageInstance.goNextMonth.call(pageInstance);
      expect(checkinService.getUserCalendar).not.toHaveBeenCalled();

      await pageInstance.goPrevMonth.call(pageInstance);
      expect(checkinService.getUserCalendar).toHaveBeenCalledTimes(1);
      expect(pageInstance.data.canGoNextMonth).toBe(true);
      const expected = calendarMonth === 1 ? 12 : calendarMonth - 1;
      expect(pageInstance.data.calendarMonth).toBe(expected);
      expect(pageInstance.data.calendarYear).toBe(calendarMonth === 1 ? calendarYear - 1 : calendarYear);

      await pageInstance.goNextMonth.call(pageInstance);
      expect(pageInstance.data.calendarMonth).toBe(calendarMonth);
    });

    test('日历接口失败：照常显示网格，给重试提示，不弹 toast', async () => {
      checkinService.getUserCalendar.mockRejectedValue(new Error('boom'));
      await pageInstance._loadUserData.call(pageInstance);
      await flush();
      expect(pageInstance.data.calendarError).toBe(true);
      expect(pageInstance.data.calendarCells.length).toBeGreaterThan(28);
      expect(wx.showToast).not.toHaveBeenCalled();

      checkinService.getUserCalendar.mockResolvedValue({ days: [] });
      await pageInstance.retryCalendar.call(pageInstance);
      expect(pageInstance.data.calendarError).toBe(false);
    });

    test('足迹接口失败：整块不显示', async () => {
      checkinService.getUserDiarySummary.mockRejectedValue(new Error('boom'));
      await pageInstance._loadUserData.call(pageInstance);
      await flush();
      expect(pageInstance.data.footprints.total).toBe(0);
    });

    test('buildCalendarGrid 接收 moods，缺省时向后兼容', () => {
      const { buildCalendarGrid, buildMoodLegend } = require('../../pages/profile/profile');
      const today = new Date(2026, 10, 20);
      const plain = buildCalendarGrid(2026, 11, ['2026-11-04'], today);
      expect(plain.cells.every(c => !c.mood)).toBe(true);
      expect(buildMoodLegend(plain.cells)).toEqual([]);
      const grid = buildCalendarGrid(2026, 11, [], today, { '2026-11-03': 'happy', '2026-11-05': 'low', '2026-11-06': 'bogus' });
      expect(grid.cells.find(c => c.day === 3)).toMatchObject({ mood: 'happy', moodName: '晴' });
      expect(grid.cells.find(c => c.day === 5).moodName).toBe('雨');
      expect(grid.cells.find(c => c.day === 6).mood).toBeUndefined();
      expect(buildMoodLegend(grid.cells).map(x => x.value)).toEqual(['happy', 'low']);
    });

    test('日历带心情：图例有数据才显示；换月清空', async () => {
      checkinService.getUserCalendar.mockResolvedValue({ days: [], moods: { '2026-11-03': 'calm' } });
      await pageInstance._loadUserData.call(pageInstance);
      await flush();
      expect(pageInstance.data.moodLegend).toHaveLength(1);
      checkinService.getUserCalendar.mockResolvedValue({ days: [] });
      await pageInstance.retryCalendar.call(pageInstance);
      expect(pageInstance.data.moodLegend).toEqual([]);
    });

    test('buildStamps 带 periodId；慢递期次：进行中优先，否则最近一期，没有则空', () => {
      const { buildStamps } = require('../../pages/profile/profile');
      const r1 = buildStamps([
        { periodId: 'a', name: '甲', status: 'completed' },
        { periodId: 'b', name: '乙', status: 'ongoing' }
      ]);
      expect(r1.stamps.map(s => s.periodId)).toEqual(['a', 'b']);
      expect(r1.slowMailPeriodId).toBe('b');
      expect(buildStamps([
        { periodId: 'a', name: '甲', status: 'completed' },
        { periodId: 'c', name: '丙', status: 'completed' }
      ]).slowMailPeriodId).toBe('a');
      expect(buildStamps([]).slowMailPeriodId).toBe('');
    });

    test('新入口跳转与印章点击', () => {
      pageInstance.data.canUsePaidFeatures = true;
      pageInstance.goToMyHighlights.call(pageInstance);
      expect(wx.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/highlights/highlights' });
      pageInstance.goToSeenReceived.call(pageInstance);
      expect(wx.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/seen-received/seen-received' });
      wx.navigateTo.mockClear();
      pageInstance.goToSlowMail.call(pageInstance);
      expect(wx.navigateTo).not.toHaveBeenCalled();
      pageInstance.data.footprints = { slowMailPeriodId: 'p9' };
      pageInstance.goToSlowMail.call(pageInstance);
      expect(wx.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/slow-mail/slow-mail?periodId=p9' });
      pageInstance.goToKeepsake.call(pageInstance, { currentTarget: { dataset: { periodId: 'p3' } } });
      expect(wx.navigateTo).toHaveBeenLastCalledWith({ url: '/pages/keepsake/keepsake?periodId=p3' });
      wx.navigateTo.mockClear();
      pageInstance.goToKeepsake.call(pageInstance, { currentTarget: { dataset: {} } });
      expect(wx.navigateTo).not.toHaveBeenCalled();
      pageInstance.data.canUsePaidFeatures = false;
      pageInstance.goToMyHighlights.call(pageInstance);
      expect(wx.navigateTo).not.toHaveBeenCalled();
    });

    test('wxml 新入口显示条件', () => {
      const wxml = fs.readFileSync(path.join(__dirname, '../../pages/profile/profile.wxml'), 'utf8');
      expect(wxml).toMatch(/wx:if="\{\{canUsePaidFeatures\}\}"[^>]*bindtap="goToMyHighlights"/);
      expect(wxml).toMatch(/wx:if="\{\{canUsePaidFeatures\}\}"[^>]*bindtap="goToSeenReceived"/);
      expect(wxml).toMatch(/wx:if="\{\{canUsePaidFeatures && footprints\.slowMailPeriodId\}\}"[^>]*bindtap="goToSlowMail"/);
      expect(wxml).toContain('wx:if="{{moodLegend.length}}"');
      expect(wxml).toContain('bindtap="goToKeepsake"');
    });

    test('wxml 保留关键事件绑定', () => {
      const wxml = fs.readFileSync(path.join(__dirname, '../../pages/profile/profile.wxml'), 'utf8');
      ['handleGetPhoneNumber', 'goToEditProfile', 'goToNotifications', 'goToNotificationSettings',
        'goToMyActivities', 'goToMyCheckinRecords', 'goToCompletionReports', 'goToMyCoupons',
        'goToAdminWorkbench', 'goToAdminAnalytics', 'goToPrivacy', 'goToAgreement', 'handleLogout',
        'goToLogin', 'goPrevMonth', 'goNextMonth', 'retryCalendar', 'getPhoneNumber'
      ].forEach(name => expect(wxml).toContain(name));
    });
  });
});
