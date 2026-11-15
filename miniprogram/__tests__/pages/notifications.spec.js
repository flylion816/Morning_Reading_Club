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

jest.mock('../../services/insight.service', () => ({ approveRequest: jest.fn(), rejectRequest: jest.fn() }));

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

  describe('来信页', () => {
    const raw = (overrides = {}) => ({
      _id: 'n1',
      type: 'like_received',
      isRead: false,
      createdAt: new Date().toISOString(),
      senderId: { _id: 'u1', nickname: '王可心' },
      data: { checkinId: 'c1', sectionId: 's1', sectionTitle: '开营词' },
      ...overrides
    });
    const load = (list) => {
      pageInstance.setData({ notifications: list.map(item => pageInstance.decorateNotification.call(pageInstance, item)) });
      pageInstance.updateDisplayedNotifications.call(pageInstance);
    };

    test('通知整理成按天分组的来信，顶部汇总谁想到了你', () => {
      load([raw(), raw({ _id: 'n2', senderId: { _id: 'u2', nickname: '林泰君' } })]);
      const items = pageInstance.data.feed.reduce((all, g) => all.concat(g.items), []);
      expect(pageInstance.data.feed[0].label).toBe('今天');
      expect(items).toHaveLength(1);
      expect(items[0].ids).toEqual(['n1', 'n2']);
      expect(pageInstance.data.summary.headline).toBe('今天有 2 位书友想到了你');
    });

    test('「等我回应」只留下需要回应的来信', () => {
      load([raw(), raw({ _id: 'n3', type: 'comment_received', senderId: { _id: 'u3', nickname: '赵敏慧' }, data: { checkinId: 'c9', commentPreview: '一起加油。' } })]);
      pageInstance.setData({ activeTab: 'reply' });
      pageInstance.updateDisplayedNotifications.call(pageInstance);
      const items = pageInstance.data.feed.reduce((all, g) => all.concat(g.items), []);
      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('comment_received');
    });

    test('点一张合并的来信：里面所有通知都标为已读，再跳转', () => {
      load([raw(), raw({ _id: 'n2', senderId: { _id: 'u2', nickname: '林泰君' } })]);
      const item = pageInstance.data.feed[0].items[0];
      notificationService.markAsRead.mockClear();
      pageInstance.handleFeedTap.call(pageInstance, { currentTarget: { dataset: { key: item.key } } });
      expect(notificationService.markAsRead).toHaveBeenCalledWith('n1');
      expect(notificationService.markAsRead).toHaveBeenCalledWith('n2');
      expect(wx.navigateTo).toHaveBeenCalled();
    });

    test('长按出菜单：未读有「标为已读」，删除会把合并的通知一起删掉', async () => {
      load([raw(), raw({ _id: 'n2', senderId: { _id: 'u2', nickname: '林泰君' } })]);
      const item = pageInstance.data.feed[0].items[0];
      notificationService.deleteNotification.mockResolvedValue({});
      pageInstance.deleteFeedItem = pageConfig.deleteFeedItem;
      await pageInstance.deleteFeedItem.call({ ...pageInstance, data: pageInstance.data, setData: pageInstance.setData, updateDisplayedNotifications: pageInstance.updateDisplayedNotifications, loadUnreadCount: jest.fn(), getNotificationId: pageInstance.getNotificationId }, item);
      expect(notificationService.deleteNotification).toHaveBeenCalledWith('n1');
      expect(notificationService.deleteNotification).toHaveBeenCalledWith('n2');
    });

    test('申请看见：直接在来信里让 TA 看，处理后显示结果', async () => {
      const insightService = require('../../services/insight.service');
      insightService.approveRequest.mockResolvedValue({});
      load([raw({ _id: 'q1', type: 'request_created', requestId: { _id: 'req1', status: 'pending', requestPeriodName: '连接之力', requestInsightDay: 3, requestInsightTitle: '要事第一' }, data: { periodId: 'p1' } })]);
      const item = pageInstance.data.feed[0].items[0];
      expect(item.request.status).toBe('pending');
      expect(item.quote).toBe('连接之力 · 第 3 课 · 要事第一');
      await pageInstance.handleRequestDecision.call(pageInstance, { currentTarget: { dataset: { key: item.key, decision: 'approve' } } });
      expect(insightService.approveRequest).toHaveBeenCalledWith('req1', { periodId: 'p1' });
      expect(pageInstance.data.feed[0].items[0].request.status).toBe('approved');
    });

    test('重新进入时按申请的真实状态显示：已同意 / 已拒绝 / 记录已不在', () => {
      const req = (status) => raw({ _id: `q_${status}`, type: 'request_created', requestId: { _id: `r_${status}`, status }, senderId: { _id: `u_${status}`, nickname: status } });
      load([req('approved'), req('rejected'), req('pending'), raw({ _id: 'q_gone', type: 'request_created', requestId: null })]);
      const items = pageInstance.data.feed[0].items;
      expect(items.map(i => i.request.status)).toEqual(['approved', 'rejected', 'pending', 'gone']);
      expect(items.map(i => i.needsReply)).toEqual([false, false, true, false]);
    });
  });
});
