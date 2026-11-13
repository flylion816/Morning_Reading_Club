const keepsakeService = require('./keepsake.service');
const completionReportService = require('../../services/completion-report.service');
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

// 一期一本册子，七个部分；每部分第一页带上章名
const CHAPTERS = [
  { name: '我写下的', keys: ['numbers', 'earliest', 'moods', 'top', 'highlights'] },
  { name: '每一天', keys: ['days'] },
  { name: '同行的人', keys: ['companions', 'seen', 'buddy'] },
  { name: '写给自己的', keys: ['practices'] },
  { name: '小凡的话', keys: ['insights'] },
  { name: '分享实录', keys: ['report'] }
];

function hasPage(key, data) {
  switch (key) {
    case 'numbers': return !!(data.checkinDays || data.totalWords || data.readingMinutes);
    case 'earliest': return !!data.earliestCheckin;
    case 'moods': return !!(data.moods && data.moods.length);
    case 'top': return !!data.topCheckin;
    case 'highlights': return !!(data.highlights && data.highlights.length);
    case 'days': return !!(data.days && data.days.length);
    case 'companions': return !!(data.companions && data.companions.length);
    case 'seen': return data.seenCount > 0;
    case 'buddy': return !!data.buddy;
    case 'practices': return !!(data.practices && data.practices.length);
    // 旧版接口只有一段摘录，也照样显示
    case 'insights': return !!((data.insights && data.insights.length) || data.insightExcerpt);
    case 'report': return !!data.report;
    default: return false;
  }
}

// 开营时写的那封信是整本册子的开篇，拆信后的回信是后记
function hasPrologue(data) {
  const letter = data.letter;
  if (!letter) return false;
  // 旧版接口没有 status，只在拆开后才返回
  return !letter.status || ['opened', 'delivered', 'sealed'].includes(letter.status);
}

function hasEpilogue(data) {
  const letter = data.letter;
  return !!(letter && (!letter.status || letter.status === 'opened') && letter.reply);
}

function buildPages(data) {
  const pages = [{ key: 'cover' }];
  if (hasPrologue(data)) pages.push({ key: 'prologue', chapter: '开篇' });
  CHAPTERS.forEach((chapter) => {
    let first = true;
    chapter.keys.forEach((key) => {
      if (!hasPage(key, data)) return;
      pages.push(first ? { key, chapter: chapter.name } : { key });
      first = false;
    });
  });
  pages.push(hasEpilogue(data) ? { key: 'epilogue', chapter: '后记' } : { key: 'end' });
  return pages;
}

function shortDate(dayKey) {
  const parts = String(dayKey || '').split('-');
  return parts.length === 3 ? `${Number(parts[1])}.${parts[2]}` : '';
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

function getLetterPrologueLabel(letter) {
  const days = letter && letter.daysSinceWritten;
  if (typeof days === 'number' && days >= 0) {
    return days === 0 ? '今天，你写下' : `${days} 天前，你写下`;
  }
  return '那时候，你写下';
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
  const insights = (data.insights && data.insights.length
    ? data.insights
    : data.insightExcerpt ? [data.insightExcerpt] : []
  ).map((item) => ({ ...item, dateText: shortDate(item.date) }));
  const days = (data.days || []).map((item) => ({ ...item, dateText: shortDate(item.date) }));
  return {
    ...data,
    moods,
    insights,
    days,
    // 旧版接口没有 finished 字段：能看到内容就说明已结营
    finished: data.finished !== false,
    totalDays: resolveTotalDays(data.period),
    sealChar: Array.from(periodName)[0] || '读',
    letterStatus: data.letter ? data.letter.status || 'opened' : '',
    letterPrologueLabel: getLetterPrologueLabel(data.letter),
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
    notStarted: false,
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

  onShow() {
    if (!this.refreshAfterLetter) return;
    this.refreshAfterLetter = false;
    return this.loadKeepsake();
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
          notStarted: data.notStarted === true,
          periodName,
          totalDays: resolveTotalDays(data.period)
        });
        return;
      }
      const keepsake = decorate(data);
      this.setData({ loading: false, ready: true, periodName, totalDays: keepsake.totalDays, keepsake });
      this.loadReport();
    } catch (error) {
      this.setData({ loading: false, error: '没能取到你的纪念册，点一下再试试' });
    }
  },

  // 这一期的分享实录（管理员上传的 PDF）：有就在册子末尾加一页，没有或取不到就不显示
  async loadReport() {
    try {
      const report = await completionReportService.getReportDetail(this.data.periodId, { suppressError: true });
      if (!report || !report.hasReport || !this.data.keepsake) return;
      const keepsake = { ...this.data.keepsake, report };
      keepsake.pages = buildPages(keepsake);
      this.setData({ keepsake });
    } catch (error) {}
  },

  // 开篇里「去拆信」：拆信这个动作留在慢递邮局里做
  onOpenLetter() {
    this.refreshAfterLetter = true;
    wx.navigateTo({ url: `/pages/slow-mail/slow-mail?periodId=${this.data.periodId}` });
  },

  onOpenReport() {
    wx.navigateTo({
      url: `/pages/completion-report-detail/completion-report-detail?periodId=${this.data.periodId}`
    });
  },

  onOpenDay(e) {
    const { sectionId, checkinId } = e.currentTarget.dataset;
    if (!sectionId) return;
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${sectionId}${checkinId ? `&checkinId=${checkinId}` : ''}`
    });
  },

  onOpenInsight(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({ url: `/pages/insight-detail/insight-detail?id=${id}` });
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
