const insightService = require('../../services/insight.service');
const subscribeMessageService = require('../../services/subscribe-message.service');
const subscribeAutoTopUp = require('../../utils/subscribe-auto-topup');
const enrollmentService = require('../../services/enrollment.service');
const activityService = require('../../services/activity.service');
const {
  hasPaidEnrollment,
  redirectAfterCommunityDenied
} = require('../../utils/period-access');
const {
  buildInsightRequestDisplay,
  extractInsightRequests
} = require('../../utils/insight-request-display');

const INSIGHT_AUTO_TOP_UP_SCENES = ['insight_request_created'];

Page({
  data: {
    requestDirectionTabs: [
      { value: 'received', label: '收到的' },
      { value: 'sent', label: '我发起的' }
    ],
    activeRequestDirection: 'received',
    receivedRequests: [],
    sentRequests: [],
    requests: [],
    loading: true,
    emptyText: '暂无收到的请求',
    notificationReminder: ''
  },

  onLoad(options = {}) {
    const direction = options.direction === 'sent' ? 'sent' : 'received';
    this.setData({
      activeRequestDirection: direction,
      emptyText: this.getEmptyText(direction)
    });
  },

  onShow() {
    this.loadPageData();
  },

  async loadPageData() {
    this.setData({ loading: true });

    try {
      const userEnrollments = await enrollmentService
        .getUserEnrollments({ limit: 100 })
        .catch(() => ({ list: [] }));
      const enrollmentList = userEnrollments.list || userEnrollments || [];

      if (!hasPaidEnrollment(enrollmentList)) {
        this.setData({
          receivedRequests: [],
          sentRequests: [],
          requests: [],
          emptyText: this.getEmptyText(this.data.activeRequestDirection),
          notificationReminder: '',
          loading: false
        });
        redirectAfterCommunityDenied(
          '/pages/index/index',
          '完成支付后可查看'
        );
        return;
      }

      const [requestGroups, notificationReminder] = await Promise.all([
        this.fetchAllRequests(),
        this.fetchNotificationReminder()
      ]);
      const requests = this.getRequestsForDirection(
        requestGroups,
        this.data.activeRequestDirection
      );

      this.setData({
        receivedRequests: requestGroups.receivedRequests,
        sentRequests: requestGroups.sentRequests,
        requests,
        emptyText: this.getEmptyText(this.data.activeRequestDirection),
        notificationReminder,
        loading: false
      });
    } catch (error) {
      console.error('加载请求页数据失败:', error);
      this.setData({
        receivedRequests: [],
        sentRequests: [],
        requests: [],
        emptyText: this.getEmptyText(this.data.activeRequestDirection),
        notificationReminder: '',
        loading: false
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  async fetchAllRequests() {
    const [receivedResponse, sentResponse] = await Promise.all([
      insightService.getReceivedRequests(),
      insightService.getSentRequests()
    ]);

    return {
      receivedRequests: extractInsightRequests(receivedResponse).map((item) =>
        buildInsightRequestDisplay(item, { direction: 'received' })
      ),
      sentRequests: extractInsightRequests(sentResponse).map((item) =>
        buildInsightRequestDisplay(item, { direction: 'sent' })
      )
    };
  },

  getRequestsForDirection(requestGroups = {}, direction = 'received') {
    return direction === 'sent'
      ? requestGroups.sentRequests || []
      : requestGroups.receivedRequests || [];
  },

  getEmptyText(direction = 'received') {
    return direction === 'sent'
      ? '你还没有发起过看见请求'
      : '暂无收到的请求';
  },

  handleRequestDirectionTap(e) {
    const direction = e.currentTarget.dataset.direction;
    if (!direction || direction === this.data.activeRequestDirection) {
      return;
    }

    const requestGroups = {
      receivedRequests: this.data.receivedRequests,
      sentRequests: this.data.sentRequests
    };

    this.setData({
      activeRequestDirection: direction,
      requests: this.getRequestsForDirection(requestGroups, direction),
      emptyText: this.getEmptyText(direction)
    });
  },

  async fetchNotificationReminder() {
    try {
      const response = await subscribeMessageService.getSettings();
      const scene = (response.scenes || []).find(
        (item) => item.scene === 'insight_request_created'
      );
      const shortage = !scene || scene.availableCount <= 0;
      return shortage ? '新的请求看见提醒未开启或已用完，可去补充。' : '';
    } catch (error) {
      console.warn('加载请求页订阅提醒失败:', error);
      return '';
    }
  },

  navigateToNotificationSettings() {
    this.triggerAutoTopUp('insight_requests_notification_settings', 'prompt');
    wx.navigateTo({
      url: '/pages/notification-settings/notification-settings'
    });
  },

  triggerAutoTopUp(sourceAction, requestMode = 'remembered') {
    subscribeAutoTopUp.maybeAutoTopUpSubscriptions({
      sourceAction,
      sourcePage: 'insight-requests',
      sceneKeys: INSIGHT_AUTO_TOP_UP_SCENES,
      requestMode
    });
  },

  handleApproveRequest(e) {
    const { request } = e.currentTarget.dataset;
    this.approveRequest(request);
  },

  handleRejectRequest(e) {
    const { request } = e.currentTarget.dataset;
    this.rejectRequest(request);
  },

  handleRequestTap(e) {
    this.triggerAutoTopUp('insight_request_tap', 'prompt');

    const { request } = e.currentTarget.dataset;
    if (!request?.canNavigate) {
      return;
    }

    const userId = request?.displayUserId;
    const periodId = request?.periodId;

    if (!userId) {
      console.warn('请求记录缺少展示用户ID，无法跳转');
      return;
    }

    let url = `/pages/profile-others/profile-others?userId=${userId}`;
    if (periodId) {
      url += `&periodId=${periodId}`;
    }

    wx.navigateTo({ url });
  },

  handleRequestAvatarClick(e) {
    const { request, userId, periodId } = e.currentTarget.dataset;
    if (request && !request.canNavigate) {
      return;
    }

    if (!userId) {
      return;
    }

    let url = `/pages/profile-others/profile-others?userId=${userId}`;
    if (periodId) {
      url += `&periodId=${periodId}`;
    }

    wx.navigateTo({ url });
  },

  async approveRequest(request) {
    try {
      this.triggerAutoTopUp('insight_request_approve', 'prompt');
      const requestId = request._id || request.id;
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
      this.updateRequestStatus(requestId, 'approved');
      wx.showToast({ title: '已批准申请', icon: 'success' });
    } catch (error) {
      console.error('批准申请失败:', error);
      wx.showToast({ title: '批准失败', icon: 'none' });
    }
  },

  async rejectRequest(request) {
    try {
      this.triggerAutoTopUp('insight_request_reject', 'prompt');
      const requestId = request._id || request.id;
      await insightService.rejectRequest(requestId, { reason: '暂不同意' });
      this.updateRequestStatus(requestId, 'rejected');
      wx.showToast({ title: '已拒绝申请', icon: 'success' });
    } catch (error) {
      console.error('拒绝申请失败:', error);
      wx.showToast({ title: '拒绝失败', icon: 'none' });
    }
  },

  updateRequestStatus(requestId, nextStatus) {
    const statusMap = {
      approved: { text: '已同意', className: 'approved' },
      rejected: { text: '已拒绝', className: 'rejected' }
    };
    const statusInfo = statusMap[nextStatus];
    if (!statusInfo) return;

    const requests = this.data.requests.map((item) =>
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

    const receivedRequests = this.data.receivedRequests.map((item) =>
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

    this.setData({ requests, receivedRequests });
  }
});
