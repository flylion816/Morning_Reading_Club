/**
 * 通知页面
 *
 * 支持两种通知更新模式：
 * 1. WebSocket 实时推送（有新通知立即显示）
 * 2. 重新进入页面时刷新列表
 */

const notificationServiceModule = require('../../services/notification.service');
const appDialog = require('../../utils/dialog');
const websocketServiceModule = require('./websocket.service');
const constants = require('../../config/constants');
const { getLastTextChar, getUserAvatarDisplay } = require('../../utils/avatar');
const { tenantStorage } = require('../../utils/storage');
const { THEME_PRIMARY } = require('../../utils/theme');
const insightService = require('../../services/insight.service');
const buddyService = require('../../services/buddy.service');
const joyNoteService = require('../../services/joy-note.service');
const { buildFeed, summarizeFeed } = require('./notification-feed');

const notificationService = notificationServiceModule.default || notificationServiceModule;
const websocketService = websocketServiceModule.default || websocketServiceModule;

// 新增通知类型的展示（线性印章字 + 类型名），不依赖 notification.service
const FEATURE_TYPE_META = {
  letter_delivered: { icon: '信', label: '慢递邮局' },
  awareness_revisit: { icon: '觉', label: '觉察日记' },
  seen_received: { icon: '见', label: '被看见' },
  buddy_nudge: { icon: '伴', label: '读伴' },
  buddy_highfive: { icon: '伴', label: '读伴' },
  buddy_gift: { icon: '伴', label: '读伴' },
  buddy_checkin: { icon: '伴', label: '读伴' },
  buddy_reaction: { icon: '伴', label: '读伴' },
  buddy_invite: { icon: '伴', label: '读伴' },
  buddy_invite_accepted: { icon: '伴', label: '读伴' },
  buddy_ended: { icon: '伴', label: '读伴' },
  newcomer_shared: { icon: '享', label: '来信' }
};

function buildQueryString(params = {}) {
  return Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
}

Page({
  data: {
    notifications: [],
    displayedNotifications: [],
    // 来信：按天分组的卡片，和顶部那句话
    feed: [],
    summary: { headline: '', sub: '', avatars: [], unreadCount: 0, replyCount: 0 },
    handledRequests: {},
    handledInvites: {},
    // 觉察回访：笔记里的「择」和回访状态（通知本身不带笔记文字），以及在来信里处理过的结果
    revisitCards: {},
    handledRevisits: {},
    unreadCount: 0,
    activeTab: 'all',
    page: 1,
    // 一页多取一些：点赞、读伴互动这类要合并的来信，不容易被分页切开
    limit: 50,
    hasMore: true,
    loading: false,
    error: null,
    useWebSocket: false,
    wsUnsubscribe: null,
    themePrimaryColor: THEME_PRIMARY
  },

  onLoad() {
    this._skipNextShowRefresh = true;
    this.refreshNotifications();
  },

  onShow() {
    if (this._skipNextShowRefresh) {
      this._skipNextShowRefresh = false;
      return;
    }

    this.refreshNotifications();
  },

  onPullDownRefresh() {
    this.refreshNotifications().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (!this.data.loading && this.data.hasMore) {
      this.handleLoadMore();
    }
  },

  onUnload() {
    if (this.data.wsUnsubscribe) {
      this.data.wsUnsubscribe();
    }
    websocketService.disconnect();
  },

  refreshNotifications() {
    return Promise.all([this.loadNotifications(false), this.loadUnreadCount()]);
  },

  isImageSource(value = '') {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return false;
    }

    return /^(https?:\/\/|wxfile:\/\/|cloud:\/\/|data:image\/|\/)/i.test(normalized);
  },

  resolveSenderAvatar(notification = {}) {
    const sender = notification?.displaySender || notification?.senderId || {};
    const candidates = [sender?.avatarUrl, notification?.data?.senderAvatar]
      .filter(value => value !== null && value !== undefined && String(value).trim());

    const imageSource = candidates.find(value => this.isImageSource(value));
    if (imageSource) {
      return {
        image: String(imageSource).trim(),
        text: ''
      };
    }

    return {
      image: '',
      text: ''
    };
  },

  getNotificationRequestId(notification = {}) {
    return (
      notification?.requestId?._id ||
      notification?.requestId ||
      notification?.data?.insightRequestId ||
      ''
    );
  },

  // pending 待处理 / approved 已同意 / rejected 已拒绝 / revoked 已撤销；查不到申请记录时按已处理算
  getRequestStatus(notification = {}) {
    if (notification.type !== 'request_created') return '';
    const request = notification.requestId;
    if (!request || typeof request !== 'object') return 'gone';
    return request.status || 'gone';
  },

  getRequestLesson(notification = {}) {
    const request = notification.requestId;
    if (!request || typeof request !== 'object') return notification?.data?.periodName || '';
    const day = request.requestInsightDay;
    const title = request.requestInsightTitle || '';
    const hasLesson = /第[一二三四五六七八九十0-9]+[天课]/.test(title);
    const dayText = day !== null && day !== undefined && !hasLesson ? `第 ${day} 课` : '';
    return [request.requestPeriodName, dayText, title].filter(Boolean).join(' · ');
  },

  getNotificationId(notification = {}) {
    const id =
      notification?._id ||
      notification?.id ||
      notification?.notificationId ||
      notification?.data?.notificationId ||
      '';

    return id ? String(id) : '';
  },

  findNotificationFromEvent(event = {}) {
    const { id, index } = event.currentTarget?.dataset || {};
    const idText = id ? String(id) : '';

    if (idText) {
      const matched = this.data.notifications.find(
        item => this.getNotificationId(item) === idText
      );
      if (matched) {
        return matched;
      }
    }

    const itemIndex = Number(index);
    if (Number.isInteger(itemIndex) && itemIndex >= 0) {
      const displayedNotification = this.data.displayedNotifications[itemIndex];
      if (displayedNotification) {
        return displayedNotification;
      }
    }

    return null;
  },

  getNotificationTargetUser(notification = {}) {
    const sender = notification?.senderId || {};
    return {
      userId:
        notification?.data?.targetUserId ||
        sender?._id ||
        sender?.id ||
        notification?.senderId ||
        '',
      userName:
        notification?.data?.targetUserName ||
        notification?.data?.senderName ||
        sender?.nickname ||
        ''
    };
  },

  getNotificationPeriodId(notification = {}) {
    return notification?.data?.periodId || '';
  },

  buildProfileOthersTargetPage(userId, params = {}) {
    if (!userId) {
      return '';
    }

    const query = buildQueryString({
      userId,
      ...params
    });

    return query
      ? `pages/profile-others/profile-others?${query}`
      : 'pages/profile-others/profile-others';
  },

  normalizeTargetPage(targetPage = '') {
    return String(targetPage || '').replace(/^\/+/, '').trim();
  },

  getTabPagePath(targetPage = '') {
    return this.normalizeTargetPage(targetPage).split('?')[0];
  },

  isTabPage(pagePath = '') {
    return ['pages/index/index', 'pages/periods/periods'].includes(pagePath);
  },

  fallbackNavigateToTarget(targetPage = '') {
    const normalized = this.normalizeTargetPage(targetPage);
    if (!normalized) {
      return;
    }

    wx.reLaunch({
      url: `/${normalized}`,
      fail: error => {
        console.error('通知跳转失败:', error);
        wx.showToast({
          title: '跳转失败，请从底部首页进入',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  navigateByTargetPage(targetPage = '') {
    const normalized = this.normalizeTargetPage(targetPage);
    if (!normalized) {
      return;
    }

    const pagePath = this.getTabPagePath(normalized);
    if (this.isTabPage(pagePath)) {
      wx.switchTab({
        url: `/${pagePath}`,
        fail: error => {
          console.warn('通知 switchTab 失败，尝试 reLaunch:', error);
          this.fallbackNavigateToTarget(normalized);
        }
      });
      return;
    }

    wx.navigateTo({
      url: `/${normalized}`,
      fail: error => {
        console.warn('通知 navigateTo 失败，尝试 reLaunch:', error);
        this.fallbackNavigateToTarget(normalized);
      }
    });
  },

  resolveNotificationTarget(notification = {}) {
    const { type } = notification;

    if (type === 'request_created') {
      return 'pages/index/index';
    }

    const directTarget = notification?.data?.targetPage;
    if (directTarget) {
      return directTarget;
    }

    const sectionId = notification?.data?.sectionId || '';
    const checkinId = notification?.data?.checkinId || '';
    const commentId = notification?.data?.commentId || '';
    const replyId = notification?.data?.replyId || '';
    const requestId = this.getNotificationRequestId(notification);
    const periodId = this.getNotificationPeriodId(notification);
    const targetUser = this.getNotificationTargetUser(notification);

    if (sectionId && checkinId && ['comment_received', 'like_received', 'seen_received'].includes(type)) {
      const query = buildQueryString({
        id: sectionId,
        checkinId,
        focus: 'comments',
        commentId,
        replyId
      });
      return `pages/course-detail/course-detail?${query}`;
    }

    // 觉察回访：点开卡片去详情，输入框已经打开，直接写后来
    if (type === 'awareness_revisit' && notification?.data?.joyNoteId) {
      return `pages/joy-notes/detail/detail?id=${encodeURIComponent(notification.data.joyNoteId)}&focus=1`;
    }

    if (type === 'letter_delivered' && periodId) {
      return `pages/slow-mail/slow-mail?periodId=${encodeURIComponent(periodId)}`;
    }

    if (['request_approved', 'admin_approved'].includes(type) && targetUser.userId) {
      return this.buildProfileOthersTargetPage(targetUser.userId, { periodId });
    }

    if (
      ['request_rejected', 'admin_rejected', 'permission_revoked'].includes(type) &&
      targetUser.userId
    ) {
      return this.buildProfileOthersTargetPage(targetUser.userId, { periodId });
    }

    if (['enrollment_result', 'payment_result'].includes(type)) {
      return 'pages/periods/periods';
    }

    if (requestId) {
      return 'pages/insight-requests/insight-requests';
    }

    return '';
  },

  getNotificationActionText(notification = {}) {
    const actionTextMap = {
      comment_received: '查看打卡详情',
      like_received: '查看打卡详情',
      seen_received: '查看打卡详情',
      letter_delivered: '去拆信',
      awareness_revisit: '写一句后来',
      buddy_nudge: '去看看',
      buddy_highfive: '去看看',
      buddy_gift: '去看看',
      buddy_checkin: '去读一读',
      buddy_reaction: '去看看',
      buddy_invite: '',
      buddy_invite_accepted: '去看看',
      insight_liked: '查看小凡看见',
      danmaku_received: '查看小凡看见',
      request_created: '去首页处理',
      request_approved: '查看对方小凡看见',
      admin_approved: '查看对方小凡看见',
      request_rejected: '查看申请状态',
      admin_rejected: '查看申请状态',
      permission_revoked: '查看申请状态',
      enrollment_result: '查看课程首页',
      payment_result: '查看课程首页',
      insight_created: '查看小凡看见'
    };

    return actionTextMap[notification?.type] || '';
  },

  decorateNotification(notification = {}) {
    const featureMeta = FEATURE_TYPE_META[notification?.type];
    const sender = notification?.displaySender || notification?.senderId || {};
    const senderName = sender?.nickname || notification?.data?.senderName || '';
    const senderAvatar = this.resolveSenderAvatar(notification);
    const senderUserId =
      sender?._id ||
      sender?.id ||
      notification?.data?.senderId ||
      (typeof notification?.senderId === 'string' ? notification.senderId : '') ||
      '';
    const senderAvatarDisplay = getUserAvatarDisplay(
      {
        _id: senderUserId,
        nickname: senderName,
        avatar: sender?.avatar,
        avatarUrl: senderAvatar.image
      },
      { userId: senderUserId, displayName: senderName || '用户' }
    );

    return {
      ...notification,
      typeIcon: featureMeta ? featureMeta.icon : notificationService.getTypeIcon(notification.type),
      typeLabel: featureMeta ? featureMeta.label : notificationService.getTypeLabel(notification.type),
      typeColor: featureMeta ? THEME_PRIMARY : notificationService.getTypeColor(notification.type),
      formattedTime: notificationService.formatTime(notification.createdAt),
      senderName,
      senderAvatar: senderAvatar.image,
      senderAvatarText: senderAvatar.text || senderAvatarDisplay.avatarText,
      senderInitial: getLastTextChar(senderName, '用'),
      senderAvatarColor: senderAvatarDisplay.avatarColor,
      senderUserId,
      // 申请看见：申请现在的状态、申请的是哪一期哪一课（接口会带上申请记录）
      requestStatus: this.getRequestStatus(notification),
      requestLesson: this.getRequestLesson(notification),
      notificationIdValue: this.getNotificationId(notification),
      requestIdValue: this.getNotificationRequestId(notification),
      periodIdValue: this.getNotificationPeriodId(notification),
      resolvedTargetPage: this.resolveNotificationTarget(notification),
      actionText: this.getNotificationActionText(notification)
    };
  },

  async initWebSocket() {
    try {
      const userInfo = tenantStorage.get(constants.STORAGE_KEYS.USER_INFO);
      if (!userInfo || !userInfo._id) {
        console.warn('[NotificationsPage] 用户信息不存在，WebSocket 不可用');
        return;
      }

      await websocketService.connect(userInfo._id);

      const unsubscribe = websocketService.on('notification:new', notification => {
        const updatedNotifications = [
          this.decorateNotification({
            _id: notification.notificationId || Math.random().toString(36).slice(2, 11),
            type: notification.type,
            title: notification.title,
            content: notification.content,
            isRead: false,
            createdAt: notification.timestamp || new Date().toISOString(),
            data: notification.data || {}
          }),
          ...this.data.notifications
        ];

        this.setData({
          notifications: updatedNotifications,
          useWebSocket: true
        });
        this.updateDisplayedNotifications();
        this.loadUnreadCount();
      });

      this.setData({ wsUnsubscribe: unsubscribe, useWebSocket: true });
    } catch (error) {
      console.warn('[NotificationsPage] WebSocket 初始化失败，使用刷新模式:', error);
    }
  },

  async loadNotifications(append = false) {
    if (this.data.loading) {
      return;
    }

    this.setData({ loading: true, error: null });

    try {
      const page = append ? this.data.page + 1 : 1;
      const response = await notificationService.getNotifications(
        page,
        this.data.limit,
        // 「等我回应」是页面里按类型筛的，接口仍然取全部
        this.data.activeTab === 'reply' ? 'all' : this.data.activeTab
      );
      const notifications = (response?.notifications || []).map(item => this.decorateNotification(item));
      const pagination = response?.pagination || { page, totalPages: 1 };

      this.setData({
        notifications: append ? [...this.data.notifications, ...notifications] : notifications,
        page: pagination.page || page,
        hasMore: (pagination.page || page) < (pagination.totalPages || 1),
        loading: false
      });

      this.updateDisplayedNotifications();
      await this.loadRevisitCards();
    } catch (error) {
      console.error('加载通知失败:', error);
      this.setData({
        error: error.message || '没加载出来，稍后再试试',
        loading: false
      });
    }
  },

  async loadUnreadCount() {
    try {
      const response = await notificationService.getUnreadCount();
      this.setData({ unreadCount: response?.unreadCount || 0 });
    } catch (error) {
      console.error('加载未读数量失败:', error);
    }
  },

  updateDisplayedNotifications() {
    const { notifications, activeTab, handledRequests, handledInvites } = this.data;
    const mergeRevisit = item => this.mergeRevisit(item);
    let displayed = notifications;

    if (activeTab === 'true') {
      displayed = notifications.filter(item => item.isRead);
    } else if (activeTab === 'false') {
      displayed = notifications.filter(item => !item.isRead);
    }

    // 来信卡片：申请看见在页面里处理过的，显示处理结果
    const applyHandled = groups =>
      groups.map(group => ({
        ...group,
        items: group.items.map(item => {
          if (item.request && handledRequests[item.request.requestId]) {
            return { ...item, request: { ...item.request, status: handledRequests[item.request.requestId] }, needsReply: false };
          }
          if (item.invite && handledInvites[item.invite.inviteId]) {
            return { ...item, invite: { ...item.invite, status: handledInvites[item.invite.inviteId] }, needsReply: false };
          }
          if (item.revisit) return this.mergeRevisit(item);
          return item;
        })
      }));

    let feed = applyHandled(buildFeed(displayed));
    if (activeTab === 'reply') {
      feed = feed
        .map(group => ({
          ...group,
          items: group.items.filter(item => item.needsReply && (item.unread || (item.request && item.request.status === 'pending') || (item.invite && item.invite.status === 'pending')))
        }))
        .filter(group => group.items.length > 0);
    }

    this.setData({
      displayedNotifications: displayed,
      feed,
      summary: summarizeFeed(applyHandled(buildFeed(notifications)))
    });
  },

  handleTabChange(event) {
    const tab = event.currentTarget.dataset.tab;
    if (tab !== this.data.activeTab) {
      this.setData({ activeTab: tab, page: 1 });
      this.loadNotifications();
    }
  },

  markNotificationAsReadInBackground(notification = {}) {
    const notificationId = this.getNotificationId(notification);
    if (!notificationId || notification.isRead) {
      return;
    }

    const updatedNotifications = this.data.notifications.map(item =>
      this.getNotificationId(item) === notificationId
        ? this.decorateNotification({
            ...item,
            isRead: true,
            readAt: new Date().toISOString()
          })
        : item
    );

    this.setData({
      notifications: updatedNotifications,
      unreadCount: Math.max((this.data.unreadCount || 0) - 1, 0)
    });
    this.updateDisplayedNotifications();

    notificationService
      .markAsRead(notificationId)
      .then(() => {
        this.loadUnreadCount();
      })
      .catch(error => {
        console.error('标记为已读失败:', error);
        this.loadUnreadCount();
      });
  },

  handleNotificationTap(event) {
    const notification = this.findNotificationFromEvent(event);

    if (!notification) {
      console.warn('通知点击缺少可识别的通知数据:', event.currentTarget?.dataset || {});
      return;
    }

    const targetPage = notification.resolvedTargetPage || this.resolveNotificationTarget(notification);
    this.markNotificationAsReadInBackground(notification);

    if (targetPage) {
      this.navigateByTargetPage(targetPage);
    }
  },

  handleNotificationActionTap(event) {
    this.handleNotificationTap(event);
  },

  handleSenderAvatarTap(event) {
    const { userId, periodId } = event.currentTarget?.dataset || {};
    const resolvedUserId = event.detail?.userId || userId;
    const resolvedPeriodId = event.detail?.periodIdValue || periodId;
    if (!resolvedUserId) {
      return;
    }

    const targetPage = this.buildProfileOthersTargetPage(resolvedUserId, { periodId: resolvedPeriodId });
    this.navigateByTargetPage(targetPage);
  },

  handleMarkAllAsRead() {
    if (this.data.unreadCount <= 0) {
      return;
    }

    appDialog.showModal({
      title: '标记全部已读',
      content: '将所有通知标记为已读？',
      confirmText: '标记',
      cancelText: '取消',
      success: async res => {
        if (!res.confirm) {
          return;
        }

        try {
          await notificationService.markAllAsRead();
          const updated = this.data.notifications
            .map(item => ({
              ...item,
              isRead: true,
              readAt: new Date().toISOString()
            }))
            .map(item => this.decorateNotification(item));
          this.setData({ notifications: updated, unreadCount: 0 });
          this.updateDisplayedNotifications();
          this.loadUnreadCount();

          wx.showToast({
            title: '已标记为已读',
            icon: 'success',
            duration: 1500
          });
        } catch (error) {
          console.error('标记全部已读失败:', error);
          wx.showToast({
            title: '没成功，再试一次',
            icon: 'error',
            duration: 1500
          });
        }
      }
    });
  },

  findFeedItem(key) {
    for (const group of this.data.feed) {
      const hit = group.items.find(item => item.key === key);
      if (hit) return hit;
    }
    return null;
  },

  // 点一张来信：把合并在里面的所有通知都标为已读，再跳到对应页面
  handleFeedTap(event) {
    const item = this.findFeedItem(event.currentTarget?.dataset?.key);
    if (!item) return;
    item.ids.forEach(id => {
      const notification = this.data.notifications.find(entry => this.getNotificationId(entry) === id);
      if (notification) this.markNotificationAsReadInBackground(notification);
    });
    if (item.target) {
      const target = item.revisit && item.revisit.state !== 'open' ? item.target.replace('&focus=1', '') : item.target;
      this.navigateByTargetPage(target);
    }
  },

  // 长按：标为已读 / 删除（不再每条都放一个删除叉）
  handleFeedLongPress(event) {
    const item = this.findFeedItem(event.currentTarget?.dataset?.key);
    if (!item) return;
    const itemList = item.unread ? ['标为已读', '删除这条消息'] : ['删除这条消息'];
    appDialog.showActionSheet({
      itemList,
      success: res => {
        const picked = itemList[res.tapIndex];
        if (picked === '标为已读') {
          item.ids.forEach(id => {
            const notification = this.data.notifications.find(entry => this.getNotificationId(entry) === id);
            if (notification) this.markNotificationAsReadInBackground(notification);
          });
        } else if (picked === '删除这条消息') {
          this.deleteFeedItem(item);
        }
      }
    });
  },

  async deleteFeedItem(item) {
    try {
      await Promise.all(item.ids.map(id => notificationService.deleteNotification(id)));
      const removed = new Set(item.ids);
      this.setData({ notifications: this.data.notifications.filter(entry => !removed.has(this.getNotificationId(entry))) });
      this.updateDisplayedNotifications();
      this.loadUnreadCount();
      wx.showToast({ title: '已删除', icon: 'none' });
    } catch (error) {
      console.error('删除通知失败:', error);
      wx.showToast({ title: '没删掉，再试一次', icon: 'none' });
    }
  },

  // 申请看见：直接在来信里让 TA 看 / 先不了，不用再跳去首页
  async handleRequestDecision(event) {
    const { key, decision } = event.currentTarget?.dataset || {};
    const item = this.findFeedItem(key);
    if (!item || !item.request || !item.request.requestId) {
      if (item && item.target) this.navigateByTargetPage(item.target);
      return;
    }
    const { requestId } = item.request;
    if (this._decidingRequest) return;
    this._decidingRequest = true;
    try {
      if (decision === 'approve') {
        await insightService.approveRequest(requestId, { periodId: item.periodId || '' });
      } else {
        await insightService.rejectRequest(requestId, { reason: '暂不同意' });
      }
      this.setData({
        handledRequests: { ...this.data.handledRequests, [requestId]: decision === 'approve' ? 'approved' : 'rejected' }
      });
      item.ids.forEach(id => {
        const notification = this.data.notifications.find(entry => this.getNotificationId(entry) === id);
        if (notification) this.markNotificationAsReadInBackground(notification);
      });
      this.updateDisplayedNotifications();
      wx.showToast({ title: decision === 'approve' ? '已让 TA 看' : '已婉拒', icon: 'none' });
    } catch (error) {
      console.error('处理申请失败:', error);
      wx.showToast({ title: '没处理成，再试一次', icon: 'none' });
    } finally {
      this._decidingRequest = false;
    }
  },

  // 读伴邀请：直接在来信里同意 / 婉拒
  async handleInviteDecision(event) {
    const { key, decision } = event.currentTarget?.dataset || {};
    const item = this.findFeedItem(key);
    if (!item || !item.invite) return;
    if (this._decidingInvite) return;
    this._decidingInvite = true;
    const accept = decision === 'approve';
    try {
      await buddyService.respondInvite(item.invite.periodId, item.invite.inviteId, accept);
      this.setData({
        handledInvites: { ...this.data.handledInvites, [item.invite.inviteId]: accept ? 'accepted' : 'declined' }
      });
      item.ids.forEach(id => {
        const notification = this.data.notifications.find(entry => this.getNotificationId(entry) === id);
        if (notification) this.markNotificationAsReadInBackground(notification);
      });
      this.updateDisplayedNotifications();
      wx.showToast({ title: accept ? '你们成为读伴了' : '已婉拒', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '没处理成，再试一次', icon: 'none' });
      this.loadNotifications(false);
    } finally {
      this._decidingInvite = false;
    }
  },

  // 觉察回访：把笔记里的「择」和回访状态合进来信卡片。通知本身不带笔记文字，卡片内容来自单独的读取
  mergeRevisit(item) {
    const { revisitCards, handledRevisits } = this.data;
    const noteId = item.revisit.noteId;
    const card = revisitCards[noteId];
    const handled = handledRevisits[noteId];
    let state = 'loading';
    if (handled) state = handled;
    else if (card && card.gone) state = 'gone';
    else if (card) {
      state = ['pending', 'delivering', 'delivered'].includes(card.status)
        ? 'open'
        : card.status === 'answered' ? 'answered' : 'skipped';
    }
    const known = card && !card.gone;
    return {
      ...item,
      revisit: {
        ...item.revisit,
        state,
        open: state === 'open',
        choice: known ? card.choice : '',
        lastFollowUp: known ? card.lastFollowUp : ''
      },
      needsReply: state === 'open' || state === 'loading'
    };
  },

  // 一次读取这批来信里所有回访卡片（接口一次最多 10 张）；读不到也不影响来信，点开卡片照样能去详情
  async loadRevisitCards() {
    const ids = [];
    this.data.feed.forEach(group => group.items.forEach(item => {
      if (item.revisit && item.revisit.noteId && ids.indexOf(item.revisit.noteId) < 0) ids.push(item.revisit.noteId);
    }));
    if (!ids.length) return;
    try {
      const cards = { ...this.data.revisitCards };
      const chunks = [];
      for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
      const results = await Promise.all(chunks.map(chunk => joyNoteService.getRevisitCards(chunk)));
      chunks.forEach(chunk => {
        // 没返回的就是那条觉察已经删除了
        chunk.forEach(id => { cards[id] = { gone: true }; });
      });
      results.forEach(result => {
        ((result && result.list) || []).forEach(card => {
          cards[String(card.id)] = {
            gone: false,
            choice: card.choice || '',
            status: card.status,
            followUpCount: card.followUpCount || 0,
            lastFollowUp: card.lastFollowUp || ''
          };
        });
      });
      this.setData({ revisitCards: cards });
      this.updateDisplayedNotifications();
    } catch (error) {
      console.warn('读取回访卡片失败:', error);
    }
  },

  // 写一句后来：去觉察详情，输入框已经打开
  handleRevisitWrite(event) {
    const item = this.findFeedItem(event.currentTarget?.dataset?.key);
    if (!item || !item.revisit) return;
    item.ids.forEach(id => {
      const notification = this.data.notifications.find(entry => this.getNotificationId(entry) === id);
      if (notification) this.markNotificationAsReadInBackground(notification);
    });
    if (item.target) this.navigateByTargetPage(item.target);
  },

  // 先不写：这条觉察不再回访
  async handleRevisitSkip(event) {
    const item = this.findFeedItem(event.currentTarget?.dataset?.key);
    if (!item || !item.revisit || this._decidingRevisit) return;
    this._decidingRevisit = true;
    const { noteId } = item.revisit;
    try {
      const result = await joyNoteService.skipRevisit(noteId);
      this.setData({
        handledRevisits: { ...this.data.handledRevisits, [noteId]: result && result.status === 'answered' ? 'answered' : 'skipped' }
      });
      item.ids.forEach(id => {
        const notification = this.data.notifications.find(entry => this.getNotificationId(entry) === id);
        if (notification) this.markNotificationAsReadInBackground(notification);
      });
      this.updateDisplayedNotifications();
      wx.showToast({ title: '好的，不再提醒', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '没处理成，再试一次', icon: 'none' });
    } finally {
      this._decidingRevisit = false;
    }
  },

  handleGoRead() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  stopPropagation() {},

  handleLoadMore() {
    this.loadNotifications(true);
  }
});
