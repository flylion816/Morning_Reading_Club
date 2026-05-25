const communityActivityService = require('../../services/communityActivity.service');
const activityService = require('../../services/activity.service');

function formatDatetime(val) {
  if (!val) return '';
  const d = new Date(val);
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${mo}月${day}日 ${h}:${m}`;
}

function getActivityStatus(activity) {
  if (!activity) return '';
  const now = Date.now();
  const start = activity.startTime ? new Date(activity.startTime).getTime() : 0;
  const end = activity.endTime ? new Date(activity.endTime).getTime() : 0;
  if (activity.status === 'cancelled') return 'cancelled';
  if (end && now > end) return 'ended';
  if (start && now >= start) return 'ongoing';
  return 'upcoming';
}

function shouldShowMeeting(activity) {
  if (!activity) return false;
  if (!activity.meetingId && !activity.meetingJoinUrl) return false;
  const now = Date.now();
  const start = activity.startTime ? new Date(activity.startTime).getTime() : 0;
  const end = activity.endTime ? new Date(activity.endTime).getTime() : Infinity;
  return now >= start - 30 * 60 * 1000 && now <= end;
}

Page({
  data: {
    activityId: '',
    activity: null,
    loading: true,
    registered: false,
    registering: false,
    showMeeting: false,
    typeMap: { witness: '见证会', chat: '聊天局', other: '其他' }
  },

  onLoad(options) {
    if (!options.activityId || options.activityId === 'undefined') {
      wx.redirectTo({ url: '/pages/index/index' });
      return;
    }
    this.setData({ activityId: options.activityId });
    this.loadDetail(options.activityId);
  },

  onShow() {
    if (this.data.activityId) {
      this.refreshMeetingVisibility();
    }
  },

  async loadDetail(activityId) {
    this.setData({ loading: true });
    try {
      const res = await communityActivityService.getDetail(activityId);
      const activity = res.data || res;
      const showMeeting = shouldShowMeeting(activity);
      this.setData({
        activity: {
          ...activity,
          startTimeFormatted: formatDatetime(activity.startTime),
          endTimeFormatted: formatDatetime(activity.endTime),
          computedStatus: getActivityStatus(activity)
        },
        registered: activity.isRegistered || false,
        showMeeting,
        loading: false
      });
      wx.setNavigationBarTitle({ title: activity.title || '活动详情' });
    } catch (err) {
      console.error('加载活动详情失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  refreshMeetingVisibility() {
    const showMeeting = shouldShowMeeting(this.data.activity);
    if (showMeeting !== this.data.showMeeting) {
      this.setData({ showMeeting });
    }
  },

  async handleRegister() {
    const app = getApp();
    if (!app.globalData.isLogin) {
      wx.showModal({
        title: '需要登录',
        content: '报名前需要先登录，是否前往登录？',
        confirmText: '去登录',
        cancelText: '再看看',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: `/pages/login/login?redirect=community-activity-detail&activityId=${this.data.activityId}` });
          }
        }
      });
      return;
    }

    this.setData({ registering: true });
    try {
      let reminderGranted = false;
      await new Promise((resolve) => {
        wx.requestSubscribeMessage({
          tmplIds: ['activity_reminder'],
          success(subRes) {
            reminderGranted = subRes['activity_reminder'] === 'accept';
            resolve();
          },
          fail() { resolve(); }
        });
      });

      await communityActivityService.register(this.data.activityId, { reminderGranted });
      this.setData({ registered: true });
      activityService.track('activity_enroll', { targetId: this.data.activityId });
      wx.showToast({ title: '报名成功', icon: 'success' });
      this.loadDetail(this.data.activityId);
    } catch (err) {
      console.error('报名失败:', err);
      wx.showToast({ title: err.message || '报名失败，请重试', icon: 'none' });
    } finally {
      this.setData({ registering: false });
    }
  },

  async handleCancelRegister() {
    wx.showModal({
      title: '取消报名',
      content: '确定要取消报名吗？',
      confirmText: '确定取消',
      cancelText: '再想想',
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ registering: true });
        try {
          await communityActivityService.cancelRegister(this.data.activityId);
          this.setData({ registered: false });
          wx.showToast({ title: '已取消报名', icon: 'success' });
          this.loadDetail(this.data.activityId);
        } catch (err) {
          console.error('取消报名失败:', err);
          wx.showToast({ title: err.message || '取消失败，请重试', icon: 'none' });
        } finally {
          this.setData({ registering: false });
        }
      }
    });
  },

  handleJoinMeeting() {
    const { activity } = this.data;
    wx.navigateTo({
      url: `/pages/meeting-webview/meeting-webview?meetingId=${encodeURIComponent(activity.meetingId || '')}&url=${encodeURIComponent(activity.meetingJoinUrl || '')}`
    });
  },

  handleCopyMeetingId() {
    const meetingId = this.data.activity && this.data.activity.meetingId;
    if (!meetingId) return;
    wx.setClipboardData({
      data: meetingId,
      success() { wx.showToast({ title: '会议号已复制', icon: 'success' }); }
    });
  },

  onShareAppMessage() {
    const { activity, activityId } = this.data;
    return {
      title: activity ? activity.title : '活动详情',
      path: `/pages/community-activity-detail/community-activity-detail?activityId=${activityId}`,
      imageUrl: activity && activity.posterUrl ? activity.posterUrl : ''
    };
  }
});
