const newcomerLeadService = require('../../../services/newcomer-lead.service');
const appDialog = require('../../../utils/dialog');

const STATUS_STEPS = [
  { key: 'pending', label: '待联系' },
  { key: 'contacted', label: '已联系' },
  { key: 'talked', label: '已交流' }
];
const FINAL_TEXT = { connected: '已连接', declined: '暂不连接' };
const STATUS_ORDER = ['pending', 'contacted', 'talked'];
const SOURCE_TEXT = {
  daily_card: '日签',
  quote_card: '金句卡',
  keepsake: '纪念册',
  invite: '邀请',
  other: '直接进入'
};
const NEXT_ACTION = {
  pending: { status: 'contacted', label: '标记为已联系' },
  contacted: { status: 'talked', label: '标记为已交流' }
};

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const sh = new Date(date.getTime() + 8 * 3600000);
  const p = n => String(n).padStart(2, '0');
  return `${sh.getUTCMonth() + 1} 月 ${sh.getUTCDate()} 日 ${p(sh.getUTCHours())}:${p(sh.getUTCMinutes())}`;
}

Page({
  data: {
    id: '',
    loading: true,
    lead: null,
    steps: [],
    finalText: '',
    sourceText: '',
    createdText: '',
    followUps: [],
    nextAction: null,
    canDecide: false,
    note: '',
    busy: false
  },

  onLoad(options = {}) {
    this.setData({ id: options.id || '' });
    this.loadDetail();
  },

  async loadDetail() {
    try {
      const res = await newcomerLeadService.getLeadDetail(this.data.id);
      const lead = res.lead;
      const isFinal = Boolean(FINAL_TEXT[lead.status]);
      const currentIndex = STATUS_ORDER.indexOf(lead.status);
      this.setData({
        loading: false,
        lead,
        steps: STATUS_STEPS.map((step, index) => ({
          ...step,
          state: isFinal || index < currentIndex ? 'done' : index === currentIndex ? 'now' : 'todo'
        })),
        finalText: FINAL_TEXT[lead.status] || '',
        sourceText: lead.inviterName
          ? `${lead.inviterName} 的${SOURCE_TEXT[lead.sourceType] || '分享'}`
          : SOURCE_TEXT[lead.sourceType] || '直接进入',
        createdText: formatDateTime(lead.createdAt),
        followUps: (lead.followUps || []).map(item => ({ ...item, atText: formatDateTime(item.at) })),
        nextAction: lead.isAssignee ? NEXT_ACTION[lead.status] || null : null,
        canDecide: lead.isAssignee && !isFinal
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: '这条找不到了', icon: 'none' });
    }
  },

  handleNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  handleCopyPhone() {
    const phone = this.data.lead && this.data.lead.phone;
    if (!phone) return;
    wx.setClipboardData({ data: phone });
  },

  handleCallPhone() {
    const phone = this.data.lead && this.data.lead.phone;
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: phone });
  },

  async handleClaim() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      await newcomerLeadService.claimLead(this.data.id);
      wx.showToast({ title: '已认领', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '认领失败', icon: 'none' });
    } finally {
      this.setData({ busy: false });
      this.loadDetail();
    }
  },

  async changeStatus(status) {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      await newcomerLeadService.updateLeadStatus(this.data.id, status, this.data.note.trim());
      this.setData({ note: '' });
      wx.showToast({ title: '已更新', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '更新失败', icon: 'none' });
    } finally {
      this.setData({ busy: false });
      this.loadDetail();
    }
  },

  handleNext() {
    if (this.data.nextAction) this.changeStatus(this.data.nextAction.status);
  },

  handleConnected() {
    this.changeStatus('connected');
  },

  handleDeclined() {
    // “暂不连接”之后不再提醒跟进，先确认一下
    appDialog.showModal({
      title: '标记为暂不连接',
      content: '之后不会再提醒你跟进这位书友，由对方决定是否再联系。',
      confirmText: '确认',
      success: res => {
        if (res.confirm) this.changeStatus('declined');
      }
    });
  }
});
