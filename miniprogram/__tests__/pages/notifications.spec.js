jest.mock('../../services/notification.service', () => ({
  __esModule: true,
  default: {
    getNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
    getTypeIcon: jest.fn(() => '🔔'),
    getTypeLabel: jest.fn(type => type),
    getTypeColor: jest.fn(() => '#4a90e2'),
    formatTime: jest.fn(() => '刚刚')
  }
}));

jest.mock('../../pages/notifications/websocket.service', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(() => Promise.resolve()),
    on: jest.fn(() => jest.fn())
  }
}));

describe('notifications page', () => {
  let pageConfig;
  let pageInstance;
  let notificationService;

  beforeEach(() => {
    jest.resetModules();
    pageConfig = null;

    global.Page = jest.fn(config => {
      pageConfig = config;
      return config;
    });

    wx.navigateTo.mockClear();
    wx.switchTab.mockClear();

    notificationService = require('../../services/notification.service').default;
    notificationService.markAsRead.mockReset();
    notificationService.markAsRead.mockResolvedValue({});
    notificationService.getNotifications.mockReset();
    notificationService.getUnreadCount.mockReset();

    require('../../pages/notifications/notifications');

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
  });

  test('should open other user profile page for approved insight request notification', async () => {
    const notification = pageInstance.decorateNotification.call(pageInstance, {
      _id: 'notice_1',
      type: 'request_approved',
      isRead: false,
      senderId: {
        _id: 'user_target',
        nickname: '被申请人'
      },
      data: {
        periodId: 'period_1'
      }
    });

    pageInstance.setData({
      notifications: [notification]
    });

    await pageInstance.handleNotificationTap.call(pageInstance, {
      currentTarget: {
        dataset: {
          id: 'notice_1'
        }
      }
    });

    expect(notificationService.markAsRead).toHaveBeenCalledWith('notice_1');
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/profile-others/profile-others?userId=user_target&periodId=period_1'
    }));
  });

  test('should switch to home tab for new insight request notification', async () => {
    const notification = pageInstance.decorateNotification.call(pageInstance, {
      _id: 'notice_2',
      type: 'request_created',
      isRead: true,
      data: {
        targetPage: 'pages/index/index'
      }
    });

    pageInstance.setData({
      notifications: [notification]
    });

    await pageInstance.handleNotificationTap.call(pageInstance, {
      currentTarget: {
        dataset: {
          id: 'notice_2'
        }
      }
    });

    expect(wx.switchTab).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/index/index'
    }));
  });

  test('should ignore legacy profile target for new insight request notification', async () => {
    const notification = pageInstance.decorateNotification.call(pageInstance, {
      _id: 'notice_legacy_profile',
      type: 'request_created',
      isRead: true,
      data: {
        targetPage: 'pages/profile/profile'
      }
    });

    pageInstance.setData({
      notifications: [notification]
    });

    await pageInstance.handleNotificationTap.call(pageInstance, {
      currentTarget: {
        dataset: {
          id: 'notice_legacy_profile'
        }
      }
    });

    expect(wx.switchTab).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/index/index'
    }));
  });

  test('should navigate immediately when action hint is tapped', () => {
    notificationService.markAsRead.mockImplementation(() => new Promise(() => {}));

    const notification = pageInstance.decorateNotification.call(pageInstance, {
      _id: 'notice_3',
      type: 'request_created',
      isRead: false,
      data: {
        targetPage: 'pages/index/index'
      }
    });

    pageInstance.setData({
      notifications: [notification],
      displayedNotifications: [notification],
      unreadCount: 1
    });

    pageInstance.handleNotificationActionTap.call(pageInstance, {
      currentTarget: {
        dataset: {
          id: 'notice_3'
        }
      }
    });

    expect(notificationService.markAsRead).toHaveBeenCalledWith('notice_3');
    expect(wx.switchTab).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/index/index'
    }));
  });

  test('should still navigate when dataset id is missing but index is present', () => {
    const notification = pageInstance.decorateNotification.call(pageInstance, {
      _id: 'notice_4',
      type: 'request_created',
      isRead: true,
      data: {
        targetPage: 'pages/index/index'
      }
    });

    pageInstance.setData({
      notifications: [notification],
      displayedNotifications: [notification]
    });

    pageInstance.handleNotificationActionTap.call(pageInstance, {
      currentTarget: {
        dataset: {
          index: 0
        }
      }
    });

    expect(wx.switchTab).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/index/index'
    }));
  });
  test('decorates letter_delivered with label, action text and slow-mail target', () => {
    const n = pageInstance.decorateNotification.call(pageInstance, {
      _id: 'n_letter',
      type: 'letter_delivered',
      data: { periodId: 'p1', letterId: 'l1' }
    });
    expect(n.typeLabel).toBe('慢递邮局');
    expect(n.actionText).toBe('去拆信');
    expect(n.resolvedTargetPage).toBe('pages/slow-mail/slow-mail?periodId=p1');
  });

  test('decorates seen_received like like_received', () => {
    const n = pageInstance.decorateNotification.call(pageInstance, {
      _id: 'n_seen',
      type: 'seen_received',
      data: { sectionId: 's1', checkinId: 'c1' }
    });
    expect(n.typeLabel).toBe('被看见');
    expect(n.actionText).toBe('查看打卡详情');
    expect(n.resolvedTargetPage).toContain('pages/course-detail/course-detail?');
    expect(n.resolvedTargetPage).toContain('id=s1');
    expect(n.resolvedTargetPage).toContain('checkinId=c1');
  });

  test('buddy_nudge jumps to targetPage and does not jump without one', () => {
    const withTarget = pageInstance.decorateNotification.call(pageInstance, {
      _id: 'n_buddy',
      type: 'buddy_nudge',
      data: { targetPage: '/pages/buddy/buddy?periodId=p1' }
    });
    expect(withTarget.typeLabel).toBe('读伴');
    expect(withTarget.actionText).toBe('去看看');
    expect(withTarget.resolvedTargetPage).toBe('/pages/buddy/buddy?periodId=p1');

    const without = pageInstance.decorateNotification.call(pageInstance, {
      _id: 'n_buddy2',
      type: 'buddy_nudge',
      data: {}
    });
    expect(without.resolvedTargetPage).toBe('');
  });
});
