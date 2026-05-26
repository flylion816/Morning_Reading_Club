const request = require('../../utils/request');

function formatDate(val) {
  if (!val) return '';
  const d = new Date(val);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

function formatDiscount(coupon) {
  if (coupon.discountType === 'fixed') {
    return `减 ¥${(coupon.discountValue / 100).toFixed(2)}`;
  }
  if (coupon.discountType === 'percent') {
    return `${coupon.discountValue}折`;
  }
  return '';
}

const STATUS_MAP = {
  active: { label: '可使用', cls: 'active' },
  used: { label: '已使用', cls: 'used' },
  expired: { label: '已过期', cls: 'expired' },
  disabled: { label: '已失效', cls: 'expired' }
};

Page({
  data: {
    coupons: [],
    loading: true
  },

  onLoad() {
    this.loadCoupons();
  },

  async loadCoupons() {
    this.setData({ loading: true });
    try {
      const res = await request.get('/activity-coupons/my');
      const list = (res.data || res || []).map(c => {
        const status = STATUS_MAP[c.displayStatus || c.status] || STATUS_MAP.expired;
        return {
          ...c,
          discountDisplay: formatDiscount(c),
          validFromDisplay: formatDate(c.validFrom),
          validUntilDisplay: formatDate(c.validUntil),
          activityTitle: c.activityId ? c.activityId.title : '通用券',
          statusLabel: status.label,
          statusCls: status.cls
        };
      });
      this.setData({ coupons: list });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onPullDownRefresh() {
    this.loadCoupons().then(() => wx.stopPullDownRefresh());
  }
});
