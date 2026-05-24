const communityActivityService = require('../../services/communityActivity.service');

function formatDatetime(val) {
  if (!val) return '';
  const d = new Date(val);
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${mo}月${day}日 ${h}:${m}`;
}

function getDisplayStatus(activity) {
  if (!activity) return { label: '', type: '' };
  const now = Date.now();
  const start = activity.startTime ? new Date(activity.startTime).getTime() : 0;
  const end = activity.endTime ? new Date(activity.endTime).getTime() : 0;
  if (activity.status === 'cancelled') return { label: '已取消', type: 'cancelled' };
  if (end && now > end) return { label: '已结束', type: 'ended' };
  if (start && now >= start) return { label: '进行中', type: 'ongoing' };
  return { label: '即将开始', type: 'upcoming' };
}

Page({
  data: {
    activities: [],
    loading: true
  },

  onLoad() {
    this.loadMyActivities();
  },

  onPullDownRefresh() {
    this.loadMyActivities().then(() => wx.stopPullDownRefresh());
  },

  async loadMyActivities() {
    this.setData({ loading: true });
    try {
      const res = await communityActivityService.getMyActivities();
      const list = (res.data || res).list || (res.data || res) || [];
      const activities = (Array.isArray(list) ? list : []).map(item => {
        const ds = getDisplayStatus(item);
        return {
          ...item,
          startTimeFormatted: formatDatetime(item.startTime),
          statusLabel: ds.label,
          statusType: ds.type
        };
      });
      this.setData({ activities, loading: false });
    } catch (err) {
      console.error('加载我的活动失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  handleGoDetail(e) {
    const activityId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/community-activity-detail/community-activity-detail?activityId=${activityId}` });
  }
});
