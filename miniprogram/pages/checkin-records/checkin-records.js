const checkinService = require('../../services/checkin.service');
const { getAvatarColorByUserId } = require('../../utils/formatters');
const {
  getPeriodAccess,
  redirectAfterCommunityDenied
} = require('../../utils/period-access');

function buildDefaultStats() {
  return {
    diaryCount: 0,
    likeCount: 0
  };
}

function formatMonthLabel(date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}月`;
}

function formatTimeLabel(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getTextDisplayUnits(text = '') {
  return Array.from(String(text)).reduce((sum, char) => {
    return sum + (/[^\x00-\xff]/.test(char) ? 2 : 1);
  }, 0);
}

function truncateCardTitle(text = '', maxUnits = 14) {
  const source = String(text || '').trim();
  if (!source) {
    return '未知期次';
  }

  if (getTextDisplayUnits(source) <= maxUnits) {
    return source;
  }

  const ellipsis = '...';
  const ellipsisUnits = getTextDisplayUnits(ellipsis);
  let currentUnits = 0;
  let output = '';

  Array.from(source).forEach(char => {
    const charUnits = /[^\x00-\xff]/.test(char) ? 2 : 1;
    if (currentUnits + charUnits + ellipsisUnits > maxUnits) {
      return;
    }
    output += char;
    currentUnits += charUnits;
  });

  const cleanedOutput = output.replace(/[\s\-–—:：,，、]+$/g, '');
  return `${cleanedOutput}${ellipsis}`;
}

function buildPeriodOption(period) {
  const title = period.title || period.name || '未知期次';

  return {
    id: period.periodId,
    title,
    displayTitle: truncateCardTitle(title),
    subtitle: `共发布${period.diaryCount || 0}篇日记`,
    icon: period.coverEmoji || period.icon || '📚',
    color: period.coverColor || period.color || '#4a90e2',
    diaryCount: period.diaryCount || 0,
    checkedDays: period.checkedDays || 0,
    likeCount: period.likeCount || 0,
    currentEnrollment: period.currentEnrollment || 0,
    totalDays: period.totalDays || 0,
    totalCheckins: period.totalCheckins || 0,
    lastCheckinAt: period.lastCheckinAt || '',
    lastCheckinDay: period.lastCheckinDay || null,
    lastCheckinSection: period.lastCheckinSection || null,
    status: period.status || ''
  };
}

function buildAllPeriodOption(summaryStats = {}) {
  const title = '全部打卡';

  return {
    id: 'all',
    title,
    displayTitle: title,
    subtitle: `共发布${summaryStats.diaryCount || 0}篇日记`,
    icon: '🗂️',
    color: '#4a90e2',
    diaryCount: summaryStats.diaryCount || 0,
    checkedDays: summaryStats.totalCheckins || 0,
    likeCount: summaryStats.likeCount || 0,
    currentEnrollment: 0,
    totalDays: 0,
    totalCheckins: summaryStats.totalCheckins || 0,
    lastCheckinAt: '',
    lastCheckinDay: null,
    lastCheckinSection: null,
    status: ''
  };
}

function buildRecordItem(item) {
  const checkinDate = new Date(item.checkinDate || item.createdAt || Date.now());
  const previewSource = typeof item.note === 'string' ? item.note.trim() : '';
  const preview = previewSource || '这篇打卡还没有填写正文';
  const periodTitle = item.periodId?.title || item.periodId?.name || '';
  const createdAtLabel = `${checkinDate.getFullYear()}-${String(checkinDate.getMonth() + 1).padStart(2, '0')}-${String(checkinDate.getDate()).padStart(2, '0')} ${formatTimeLabel(checkinDate)}`;

  return {
    id: item._id,
    sectionId: item.sectionId?._id || item.sectionId || '',
    periodId: item.periodId?._id || item.periodId || '',
    monthLabel: formatMonthLabel(checkinDate),
    dayLabel: String(checkinDate.getDate()).padStart(2, '0'),
    timeLabel: formatTimeLabel(checkinDate),
    createdAtLabel,
    courseTitle: item.sectionId?.title || '晨读任务',
    periodTitle,
    metaLabel: periodTitle ? `${createdAtLabel} · ${periodTitle}` : createdAtLabel,
    preview,
    likeCount: item.likeCount || 0,
    hasDiary: !!previewSource
  };
}

Page({
  data: {
    userInfo: {
      userName: '用户',
      avatarUrl: '',
      avatarColor: '#4a90e2',
      avatarText: 'U'
    },
    stats: buildDefaultStats(),
    periodId: 'all',
    periodOptions: [],
    selectedPeriod: null,
    selectedPeriodIndex: 0,
    selectedPeriodMetaLines: [],
    checkinRecords: [],
    page: 1,
    limit: 20,
    hasMore: false,
    loading: true,
    loadingMore: false,
    summaryLoaded: false
  },

  async onLoad(options) {
    const initialPeriodId = options?.periodId || 'all';
    if (initialPeriodId !== 'all') {
      const access = await getPeriodAccess(initialPeriodId);
      if (access.communityAccessState !== 'enabled') {
        redirectAfterCommunityDenied(`/pages/courses/courses?periodId=${initialPeriodId}`);
        return;
      }
    }

    this.setData({ periodId: initialPeriodId });
    this.syncUserInfo();
    await this.bootstrapPage();
  },

  onPullDownRefresh() {
    this.bootstrapPage().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (!this.data.loading && this.data.hasMore && !this.data.loadingMore) {
      this.loadCheckinRecords({ reset: false }).catch(() => {});
    }
  },

  syncUserInfo() {
    const app = getApp();
    const user = app?.globalData?.userInfo || {};
    const displayName = user.nickname || user.name || '用户';

    this.setData({
      userInfo: {
        userName: displayName,
        avatarUrl: user.avatarUrl || '',
        avatarColor: getAvatarColorByUserId(user._id || displayName),
        avatarText: displayName.charAt(0) || 'U'
      }
    });
  },

  async bootstrapPage() {
    this.setData({
      loading: true,
      loadingMore: false,
      summaryLoaded: false
    });

    try {
      await this.loadSummary();
      await this.loadCheckinRecords({ reset: true });
    } catch (error) {
      console.error('加载我的打卡日记失败:', error);
      wx.showToast({
        title: '加载失败，请稍后重试',
        icon: 'none'
      });
      this.setData({ loading: false, loadingMore: false });
    }
  },

  async loadSummary() {
    const summary = await checkinService.getUserDiarySummary();
    const periods = (summary.periods || []).map(buildPeriodOption);
    const allOption = buildAllPeriodOption(summary.stats || {});
    const periodOptions = [allOption, ...periods];
    const selectedPeriodIndex = this.resolveSelectedPeriodIndex(periodOptions, this.data.periodId);
    const selectedPeriod = periodOptions[selectedPeriodIndex] || allOption;

    this.setData({
      stats: summary.stats || buildDefaultStats(),
      periodOptions,
      periodId: selectedPeriod.id,
      selectedPeriod,
      selectedPeriodIndex,
      selectedPeriodMetaLines: this.buildSelectedPeriodMetaLines(selectedPeriod),
      summaryLoaded: true
    });
  },

  resolveSelectedPeriodIndex(periodOptions, targetPeriodId) {
    if (!targetPeriodId || targetPeriodId === 'all') {
      return 0;
    }

    const index = periodOptions.findIndex(item => item.id === targetPeriodId);
    return index >= 0 ? index : 0;
  },

  async loadCheckinRecords({ reset }) {
    const nextPage = reset ? 1 : this.data.page + 1;
    const selectedPeriodId = this.data.periodId === 'all' ? '' : this.data.periodId;

    this.setData({
      loading: reset,
      loadingMore: !reset
    });

    try {
      const response = await checkinService.getUserCheckinsWithStats({
        page: nextPage,
        limit: this.data.limit,
        periodId: selectedPeriodId || undefined
      });

      const incoming = (response.list || [])
        .filter(item => typeof item.note === 'string' ? item.note.trim().length > 0 : !!item.note)
        .map(buildRecordItem);
      const mergedRecords = reset ? incoming : this.data.checkinRecords.concat(incoming);
      const total = response.pagination?.total || 0;
      const pages = response.pagination?.pages || 0;

      this.setData({
        checkinRecords: mergedRecords,
        page: nextPage,
        hasMore: pages > 0 ? nextPage < pages : mergedRecords.length < total,
        loading: false,
        loadingMore: false
      });
    } catch (error) {
      this.setData({
        loading: false,
        loadingMore: false
      });
      throw error;
    }
  },

  handlePeriodSelect(e) {
    const { periodId } = e.currentTarget.dataset;
    if (!periodId || periodId === this.data.periodId) {
      return;
    }

    const selectedPeriodIndex = this.data.periodOptions.findIndex(item => item.id === periodId);
    const selectedPeriod = this.data.periodOptions[selectedPeriodIndex];

    this.setData({
      periodId,
      selectedPeriodIndex,
      selectedPeriod,
      selectedPeriodMetaLines: this.buildSelectedPeriodMetaLines(selectedPeriod)
    });

    this.loadCheckinRecords({ reset: true }).catch(error => {
      console.error('切换期次失败:', error);
      wx.showToast({
        title: '加载期次失败',
        icon: 'none'
      });
      this.setData({
        loading: false,
        loadingMore: false
      });
    });
  },

  handleSelectedPeriodTap() {
    const { selectedPeriod } = this.data;
    if (!selectedPeriod || !selectedPeriod.id || selectedPeriod.id === 'all') {
      return;
    }

    wx.navigateTo({
      url: `/pages/courses/courses?periodId=${selectedPeriod.id}`
    });
  },

  handleRecordTap(e) {
    const { checkinId } = e.currentTarget.dataset;
    if (!checkinId) {
      wx.showToast({
        title: '缺少详情参数',
        icon: 'none'
      });
      return;
    }

    return this.openCheckinDetail(checkinId, e.currentTarget.dataset.sectionId);
  },

  async openCheckinDetail(checkinId, sectionId = '') {
    let targetSectionId = sectionId;

    try {
      if (!targetSectionId) {
        wx.showLoading({
          title: '正在打开...',
          mask: true
        });

        const detail = await checkinService.getCheckinDetail(checkinId);
        targetSectionId = detail?.sectionId?._id || detail?.sectionId || '';
      }

      if (!targetSectionId) {
        throw new Error('sectionId missing');
      }

      wx.navigateTo({
        url: `/pages/course-detail/course-detail?id=${targetSectionId}&checkinId=${checkinId}`
      });
    } catch (error) {
      console.error('打开打卡详情失败:', error);
      wx.showToast({
        title: '打开详情失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  buildSelectedPeriodMetaLines(selectedPeriod) {
    if (!selectedPeriod || selectedPeriod.id === 'all') {
      return [];
    }

    const lines = [];
    if (selectedPeriod.currentEnrollment) {
      lines.push(`${selectedPeriod.currentEnrollment}人参与本期共读`);
    }
    lines.push(`已完成${selectedPeriod.checkedDays || 0}次打卡`);
    lines.push(`共发布${selectedPeriod.diaryCount || 0}篇日记`);

    if (selectedPeriod.lastCheckinSection?.title) {
      lines.push(`最近一次：${selectedPeriod.lastCheckinSection.title}`);
    }

    return lines;
  }
});
