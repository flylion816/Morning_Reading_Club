const buddyService = require('../../services/buddy.service');
const { requireLogin } = require('../../utils/require-login');

const LOAD_ERROR = '读伴状态没有加载出来';

Page({
  data: {
    periodId: '',
    loading: true,
    loadError: '',
    busy: false,
    state: 'none',
    buddy: null,
    me: { readToday: false, checkedInToday: false },
    canNudge: false,
    nudgedToday: false,
    canJoin: false,
    buddyInitial: ''
  },

  onLoad(options) {
    const periodId = (options && options.periodId) || '';
    this.setData({ periodId });
    if (!periodId) {
      this.setData({ loading: false, loadError: '没有找到这一期' });
      return;
    }
    if (!requireLogin('登录后才能找读伴')) {
      this.setData({ loading: false });
      return;
    }
    this.loadState();
  },

  onPullDownRefresh() {
    this.loadState().then(() => wx.stopPullDownRefresh());
  },

  applyState(res) {
    const data = res || {};
    const buddy = data.buddy || null;
    this.setData({
      loading: false,
      loadError: '',
      state: data.state || 'none',
      buddy,
      me: data.me || { readToday: false, checkedInToday: false },
      canNudge: !!data.canNudge,
      nudgedToday: !!data.nudgedToday,
      canJoin: !!data.canJoin,
      buddyInitial: buddy && buddy.nickname ? Array.from(buddy.nickname)[0] : ''
    });
  },

  async loadState() {
    this.setData({ loading: true, loadError: '' });
    try {
      this.applyState(await buddyService.getState(this.data.periodId));
    } catch (error) {
      this.setData({ loading: false, loadError: (error && error.message) || LOAD_ERROR });
    }
  },

  onRetry() {
    this.loadState();
  },

  async runAction(action, doneTip) {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      this.applyState(await action(this.data.periodId));
      if (doneTip) wx.showToast({ title: doneTip, icon: 'none' });
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '没有成功，请稍后再试', icon: 'none' });
      // 状态可能已变（比如对方已经读过），悄悄刷新一次
      this.loadState();
    } finally {
      this.setData({ busy: false });
    }
  },

  onJoin() {
    this.runAction(id => buddyService.join(id));
  },

  onCancel() {
    this.runAction(id => buddyService.cancel(id));
  },

  onNudge() {
    if (!this.data.canNudge) return;
    this.runAction(id => buddyService.nudge(id), '已轻拍');
  },

  onLeave() {
    wx.showModal({
      title: '结束这段读伴',
      content: '结束后，对方会看到“读伴已结束”。之后你还可以再找一位读伴。',
      confirmText: '结束',
      cancelText: '再想想',
      success: res => {
        if (res.confirm) this.runAction(id => buddyService.leave(id));
      }
    });
  }
});
