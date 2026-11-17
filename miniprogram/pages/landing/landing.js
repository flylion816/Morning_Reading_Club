const newcomerLeadService = require('../../services/newcomer-lead.service');
const dailyCardShareService = require('./daily-card-share.service');
const request = require('../../utils/request');
const { ensureLoggedIn } = require('./silent-login');
const { getBrandName } = require('../../utils/brand');
const { getDailyCardShareCover } = require('./daily-card-cover');
const {
  REASON_OPTIONS,
  CONSENT_VERSION,
  CONSENT_TEXT,
  STATUS_TEXT,
  parseLandingOptions,
  parseLandingSnapshot,
  buildLandingPath,
  describeDate,
  todayKey,
  formatContactBy,
  isValidPhone,
  buildLandingQuery
} = require('../../utils/landing-share');

const MAX_NOTE = 200;

Page({
  data: {
    loading: true,
    loadError: false,
    brandName: getBrandName(),
    reasonOptions: REASON_OPTIONS,
    consentText: CONSENT_TEXT,
    contactWithinDays: 3,
    // 落地页内容
    inviter: null,
    inviterLabel: '',
    dateInfo: { dayNumber: '', dateLine: '', termText: '' },
    lessonLine: '',
    sourceLine: '',
    variant: 'dawn',
    hasSharedCard: false,
    quote: '',
    note: '',
    voices: [],
    // 访客状态：visitor 没留过言；lead 已留言；member 已在营里
    mode: 'visitor',
    lead: null,
    leadStatusText: '',
    contactByText: '',
    // 留言弹层
    sheetVisible: false,
    sheetPhoneOnly: false,
    selectedReason: '',
    extraNote: '',
    noteMax: MAX_NOTE,
    phone: '',
    phoneManual: false,
    agreed: false,
    submitting: false,
    formError: '',
    // 提交成功页
    submitted: false,
    maskedPhone: '',
    singlePage: false
  },

  onLoad(options = {}) {
    this._params = parseLandingOptions(options);
    // 开放朋友圈分享；朋友圈打开的单页模式里不能请求接口，只展示内容并引导去小程序
    if (typeof wx.showShareMenu === 'function') {
      wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] });
    }
    let singlePage = false;
    try {
      singlePage = typeof wx.getLaunchOptionsSync === 'function' && wx.getLaunchOptionsSync().scene === 1154;
    } catch (error) {
      singlePage = false;
    }
    this._shareResolved = false;
    const hasSharedCard = Boolean(
      this._params.shareCode ||
      (this._params.sourceType === 'daily_card' && (
        options.q !== undefined ||
        options.quote !== undefined ||
        options.variant !== undefined ||
        options.source !== undefined ||
        options.period !== undefined ||
        options.date !== undefined
      ))
    );
    this.applyCardParams(this._params);
    this.setData({
      inviterLabel: `来自${this.data.brandName}的晨读日签`,
      hasSharedCard,
      singlePage,
      loading: !singlePage
    });
    if (!singlePage) {
      if (this._params.shareCode) this.loadSharedCard({ firstLoad: true });
      else this.loadLanding({ firstLoad: true });
    }
  },

  applyCardParams(params = {}) {
    const { dateStr, quote, note, lessonName, periodName, dayNumber, variant } = params;
    const lessonLine = [periodName || lessonName, dayNumber ? `第 ${dayNumber} 天` : ''].filter(Boolean).join(' · ');
    this.setData({
      dateInfo: describeDate(dateStr || todayKey()),
      lessonLine,
      sourceLine: periodName && lessonName && periodName !== lessonName ? lessonName : '',
      variant: variant || 'dawn',
      quote: quote || '',
      note: note || ''
    });
  },

  async loadSharedCard({ firstLoad = false } = {}) {
    this.setData({ loading: true, loadError: false });
    try {
      const code = this._params.shareCode;
      const snapshot = await dailyCardShareService.resolve(code);
      if (!snapshot || typeof snapshot !== 'object') throw new Error('日签内容不可用');
      this._params = parseLandingSnapshot(snapshot, code);
      this._shareResolved = true;
      this.applyCardParams(this._params);
      this.setData({ hasSharedCard: true });
      // 分享快照是首屏内容的来源；即使访客资料接口暂时失败，也先把日签展示出来。
      await this.loadLanding({ firstLoad, preserveCard: true });
    } catch (error) {
      console.warn('读取分享日签失败', error);
      this.setData({ loading: false, loadError: true });
    }
  },

  onShow() {
    // 作为入口页时微信会自动加一个灰色的“回首页”胶囊，颜色改不了，和晨光底色不搭；
    // 页面每个状态都有自己的去处（看课 / 去首页），所以直接隐藏
    if (typeof wx.hideHomeButton === 'function') wx.hideHomeButton();
    // 从“读今天这一课”等页面回来，或刚完成登录后，刷新状态
    if (this._loadedOnce && !this.data.submitted && !this.data.sheetVisible) {
      this.loadLanding({ silent: true });
    }
  },

  async loadLanding({ silent = false, firstLoad = false, preserveCard = false } = {}) {
    if (!silent) this.setData({ loading: true, loadError: false });
    try {
      // 只有第一次打开计一次访问；静默刷新、重试都不重复计数
      const res = await newcomerLeadService.getLanding(this._params.inviterId, {
        view: firstLoad,
        src: this._params.sourceType
      });
      const inviter = res.inviter || null;
      const viewer = res.viewer || {};
      this._loadedOnce = true;
      this._myUserId = this.getMyUserId();

      let mode = 'visitor';
      if (viewer.isMember) mode = 'member';
      else if (viewer.lead) mode = 'lead';

      const lead = viewer.lead || null;
      this.setData({
        loading: false,
        loadError: false,
        inviter,
        inviterLabel: inviter ? `${inviter.nickname} 分享了今天的晨读日签` : `来自${this.data.brandName}的晨读日签`,
        voices: Array.isArray(res.voices) ? res.voices : [],
        contactWithinDays: res.contactWithinDays || 3,
        mode,
        lead,
        leadStatusText: lead ? STATUS_TEXT[lead.status] || '' : '',
        contactByText: lead ? formatContactBy(lead.contactBy) : ''
      });
    } catch (error) {
      console.warn('加载落地页失败', error);
      if (silent) return false;
      this.setData({ loading: false, loadError: !preserveCard });
      return false;
    }
    return true;
  },

  getMyUserId() {
    const app = getApp();
    const user = (app && app.globalData && app.globalData.userInfo) || {};
    return user._id || user.id || user.userId || '';
  },

  // ---- 弹层 ----
  handleOpenSheet() {
    if (this.data.mode === 'member') return;
    this.setData({
      sheetVisible: true,
      sheetPhoneOnly: false,
      formError: ''
    });
  },

  handleChangePhone() {
    this.setData({ sheetVisible: true, sheetPhoneOnly: true, formError: '', phone: '', phoneManual: false });
  },

  handleCloseSheet() {
    if (this.data.submitting) return;
    this.setData({ sheetVisible: false });
  },

  stopPropagation() {},

  handleSelectReason(e) {
    const reason = e.currentTarget.dataset.value;
    this.setData({ selectedReason: reason === this.data.selectedReason ? '' : reason, formError: '' });
  },

  handleNoteInput(e) {
    this.setData({ extraNote: e.detail.value });
  },

  handlePhoneInput(e) {
    this.setData({ phone: String(e.detail.value || '').replace(/\D/g, '').slice(0, 11), formError: '' });
  },

  handleManualPhone() {
    this.setData({ phoneManual: true });
  },

  handleToggleAgree() {
    this.setData({ agreed: !this.data.agreed, formError: '' });
  },

  handleOpenPrivacy() {
    wx.navigateTo({ url: '/pages/privacy-policy/privacy-policy' });
  },

  handleOpenAgreement() {
    wx.navigateTo({ url: '/pages/user-agreement/user-agreement' });
  },

  // 微信手机号授权：拿到 code 后要先登录，再换手机号
  async handleGetPhoneNumber(e) {
    const detail = e.detail || {};
    if (!detail.code) {
      // 用户没授权或当前环境不支持，改成手动输入，不再追问
      this.setData({ phoneManual: true });
      return;
    }
    try {
      await ensureLoggedIn();
      const res = await request.post('/auth/phone', { code: detail.code });
      if (res && res.phone) {
        this.setData({ phone: res.phone, phoneManual: false, formError: '' });
        return;
      }
      this.setData({ phoneManual: true });
    } catch (error) {
      console.warn('获取微信手机号失败', error);
      this.setData({ phoneManual: true });
    }
  },

  validateForm() {
    const { sheetPhoneOnly, selectedReason, phone, agreed } = this.data;
    if (!sheetPhoneOnly && !selectedReason) return '选一个你想来的原因吧';
    if (!isValidPhone(phone)) return '请填写正确的 11 位手机号';
    if (!agreed) return '需要先同意授权说明';
    return '';
  },

  async handleSubmit() {
    if (this.data.submitting) return;
    const problem = this.validateForm();
    if (problem) {
      this.setData({ formError: problem });
      return;
    }

    this.setData({ submitting: true, formError: '' });
    try {
      // 点提交的这一刻才登录，访客不会看到登录页
      await ensureLoggedIn();

      const { sheetPhoneOnly, lead } = this.data;
      const res = await newcomerLeadService.submit({
        reason: sheetPhoneOnly && lead ? lead.reason : this.data.selectedReason,
        note: sheetPhoneOnly && lead ? lead.note || '' : this.data.extraNote.trim(),
        phone: this.data.phone,
        agreed: true,
        consentVersion: CONSENT_VERSION,
        inviterId: this._params.inviterId,
        sourceType: this._params.sourceType
      });
      const saved = res.lead || null;
      this.setData({
        submitting: false,
        sheetVisible: false,
        submitted: true,
        mode: 'lead',
        lead: saved,
        leadStatusText: saved ? STATUS_TEXT[saved.status] || '' : '',
        contactByText: saved ? formatContactBy(saved.contactBy) : '',
        maskedPhone: saved ? saved.phoneMasked : ''
      });
    } catch (error) {
      this.setData({ submitting: false });
      const message = (error && error.message) || '';
      if (/已经在营里/.test(message)) {
        this.setData({ sheetVisible: false, mode: 'member' });
        return;
      }
      this.setData({ formError: message && message.length < 30 ? message : '这次没提交上，再试一次' });
    }
  },

  // ---- 其他入口 ----
  handleBrowseCourses() {
    wx.switchTab({ url: '/pages/periods/periods' });
  },

  handleGoToday() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  handleShareMine() {
    wx.navigateTo({ url: '/pages/daily-card/daily-card' });
  },

  handleRetry() {
    if (this._params && this._params.shareCode && !this._shareResolved) {
      return this.loadSharedCard({ firstLoad: true });
    }
    return this.loadLanding();
  },

  onShareTimeline() {
    const params = this._params || {};
    return {
      title: this.data.inviter
        ? `${this.data.inviter.nickname} 的晨读日签`
        : `${this.data.brandName}｜晨读日签`,
      query: buildLandingQuery({
        inviterId: this.getMyUserId() || params.inviterId,
        sourceType: params.sourceType,
        dateStr: params.dateStr,
        lessonName: params.lessonName,
        periodName: params.periodName,
        dayNumber: params.dayNumber,
        quote: params.quote,
        note: '',
        variant: params.variant
      }),
      imageUrl: getDailyCardShareCover(params.variant)
    };
  },

  onShareAppMessage() {
    const params = this._params || {};
    // 转发时分享人换成自己：谁转发，来的人就归谁；没登录就保留原分享人
    const inviterId = this.getMyUserId() || params.inviterId;
    return {
      title: this.data.inviter
        ? `${this.data.inviter.nickname} 的晨读日签`
        : `${this.data.brandName}｜晨读日签`,
      path: buildLandingPath({
        inviterId,
        sourceType: params.sourceType,
        dateStr: params.dateStr,
        lessonName: params.lessonName,
        periodName: params.periodName,
        dayNumber: params.dayNumber,
        quote: params.quote,
        note: '',
        variant: params.variant
      }),
      imageUrl: getDailyCardShareCover(params.variant)
    };
  }
});
