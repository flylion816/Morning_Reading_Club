const communityActivityService = require('../../services/communityActivity.service');

const PAGE_SIZE = 10;

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
  const now = Date.now();
  const start = activity.startTime ? new Date(activity.startTime).getTime() : 0;
  const end = activity.endTime ? new Date(activity.endTime).getTime() : 0;
  if (activity.status === 'cancelled') return { label: '已取消', type: 'cancelled' };
  if (end && now > end) return { label: '已结束', type: 'ended' };
  if (start && now >= start) return { label: '进行中', type: 'ongoing' };
  return { label: '即将开始', type: 'upcoming' };
}

function formatItems(items) {
  return items.map(a => {
    const ds = getDisplayStatus(a);
    return { ...a, startTimeFormatted: formatDatetime(a.startTime), statusLabel: ds.label, statusType: ds.type };
  });
}

Page({
  data: {
    activities: [],
    loading: true,
    loadingMore: false,
    hasMore: false,
    page: 1
  },

  onLoad() {
    this.loadActivities(1);
  },

  onPullDownRefresh() {
    this.loadActivities(1).then(() => wx.stopPullDownRefresh());
  },

  async loadActivities(page) {
    if (page === 1) this.setData({ loading: true });
    try {
      const res = await communityActivityService.getList({ page, limit: PAGE_SIZE, sort: 'desc' });
      const data = res && (res.data || res);
      const items = (data && (data.list || data.items || (Array.isArray(data) ? data : []))) || [];
      const total = (data && data.total) || 0;
      const formatted = formatItems(items);
      const activities = page === 1 ? formatted : this.data.activities.concat(formatted);
      const hasMore = activities.length < total;
      this.setData({ activities, hasMore, page, loading: false, loadingMore: false });
    } catch (err) {
      console.error('加载活动列表失败:', err);
      this.setData({ loading: false, loadingMore: false });
      wx.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;
    this.setData({ loadingMore: true });
    this.loadActivities(this.data.page + 1);
  },

  handleGoDetail(e) {
    const activityId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/community-activity-detail/community-activity-detail?activityId=${activityId}` });
  }
});
