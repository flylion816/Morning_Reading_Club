const adminAnalyticsService = require('../../services/adminAnalytics.service');

const DATE_PRESETS = [
  { key: 'today', label: '今日', days: 0 },
  { key: 'yesterday', label: '昨日', days: -1 },
  { key: '7d', label: '近7天', days: 6 },
  { key: '30d', label: '近30天', days: 29 }
];

const enrollmentSeries = [
  { key: 'enrollmentCount', name: '报名', color: '#4f73d9' },
  { key: 'paidEnrollmentCount', name: '已支付', color: '#2fa36b' }
];

const paymentSeries = [
  { key: 'totalAmountYuan', name: '总收入', color: '#4f73d9' },
  { key: 'activityAmountYuan', name: '活动', color: '#f6b63f' },
  { key: 'enrollmentAmountYuan', name: '报名', color: '#2fa36b' }
];

const activitySeries = [
  { key: 'app_open', name: '访问', color: '#4f73d9' },
  { key: 'checkin_submit', name: '打卡', color: '#86c56f' },
  { key: 'own_insight_view', name: '看自己', color: '#f6b63f' },
  { key: 'other_insight_view', name: '看他人', color: '#f15f5f' },
  { key: 'course_view', name: '课程', color: '#67bde0' },
  { key: 'meeting_enter', name: '晨读', color: '#2fa36b' }
];

function getShanghaiDateKey(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return getShanghaiDateKey(date);
}

function formatMoney(fen) {
  const yuan = (Number(fen) || 0) / 100;
  if (yuan >= 10000) return `¥${(yuan / 10000).toFixed(1)}万`;
  return `¥${yuan.toFixed(2)}`;
}

function formatCompactNumber(value) {
  const num = Number(value) || 0;
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`;
  return String(num);
}

function formatChartNumber(value) {
  const num = Number(value) || 0;
  if (num >= 10000) return `${(num / 10000).toFixed(1)}万`;
  return String(Math.round(num));
}

function formatChartDate(value) {
  const text = String(value || '');
  return text.length >= 10 ? text.slice(5) : text;
}

function buildNativeBarChart(rows = [], series = [], options = {}) {
  const chartRows = Array.isArray(rows) ? rows : [];
  const displayRows = options.sortByDateDesc === false
    ? chartRows
    : chartRows.slice().sort((left, right) =>
      String(right.date || '').localeCompare(String(left.date || ''))
    );
  const chartSeries = Array.isArray(series) ? series : [];
  const formatter = options.valueFormatter || formatChartNumber;
  const values = [];

  displayRows.forEach((row) => {
    chartSeries.forEach((item) => {
      values.push(Number(row[item.key]) || 0);
    });
  });

  const maxValue = Math.max(1, ...values);
  const columnWidth = Math.max(64, chartSeries.length * 18 + 28);
  const barWidth = chartSeries.length > 4 ? 8 : chartSeries.length > 2 ? 10 : 12;

  return {
    empty: displayRows.length === 0 || chartSeries.length === 0,
    width: Math.max(560, displayRows.length * columnWidth),
    maxLabel: formatter(maxValue),
    rows: displayRows.map((row, index) => ({
      rowKey: `${row.date || 'row'}-${index}`,
      label: formatChartDate(row.date),
      width: columnWidth,
      values: chartSeries.map((item) => {
        const value = Number(row[item.key]) || 0;
        return {
          key: item.key,
          color: item.color || '#4a90e2',
          valueLabel: formatter(value),
          height: value <= 0 ? 0 : Math.max(8, Math.round((value / maxValue) * 156)),
          barWidth
        };
      })
    }))
  };
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hour}:${minute}`;
}

function buildRange(presetKey) {
  const today = getShanghaiDateKey(new Date());
  if (presetKey === 'today') return { startDate: today, endDate: today };
  if (presetKey === 'yesterday') {
    const yesterday = addDays(today, -1);
    return { startDate: yesterday, endDate: yesterday };
  }
  const preset = DATE_PRESETS.find((item) => item.key === presetKey) || DATE_PRESETS[3];
  return { startDate: addDays(today, -preset.days), endDate: today };
}

function normalizeOverview(data = {}) {
  const summary = data.summary || {};
  const enrollmentTrend = data.enrollmentTrend || [];
  const paymentTrend = (data.paymentTrend || []).map((item) => ({
    ...item,
    totalAmountYuan: Math.round((Number(item.totalAmount) || 0) / 100),
    enrollmentAmountYuan: Math.round((Number(item.enrollmentAmount) || 0) / 100),
    activityAmountYuan: Math.round((Number(item.activityAmount) || 0) / 100)
  }));

  return {
    summary: {
      ...summary,
      totalUsersText: formatCompactNumber(summary.totalUsers),
      totalRevenueText: formatMoney(summary.totalRevenue),
      enrollmentRevenueText: formatMoney(summary.enrollmentRevenue),
      activityRevenueText: formatMoney(summary.activityRevenue),
      conversionRate: Number(summary.conversionRate || 0).toFixed(1)
    },
    enrollmentTrend,
    paymentTrend,
    enrollmentChart: buildNativeBarChart(enrollmentTrend, enrollmentSeries),
    paymentChart: buildNativeBarChart(paymentTrend, paymentSeries, {
      valueFormatter: (value) => `¥${formatChartNumber(value)}`
    }),
    periodPopularity: data.periodPopularity || [],
    paymentMethodDistribution: data.paymentMethodDistribution || []
  };
}

function normalizeActivity(data = {}) {
  const trend = data.trend || [];
  return {
    summary: data.summary || {
      today: {},
      yesterday: {},
      delta: {}
    },
    trend,
    trendChart: buildNativeBarChart(trend, activitySeries),
    details: (data.details || []).map((item, index) => ({
      ...item,
      rowKey: `${item.date || ''}-${item.userId || index}`,
      lastOccurredAtText: formatDateTime(item.lastOccurredAt)
    }))
  };
}

function buildActivityCards(summary = {}) {
  const today = summary.today || {};
  const delta = summary.delta || {};
  const configs = [
    { key: 'appOpenUsers', label: '今日访问小程序' },
    { key: 'checkinUsers', label: '今日打卡' },
    { key: 'insightViewUsers', label: '今日小凡浏览' },
    { key: 'activeUsers', label: '今日关键行为' }
  ];
  return configs.map((item) => {
    const diff = Number(delta[item.key]) || 0;
    return {
      key: item.key,
      label: item.label,
      value: today[item.key] || 0,
      deltaClass: diff > 0 ? 'up' : diff < 0 ? 'down' : '',
      deltaText: diff === 0 ? '较昨日持平' : `较昨日${diff > 0 ? '+' : ''}${diff}`
    };
  });
}

Page({
  data: {
    activeTab: 'overview',
    datePresets: DATE_PRESETS,
    activePreset: '30d',
    customStartDate: buildRange('30d').startDate,
    customEndDate: buildRange('30d').endDate,
    periodIndex: 0,
    periodNames: ['全部期次'],
    selectedPeriodName: '全部期次',
    periods: [{ id: '', name: '全部期次' }],
    loading: true,
    errorMessage: '',
    overview: normalizeOverview(),
    activity: normalizeActivity(),
    activityCards: buildActivityCards(),
    enrollmentSeries,
    paymentSeries,
    activitySeries
  },

  onLoad() {
    this.loadAll();
  },

  onPullDownRefresh() {
    this.loadAll().finally(() => wx.stopPullDownRefresh());
  },

  buildParams() {
    const range = this.data.activePreset === 'custom'
      ? {
        startDate: this.data.customStartDate,
        endDate: this.data.customEndDate
      }
      : buildRange(this.data.activePreset);
    const period = this.data.periods[this.data.periodIndex] || {};
    return {
      ...range,
      periodId: period.id || ''
    };
  },

  async loadAll() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const periodRes = await adminAnalyticsService.getPeriods();
      const periodList = [{ id: '', name: '全部期次' }].concat(
        ((periodRes && periodRes.list) || []).map((item) => ({
          id: item.id || item._id,
          name: item.name || item.title || '未命名期次'
        }))
      );
      const periodIndex = Math.min(this.data.periodIndex, periodList.length - 1);
      this.setData({
        periods: periodList,
        periodNames: periodList.map((item) => item.name),
        periodIndex,
        selectedPeriodName: periodList[periodIndex]?.name || '全部期次'
      });

      const params = this.buildParams();
      const [overviewRes, activityRes] = await Promise.all([
        adminAnalyticsService.getOverview(params),
        adminAnalyticsService.getActivity(params)
      ]);
      const activity = normalizeActivity(activityRes);
      this.setData({
        overview: normalizeOverview(overviewRes),
        activity,
        activityCards: buildActivityCards(activity.summary),
        loading: false
      });
    } catch (error) {
      const statusCode = error && error.statusCode;
      const message = error?.data?.message || error?.message || error?.message || '';
      this.setData({
        loading: false,
        errorMessage: statusCode === 403 || message.includes('权限')
          ? '当前账号没有数据分析权限'
          : '数据加载失败，请稍后重试'
      });
    }
  },

  async reloadDataOnly() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const params = this.buildParams();
      const [overviewRes, activityRes] = await Promise.all([
        adminAnalyticsService.getOverview(params),
        adminAnalyticsService.getActivity(params)
      ]);
      const activity = normalizeActivity(activityRes);
      this.setData({
        overview: normalizeOverview(overviewRes),
        activity,
        activityCards: buildActivityCards(activity.summary),
        loading: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: '数据加载失败，请稍后重试'
      });
    }
  },

  handleTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab && tab !== this.data.activeTab) {
      this.setData({ activeTab: tab });
    }
  },

  handlePresetTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activePreset) return;
    const range = buildRange(key);
    this.setData({
      activePreset: key,
      customStartDate: range.startDate,
      customEndDate: range.endDate
    });
    this.reloadDataOnly();
  },

  handleStartDateChange(e) {
    this.setData({
      activePreset: 'custom',
      customStartDate: e.detail.value
    });
    this.reloadDataOnly();
  },

  handleEndDateChange(e) {
    this.setData({
      activePreset: 'custom',
      customEndDate: e.detail.value
    });
    this.reloadDataOnly();
  },

  handlePeriodChange(e) {
    const periodIndex = Number(e.detail.value) || 0;
    const selectedPeriodName = this.data.periodNames[periodIndex] || '全部期次';
    this.setData({ periodIndex, selectedPeriodName });
    this.reloadDataOnly();
  }
});
