const newcomerLeadService = require('../../services/newcomer-lead.service');

const TABS = [
  { key: 'pending', label: '待接待' },
  { key: 'contacted', label: '已联系' },
  { key: 'talked', label: '已交流' },
  { key: 'connected', label: '已连接' },
  { key: 'declined', label: '暂不连接' }
];

const SOURCE_TEXT = {
  daily_card: '日签',
  quote_card: '金句卡',
  keepsake: '纪念册',
  invite: '邀请',
  other: ''
};

function formatRelative(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function decorate(item, myId) {
  const source = SOURCE_TEXT[item.sourceType] || '';
  let fromText = '没有分享人';
  if (item.inviterName) fromText = `来自 ${item.inviterName}${source ? '的' + source : ''}`;
  else if (source) fromText = `来自${source}`;
  return {
    ...item,
    timeText: formatRelative(item.createdAt),
    fromText,
    claimedByMe: Boolean(item.assigneeId) && String(item.assigneeId) === String(myId)
  };
}

Page({
  data: {
    tabs: TABS,
    activeTab: 'pending',
    counts: {},
    items: [],
    loading: true,
    loadingMore: false,
    hasMore: false,
    page: 1,
    noAccess: false,
    statsText: '',
    topText: '',
    claimingId: ''
  },

  onLoad() {
    const app = getApp();
    const user = (app && app.globalData && app.globalData.userInfo) || {};
    this._myId = user._id || user.id || user.userId || '';
  },

  onShow() {
    // 从详情页回来（认领、改状态后）刷新
    this.loadList();
    this.loadStats();
  },

  // 落地页最近 30 天：访问、留言、转化。失败就不显示，不影响列表
  async loadStats() {
    try {
      const stats = await newcomerLeadService.getStats(30);
      if (!stats) return;
      const parts = [`近 ${stats.days} 天 访问 ${stats.views} 次`, `留言 ${stats.leads} 条`];
      if (stats.conversion !== null && stats.conversion !== undefined) parts.push(`转化 ${stats.conversion}%`);
      if (stats.fromShares) parts.push(`${stats.fromShares} 条来自分享`);
      const top = (stats.topInviters || []).slice(0, 3).map(item => `${item.nickname} ${item.leads}`).join('、');
      this.setData({ statsText: parts.join(' · '), topText: top ? `带来留言最多：${top}` : '' });
    } catch (error) {
      this.setData({ statsText: '', topText: '' });
    }
  },

  onPullDownRefresh() {
    this.loadList().finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    this.handleLoadMore();
  },

  handleTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activeTab) return;
    this.setData({ activeTab: key, items: [], loading: true }, () => this.loadList());
  },

  async loadList() {
    try {
      const res = await newcomerLeadService.listLeads({ status: this.data.activeTab, page: 1 });
      this.setData({
        items: (res.items || []).map(item => decorate(item, this._myId)),
        counts: res.counts || {},
        hasMore: Boolean(res.pagination && res.pagination.hasMore),
        page: 1,
        loading: false
      });
    } catch (error) {
      // 没被配置成接待组：后台用户管理里才能加入
      if (error && (error.code === 403 || /接待组/.test(error.message || ''))) {
        this.setData({ loading: false, noAccess: true, items: [] });
        return;
      }
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败，下拉再试一次', icon: 'none' });
    }
  },

  async handleLoadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.setData({ loadingMore: true });
    try {
      const nextPage = this.data.page + 1;
      const res = await newcomerLeadService.listLeads({ status: this.data.activeTab, page: nextPage });
      this.setData({
        items: this.data.items.concat((res.items || []).map(item => decorate(item, this._myId))),
        hasMore: Boolean(res.pagination && res.pagination.hasMore),
        page: nextPage
      });
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loadingMore: false });
    }
  },

  handleOpenDetail(e) {
    wx.navigateTo({ url: `/pages/admin-leads/detail/detail?id=${e.currentTarget.dataset.id}` });
  },

  async handleClaim(e) {
    const id = e.currentTarget.dataset.id;
    if (this.data.claimingId) return;
    this.setData({ claimingId: id });
    try {
      await newcomerLeadService.claimLead(id);
      wx.navigateTo({ url: `/pages/admin-leads/detail/detail?id=${id}` });
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '认领失败', icon: 'none' });
      this.loadList();
    } finally {
      this.setData({ claimingId: '' });
    }
  }
});
