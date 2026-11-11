const keepsakeService = require('../../services/keepsake.service');
const { requireLogin } = require('../../utils/require-login');
const { getBrandName } = require('../../utils/brand');
const { getMoodOption } = require('../../utils/mood');

const MOOD_COLORS = {
  happy: '#ee9b45',
  calm: '#a9b4bf',
  thoughtful: '#8fb8a8',
  inspired: '#e58a6b',
  low: '#7f95ad',
  other: '#b9b0a3'
};

function buildPages(data) {
  const pages = [{ key: 'cover' }];
  if (data.checkinDays || data.totalWords || data.readingMinutes) pages.push({ key: 'numbers' });
  if (data.earliestCheckin) pages.push({ key: 'earliest' });
  if (data.moods && data.moods.length) pages.push({ key: 'moods' });
  if (data.topCheckin) pages.push({ key: 'top' });
  if (data.highlights && data.highlights.length) pages.push({ key: 'highlights' });
  if (data.companions && data.companions.length) pages.push({ key: 'companions' });
  if (data.insightExcerpt) pages.push({ key: 'insight' });
  if (data.letter) pages.push({ key: 'letter' });
  pages.push({ key: 'end' });
  return pages;
}

function resolveTotalDays(period = {}) {
  const total = Number(period.totalDays);
  if (total > 0) return total;
  const start = Date.parse(period.startDate);
  const end = Date.parse(period.endDate);
  if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
    return Math.round((end - start) / 86400000) + 1;
  }
  return 0;
}

function decorate(data) {
  const moods = (data.moods || []).map((item) => {
    const option = getMoodOption(item.mood);
    return {
      date: item.date,
      name: option ? option.name : '',
      color: MOOD_COLORS[item.mood] || MOOD_COLORS.other
    };
  });
  const periodName = (data.period && data.period.name) || '';
  return {
    ...data,
    moods,
    totalDays: resolveTotalDays(data.period),
    sealChar: Array.from(periodName)[0] || '读',
    pages: buildPages(data)
  };
}

Page({
  data: {
    periodId: '',
    loading: true,
    error: '',
    ready: false,
    daysLeft: 0,
    periodName: '',
    totalDays: 0,
    keepsake: null
  },

  onLoad(options = {}) {
    this.setData({ periodId: options.periodId || '' });
    if (!options.periodId) {
      this.setData({ loading: false, error: '缺少期次信息' });
      return;
    }
    this.loadKeepsake();
  },

  async loadKeepsake() {
    if (!requireLogin('登录后才能看到你的纪念册')) {
      this.setData({ loading: false, error: '登录后才能看到你的纪念册' });
      return;
    }
    this.setData({ loading: true, error: '' });
    try {
      const data = (await keepsakeService.getPeriodKeepsake(this.data.periodId)) || {};
      const periodName = (data.period && data.period.name) || '';
      if (!data.ready) {
        this.setData({
          loading: false,
          ready: false,
          daysLeft: data.daysLeft || 0,
          periodName,
          totalDays: resolveTotalDays(data.period)
        });
        return;
      }
      const keepsake = decorate(data);
      this.setData({ loading: false, ready: true, periodName, totalDays: keepsake.totalDays, keepsake });
    } catch (error) {
      this.setData({ loading: false, error: '没能取到你的纪念册，点一下再试试' });
    }
  },

  onRetry() {
    this.loadKeepsake();
  },

  onBackToCourse() {
    const url = `/pages/courses/courses?periodId=${this.data.periodId}`;
    const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    if (stack.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.redirectTo({ url, fail: () => wx.switchTab({ url: '/pages/index/index' }) });
  },

  onShareAppMessage() {
    const days = this.data.totalDays;
    return {
      title: days ? `我在${getBrandName()}的 ${days} 天` : `我在${getBrandName()}的晨读纪念册`,
      path: '/pages/index/index'
    };
  }
});
