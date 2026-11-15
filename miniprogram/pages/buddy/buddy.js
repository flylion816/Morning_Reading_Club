const buddyService = require('../../services/buddy.service');
const appDialog = require('../../utils/dialog');
const { requireLogin } = require('../../utils/require-login');
const { getUserAvatarDisplay } = require('../../utils/avatar');
const { getMoodOption } = require('../../utils/mood');

const LOAD_ERROR = '读伴状态没有加载出来';

// 轻拍的预设短句（key 与后端 NUDGE_MESSAGES 一致）
const NUDGE_OPTIONS = [
  { key: 'together', text: '在等你一起读' },
  { key: 'slow', text: '不急，慢慢来' },
  { key: 'cheer', text: '今天也辛苦了' },
  { key: 'tomorrow', text: '明早见' }
];

// 送一句的预设短句（key 与后端 GIFT_MESSAGES 一致，不开放自由输入）
const GIFT_OPTIONS = [
  { key: 'here', text: '今天有你一起读，真好。' },
  { key: 'reread', text: '你写的那段，我读了两遍。' },
  { key: 'noRush', text: '不用赶，我在这儿。' },
  { key: 'tomorrow', text: '明天还在老地方见。' }
];

function describeStatus(status = {}) {
  if (status.checkedInToday) return '读完 · 已打卡';
  if (status.readToday) return '读完了';
  return '今天还没读';
}

// 同行卡下面那一句话：只说今天的情形
function describeHeroNote(data) {
  const { me = {}, buddy = {}, bothDone, canHighFive, canNudge, nudgedToday } = data;
  if (bothDone) return canHighFive ? '今天你们都读完了，击个掌吧' : '今天你们都读完了';
  if (me.readToday && !buddy.readToday) {
    if (canNudge) return '你先到了，轻轻拍一下 TA';
    if (nudgedToday) return '已经拍过了，TA 会收到';
    return '你先到了，TA 还没来';
  }
  if (!me.readToday && buddy.readToday) return `${buddy.nickname || 'TA'}读完了，在等你`;
  return '今天还没有人读，先读一会儿吧';
}

function decorateOverview(overview) {
  if (!overview) return null;
  return {
    ...overview,
    publicCheckins: (overview.publicCheckins || []).map(item => {
      const mood = getMoodOption(item.mood);
      return { ...item, moodName: mood ? mood.name : '' };
    })
  };
}

function getMeAvatar() {
  try {
    const app = typeof getApp === 'function' ? getApp() : null;
    const user = (app && app.globalData && app.globalData.userInfo) || {};
    return getUserAvatarDisplay(user, {
      userId: user._id || user.id,
      displayName: user.nickname || '我'
    });
  } catch (error) {
    return { avatarUrl: '', avatarText: '我', avatarColor: '' };
  }
}

Page({
  data: {
    periodId: '',
    loading: true,
    loadError: '',
    busy: false,
    state: 'none',
    buddy: null,
    me: { readToday: false, checkedInToday: false },
    meAvatar: { avatarUrl: '', avatarText: '我', avatarColor: '' },
    meLine: '',
    buddyLine: '',
    heroNote: '',
    canNudge: false,
    nudgedToday: false,
    canJoin: false,
    buddyInitial: '',
    periodName: '',
    pairedDay: 0,
    bothDone: false,
    canHighFive: false,
    highFivedToday: false,
    buddyHighFivedToday: false,
    canGift: false,
    giftSentToday: '',
    giftFromBuddy: null,
    waitingCount: 0,
    nudgeOptions: NUDGE_OPTIONS,
    nudgeKey: 'together',
    giftOptions: GIFT_OPTIONS,
    giftKey: GIFT_OPTIONS[0].key,
    giftSheetVisible: false,
    overview: null,
    souvenir: null,
    // 邀请：收到的、我发出的、选人弹层
    invitesReceived: [],
    invitesSent: [],
    pickerVisible: false,
    pickerKeyword: '',
    pickerLoading: false,
    candidates: [],
    candidatePage: 1,
    candidatesHasMore: false,
    discoverable: true
  },

  onLoad(options) {
    const periodId = (options && options.periodId) || '';
    this.setData({ periodId, meAvatar: getMeAvatar() });
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
    const rawBuddy = data.buddy || null;
    const buddy = rawBuddy
      ? {
          ...rawBuddy,
          ...getUserAvatarDisplay(rawBuddy, {
            userId: rawBuddy.userId,
            displayName: rawBuddy.nickname
          })
        }
      : null;
    const me = data.me || { readToday: false, checkedInToday: false };
    const next = {
      loading: false,
      loadError: '',
      state: data.state || 'none',
      buddy,
      me,
      canNudge: !!data.canNudge,
      nudgedToday: !!data.nudgedToday,
      canJoin: !!data.canJoin,
      buddyInitial: buddy ? buddy.avatarText : '',
      periodName: data.periodName || '',
      pairedDay: data.pairedDay || 0,
      bothDone: !!data.bothDone,
      canHighFive: !!data.canHighFive,
      highFivedToday: !!data.highFivedToday,
      buddyHighFivedToday: !!data.buddyHighFivedToday,
      canGift: !!data.canGift,
      giftSentToday: data.giftSentToday || '',
      giftFromBuddy: data.giftFromBuddy || null,
      waitingCount: data.waitingCount || 0,
      invitesReceived: data.invitesReceived || [],
      invitesSent: (data.invitesSent || []).map(item => ({ ...item, declined: item.status === 'declined' })),
      discoverable: data.discoverable !== false,
      meLine: describeStatus(me),
      buddyLine: buddy ? describeStatus(buddy) : '',
      overview: data.state === 'paired' ? this.data.overview : null,
      souvenir: data.state === 'ended' ? this.data.souvenir : null
    };
    next.heroNote = describeHeroNote({ ...next, buddy: buddy || {} });
    this.setData(next);
    if (data.state === 'paired' && typeof buddyService.getOverview === 'function') {
      this.loadOverview();
    }
    if (data.state === 'ended' && typeof buddyService.getSouvenir === 'function') {
      this.loadSouvenir();
    }
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

  async loadOverview() {
    try {
      const overview = await buddyService.getOverview(this.data.periodId);
      this.setData({ overview: decorateOverview(overview) });
    } catch (error) {
      this.setData({ overview: null });
    }
  },

  async loadSouvenir() {
    try {
      const souvenir = await buddyService.getSouvenir(this.data.periodId);
      this.setData({ souvenir: souvenir || null });
    } catch (error) {
      this.setData({ souvenir: null });
    }
  },

  // 告诉首页：读伴的状态变了，回去时要重新取一次
  markHomeDirty() {
    try {
      const app = typeof getApp === 'function' ? getApp() : null;
      if (app && app.globalData) app.globalData.buddyDirty = true;
    } catch (error) {
      // 取不到就按首页自己的节流刷新
    }
  },

  async runAction(action, doneTip) {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      this.applyState(await action(this.data.periodId));
      this.markHomeDirty();
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

  // ---- 邀请：从本期学员里挑一位，对方同意后才结成读伴 ----
  async onOpenPicker() {
    if (!this.data.canJoin) return;
    this.setData({ pickerVisible: true, pickerKeyword: '' });
    await this.loadCandidates();
  },

  onClosePicker() {
    this.setData({ pickerVisible: false });
  },

  onPickerInput(event = {}) {
    this.setData({ pickerKeyword: (event.detail && event.detail.value) || '' });
  },

  onPickerSearch() {
    this.loadCandidates();
  },

  // append 为 true 时是翻到下一页，否则从第一页重新开始（打开弹层、搜索）
  async loadCandidates(append = false) {
    if (this.data.pickerLoading) return;
    const page = append ? this.data.candidatePage + 1 : 1;
    this.setData({ pickerLoading: true });
    try {
      const res = await buddyService.getCandidates(this.data.periodId, this.data.pickerKeyword.trim(), page);
      const list = ((res && res.list) || []).map(item => ({
        ...item,
        hint: item.waiting ? '也在找读伴' : item.streak > 0 ? `已连续读 ${item.streak} 天` : item.recentlyActive ? '最近读过' : '',
        ...getUserAvatarDisplay(item, { userId: item.userId, displayName: item.nickname })
      }));
      this.setData({
        candidates: append ? this.data.candidates.concat(list) : list,
        candidatePage: page,
        candidatesHasMore: !!(res && res.hasMore),
        pickerLoading: false
      });
    } catch (error) {
      this.setData(append ? { pickerLoading: false } : { candidates: [], candidatesHasMore: false, pickerLoading: false });
      wx.showToast({ title: (error && error.message) || '名单没加载出来', icon: 'none' });
    }
  },

  onCandidatesMore() {
    if (this.data.candidatesHasMore && !this.data.pickerLoading) this.loadCandidates(true);
  },

  // 是否出现在别人的读伴邀请名单里
  async onToggleDiscoverable() {
    if (this.data.busy) return;
    const next = !this.data.discoverable;
    this.setData({ busy: true, discoverable: next });
    try {
      await buddyService.setDiscoverable(next);
      wx.showToast({ title: next ? '别人可以邀请你了' : '已从邀请名单里隐藏', icon: 'none' });
    } catch (error) {
      this.setData({ discoverable: !next });
      wx.showToast({ title: (error && error.message) || '没有成功，请稍后再试', icon: 'none' });
    } finally {
      this.setData({ busy: false });
    }
  },

  async onInvite(event = {}) {
    const targetUserId = event.currentTarget?.dataset?.userId;
    if (!targetUserId || this.data.busy) return;
    this.setData({ busy: true });
    try {
      const state = await buddyService.invite(this.data.periodId, targetUserId);
      this.applyState(state);
      if (state && state.state === 'paired') {
        this.setData({ pickerVisible: false });
        wx.showToast({ title: '你们成为读伴了', icon: 'none' });
      } else {
        this.setData({
          candidates: this.data.candidates.map(item => (item.userId === targetUserId ? { ...item, invited: true } : item))
        });
        wx.showToast({ title: '已发出邀请，等 TA 回复', icon: 'none' });
      }
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '没有成功，请稍后再试', icon: 'none' });
    } finally {
      this.setData({ busy: false });
    }
  },

  onRespondInvite(event = {}) {
    const { inviteId, accept } = event.currentTarget?.dataset || {};
    if (!inviteId) return;
    const agree = accept === true || accept === 'true';
    this.runAction(id => buddyService.respondInvite(id, inviteId, agree), agree ? '你们成为读伴了' : '已婉拒');
  },

  onCancelInvite(event = {}) {
    const { inviteId } = event.currentTarget?.dataset || {};
    if (!inviteId) return;
    this.runAction(id => buddyService.cancelInvite(id, inviteId), '已撤回');
  },

  onSelectNudge(event = {}) {
    const key = event.currentTarget?.dataset?.key;
    if (key) this.setData({ nudgeKey: key });
  },

  onNudge(event = {}) {
    if (!this.data.canNudge) return;
    const messageKey = event.currentTarget?.dataset?.messageKey || this.data.nudgeKey || 'together';
    this.runAction(id => buddyService.nudge(id, messageKey), '已轻拍');
  },

  onHighFive() {
    if (!this.data.canHighFive) return;
    this.runAction(id => buddyService.highFive(id), '已击掌');
  },

  onOpenGift() {
    if (!this.data.canGift) return;
    this.setData({ giftSheetVisible: true, giftKey: this.data.giftKey || GIFT_OPTIONS[0].key });
  },

  onCloseGift() {
    this.setData({ giftSheetVisible: false });
  },

  onSelectGift(event = {}) {
    const key = event.currentTarget?.dataset?.key;
    if (key) this.setData({ giftKey: key });
  },

  onSendGift() {
    if (!this.data.canGift) return;
    const messageKey = this.data.giftKey;
    this.setData({ giftSheetVisible: false });
    this.runAction(id => buddyService.gift(id, messageKey), '已送出');
  },

  async onRematch() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      const souvenir = await buddyService.rematch(this.data.periodId);
      this.setData({ souvenir: souvenir || null });
      wx.showToast({ title: '已记下', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '没有成功，请稍后再试', icon: 'none' });
    } finally {
      this.setData({ busy: false });
    }
  },

  onOpenBuddyCheckin(event) {
    const { sectionId, checkinId } = event.currentTarget?.dataset || {};
    if (!sectionId || !checkinId) return;
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${sectionId}&periodId=${this.data.periodId}&checkinId=${checkinId}&focus=comments`
    });
  },

  onOpenBuddyInsight(event) {
    const { insightId } = event.currentTarget?.dataset || {};
    if (!insightId) return;
    wx.navigateTo({ url: `/pages/insight-detail/insight-detail?id=${insightId}` });
  },

  stopPropagation() {},

  onLeave() {
    appDialog.showModal({
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
