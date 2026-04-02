const insightService = require('../../services/insight.service');
const subscribeMessageService = require('../../services/subscribe-message.service');
const subscribeAutoTopUp = require('../../utils/subscribe-auto-topup');
const enrollmentService = require('../../services/enrollment.service');
const { hasPaidEnrollment, redirectAfterCommunityDenied } = require('../../utils/period-access');

const INSIGHT_AUTO_TOP_UP_SCENES = ['insight_request_created'];

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
    item.requestPeriodName || item.periodId?.name || item.periodId?.title || '未知期次';
  const insightTitle =
    item.requestInsightTitle ||
    item.insightId?.sectionId?.title ||
    item.insightId?.title ||
    '学习反馈';
  const insightDay =
    item.requestInsightDay || item.insightId?.day || item.insightId?.sectionId?.day || null;
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
    time: formatRelativeTime(item.createdAt),
    status: item.status,
    statusText: statusInfo.text,
    statusClass: statusInfo.className,
    periodId: item.periodId?._id || item.periodId || null,
    requestMeta: metaParts.join(' · '),
    requestSummary: dayText ? `${periodName} · ${dayText}` : periodName,
    requestInsightTitle: insightTitle,
    canApprove: item.status === 'pending',
    canReject: item.status === 'pending'
  };
}

Page({
  data: {
    requests: [],
    loading: true,
    notificationReminder: ''
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
          requests: [],
          notificationReminder: '',
          loading: false
        });
        redirectAfterCommunityDenied('/pages/profile/profile', '完成支付后可查看');
        return;
      }

      const [requests, notificationReminder] = await Promise.all([
        this.fetchRequests(),
        this.fetchNotificationReminder()
      ]);

      this.setData({
        requests,
        notificationReminder,
        loading: false
      });
    } catch (error) {
      console.error('加载请求页数据失败:', error);
      this.setData({
        requests: [],
        notificationReminder: '',
        loading: false
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  async fetchRequests() {
    const res = await insightService.getReceivedRequests();

    let requests = [];
    if (Array.isArray(res)) {
      requests = res;
    } else if (res && Array.isArray(res.data)) {
      requests = res.data;
    } else if (res && Array.isArray(res.list)) {
      requests = res.list;
    }

    return requests.map(buildInsightRequestDisplay);
  },

  async fetchNotificationReminder() {
    try {
      const response = await subscribeMessageService.getSettings();
      const scene = (response.scenes || []).find(item => item.scene === 'insight_request_created');
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

  async approveRequest(request) {
    try {
      this.triggerAutoTopUp('insight_request_approve', 'prompt');
      const requestId = request._id || request.id;
      await insightService.approveRequest(requestId, { periodId: request.periodId || '' });
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

    const requests = this.data.requests.map(item =>
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

    this.setData({ requests });
  }
});
