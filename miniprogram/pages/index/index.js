const { profileValues, isProfileUnchanged, profileError } = require('../../utils/profile-edit');
// 首页页面
const userService = require('../../services/user.service');
const authService = require('../../services/auth.service');
const courseService = require('../../services/course.service');
const enrollmentService = require('../../services/enrollment.service');
const checkinService = require('../../services/checkin.service');
const notificationServiceModule = require('../../services/notification.service');
const activityService = require('../../services/activity.service');
const communityActivityService = require('../../services/communityActivity.service');
const imprintService = require('../../services/imprint.service');
const completionReportService = require('../../services/completion-report.service');
const presenceService = require('../../services/presence.service');
const letterService = require('../../services/letter.service');
const practiceService = require('../../services/practice.service');
const buddyService = require('../../services/buddy.service');
const { getSolarTerm } = require('../../utils/solar-terms');
const constants = require('../../config/constants');
const request = require('../../utils/request');
const { formatNumber, formatDate } = require('../../utils/formatters');
const { richContentToPlainText } = require('../../utils/markdown');
const { getPeriodAccess, hasPaidEnrollment } = require('../../utils/period-access');
const {
  decorateSectionWithReadingCompletion
} = require('../../utils/reading-completion');
const {
  decorateUserAvatar,
  getLastTextChar,
  getUserAvatarDisplay
} = require('../../utils/avatar');
const subscribeAutoTopUp = require('../../utils/subscribe-auto-topup');
const { tenantStorage } = require('../../utils/storage');
const { THEME_PRIMARY } = require('../../utils/theme');
const { getDaypart } = require('../../utils/daypart');
const { isInsightUnread } = require('../../utils/insight-unread');
const {
  getLessonNumberingBase,
  getLessonNumber,
  formatLessonLabel,
  formatShortLessonLabel
} = require('../../utils/lesson');
const {
  buildInsightRequestDisplay,
  extractInsightRequests
} = require('../../utils/insight-request-display');
const {
  createPodcastAudioContext,
  setPodcastAudioSource,
  stopPodcastAudio
} = require('../../utils/podcast-audio');
const {
  getBrandName,
  getDefaultShareTitle,
  getDefaultShareImage
} = require('../../utils/brand');

const notificationService =
  notificationServiceModule.default || notificationServiceModule;

const MORNING_READ_PROMPT_KEY = 'morning_read_prompt_date';
const MORNING_READ_PROMPT_START_MINUTE = 5 * 60 + 55;
const MORNING_READ_PROMPT_END_MINUTE = 6 * 60 + 25;
const UPCOMING_ACTIVITIES_DISPLAY_LIMIT = 2;
const RECENT_CHECKIN_PREVIEW_MAX_LENGTH = 20;
const HOME_SECTION_KEYS = [
  'recentActivities',
  'todayTask',
  'zaichang',
  'myCheckins',
  'xiaofanInsights',
  'insightRequests',
  'campCorner'
];
const HOME_SECTION_LABELS = {
  recentActivities: '近期活动',
  todayTask: '今日任务',
  zaichang: '凡人生活',
  myCheckins: '我的打卡',
  xiaofanInsights: '小凡看见',
  insightRequests: '请求看见',
  campCorner: '营地角落'
};
function normalizeHomeSectionOrder(order, options = {}) {
  const appendMissing = options.appendMissing !== false;
  const source = Array.isArray(order) ? order : [];
  const valid = source
    .map((item) => (typeof item === 'string' ? item : item?.key))
    .filter((key) => HOME_SECTION_KEYS.includes(key));
  const unique = [...new Set(valid)];
  if (!appendMissing) {
    return unique;
  }
  const missing = HOME_SECTION_KEYS.filter((key) => !unique.includes(key));
  return [...unique, ...missing];
}

function getHiddenHomeSections(order) {
  if (!Array.isArray(order)) {
    return new Set();
  }
  return new Set(
    order
      .filter((item) => item && typeof item === 'object' && item.hidden === true)
      .map((item) => item.key)
      .filter((key) => HOME_SECTION_KEYS.includes(key))
  );
}

function buildHomeSectionItems(order, options = {}) {
  const hiddenSections = getHiddenHomeSections(order);
  const appendMissing = options.appendMissing !== false && hiddenSections.size === 0;
  return normalizeHomeSectionOrder(order, { appendMissing })
    .filter((key) => !hiddenSections.has(key))
    .map((key) => ({
    key,
    label: HOME_SECTION_LABELS[key]
  }));
}

function loadHomeConfig() {
  return request.get('/home-config', {}, {
    showLoading: false,
    suppressAuthError: true,
    suppressError: true
  });
}

const TASK_CARD_LAYOUT_RPX = {
  screenWidth: 750,
  contentPadding: 48,
  sectionPadding: 64,
  coverWidth: 160,
  cardGap: 24,
  avatarSize: 38,
  avatarStep: 28,
  badgeGap: 10,
  countCharWidth: 26,
  maxBackendAvatars: 10
};

function getVisibleTaskCheckinUsers(
  users = [],
  checkinCount = 0,
  communityEnabled = true
) {
  if (!communityEnabled || !Array.isArray(users) || users.length === 0) {
    return [];
  }

  const layout = TASK_CARD_LAYOUT_RPX;
  const availableWidth =
    layout.screenWidth -
    layout.contentPadding -
    layout.sectionPadding -
    layout.coverWidth -
    layout.cardGap;
  const countText = `${checkinCount || 0}人已打卡`;
  const countTextWidth = countText.length * layout.countCharWidth;
  const avatarWidthBudget =
    availableWidth - countTextWidth - layout.badgeGap;

  if (avatarWidthBudget < layout.avatarSize) {
    return [];
  }

  const maxAvatarCount =
    1 + Math.floor((avatarWidthBudget - layout.avatarSize) / layout.avatarStep);
  const visibleCount = Math.max(
    0,
    Math.min(users.length, layout.maxBackendAvatars, maxAvatarCount)
  );

  return users.slice(0, visibleCount);
}

function formatRecentCheckinDate(dateString) {
  if (!dateString) {
    return '';
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}.${day}`;
}

function getTimeValue(value) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getInsightPeriodSortTime(insight) {
  const period = insight?.periodId || {};
  return getTimeValue(period.endDate || period.startDate);
}

function getInsightDaySortValue(insight) {
  const day = insight?.sectionId?.day ?? insight?.day ?? 0;
  return Number(day) || 0;
}

function compareInsightsByPeriodAndDayDesc(a, b) {
  const periodDiff = getInsightPeriodSortTime(b) - getInsightPeriodSortTime(a);
  if (periodDiff !== 0) return periodDiff;

  const dayDiff = getInsightDaySortValue(b) - getInsightDaySortValue(a);
  if (dayDiff !== 0) return dayDiff;

  return getTimeValue(b.updatedAt || b.createdAt) - getTimeValue(a.updatedAt || a.createdAt);
}

function buildInsightCourseDisplay(item = {}) {
  const section = item.sectionId && typeof item.sectionId === 'object' ? item.sectionId : {};
  const day = section.day ?? item.day ?? null;
  const title = section.title || item.title || '学习反馈';

  return {
    dayLabel: day === null ? '' : formatShortLessonLabel(day),
    title
  };
}

function getInsightPeriodName(item = {}, periodNameById = new Map()) {
  const period = item.periodId && typeof item.periodId === 'object' ? item.periodId : {};
  const periodId = period._id || period.id || item.periodId || '';
  return String(
    period.name ||
    period.title ||
    item.periodName ||
    periodNameById.get(String(periodId)) ||
    ''
  ).trim();
}

function truncateText(text = '', maxLength = RECENT_CHECKIN_PREVIEW_MAX_LENGTH) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function getShortPeriodTitle(title = '') {
  const normalized = String(title || '').trim();
  return normalized.split(/\s*[-－—]\s*/)[0] || normalized;
}

// 「我的打卡」日期页签：大号的日 + 小号的月
function buildLeafDate(dateString) {
  const date = dateString ? new Date(dateString) : null;
  if (!date || Number.isNaN(date.getTime())) return { dayNum: '', monthLabel: '' };
  return { dayNum: String(date.getDate()), monthLabel: `${date.getMonth() + 1}月` };
}

function buildRecentCheckinCard(item) {
  const previewSource = richContentToPlainText(item.note || item.content || '')
    .replace(/\s+/g, ' ')
    .trim();
  const imageCount = Array.isArray(item.images) ? item.images.filter(Boolean).length : 0;
  const preview = truncateText(
    previewSource || (imageCount > 0 ? `分享了${imageCount}张图片` : '这篇打卡还没有填写正文')
  );
  const periodInfo =
    item.periodId && typeof item.periodId === 'object' ? item.periodId : {};
  const sectionInfo =
    item.sectionId && typeof item.sectionId === 'object' ? item.sectionId : {};
  const periodTitle = periodInfo.title || periodInfo.name || '我的打卡';

  return {
    id: item._id || item.id,
    sectionId: sectionInfo._id || sectionInfo.id || item.sectionId || '',
    periodId: periodInfo._id || periodInfo.id || item.periodId || '',
    periodFullTitle: periodTitle,
    periodTitle: getShortPeriodTitle(periodTitle),
    sectionTitle: sectionInfo.title || '打卡日记',
    preview,
    imageCount,
    likeCount: item.likeCount || 0,
    dayLabel: sectionInfo.day === null || sectionInfo.day === undefined
      ? ''
      : formatShortLessonLabel(sectionInfo.day),
    dateLabel: formatRecentCheckinDate(item.checkinDate || item.createdAt),
    ...buildLeafDate(item.checkinDate || item.createdAt),
    dateKey: buildCheckinDateKey(item.checkinDate || item.createdAt),
    icon: periodInfo.coverEmoji || periodInfo.icon || '📘',
    color: periodInfo.coverColor || periodInfo.color || THEME_PRIMARY
  };
}

function buildCheckinDateKey(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : getLocalDateKey(date);
}

const WELCOME_BACK_GAP_DAYS = 3;

// 隔了几天再回来时，今日卡片上的一句话：不数天数、不提落下了多少，只说从今天接着读
function buildWelcomeBackText({ todaySection, recentCheckins, totalCheckinDays, periodDayIndex, now = new Date() } = {}) {
  if (!todaySection || todaySection.isCheckedIn) return '';
  const keys = (recentCheckins || []).map(item => item && item.dateKey).filter(Boolean).sort();
  const lastKey = keys[keys.length - 1];
  if (lastKey) {
    const today = new Date(`${getLocalDateKey(now)}T00:00:00`);
    const last = new Date(`${lastKey}T00:00:00`);
    const gapDays = Math.round((today - last) / 86400000);
    return gapDays >= WELCOME_BACK_GAP_DAYS
      ? '有几天没见了，回来就好。从今天这一课接着读，前面的不用急着补。'
      : '';
  }
  if (Number(totalCheckinDays) === 0 && Number(periodDayIndex) >= WELCOME_BACK_GAP_DAYS) {
    return '营里已经读了几天，从今天这一课开始就好，前面的不用补。';
  }
  return '';
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateAtDayBoundary(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date;
}

function isPeriodEnded(period = {}, todayDate = new Date()) {
  const targetPeriod = period || {};
  const endDate = getDateAtDayBoundary(targetPeriod.endDate || targetPeriod.endTime, true);
  if (!endDate) return false;
  return todayDate > endDate;
}

function isPeriodActiveToday(period = {}, todayDate = new Date()) {
  const targetPeriod = period || {};
  const startDate = getDateAtDayBoundary(targetPeriod.startDate || targetPeriod.startTime);
  const endDate = getDateAtDayBoundary(targetPeriod.endDate || targetPeriod.endTime, true);
  if (!startDate || !endDate) return false;
  return todayDate >= startDate && todayDate <= endDate;
}

function getSectionDay(section = {}) {
  const day = Number(section.day);
  return Number.isFinite(day) ? day : null;
}

function getPeriodTotalDays(period = {}) {
  const totalDays = Number(period.totalDays);
  return Number.isFinite(totalDays) && totalDays > 0 ? totalDays : null;
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const JOURNEY_MAX_TICKS = 31;
const TODAY_EXTRACT_MAX_CHARS = 40;

function formatHomeDateText(date = new Date()) {
  const base = `${date.getMonth() + 1}月${date.getDate()}日 周${WEEKDAY_LABELS[date.getDay()]}`;
  const pad = (n) => String(n).padStart(2, '0');
  const term = getSolarTerm(`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
  return term ? `${base} · ${term}` : base;
}

// 同行感：东八区 05:30–08:00 优先显示“此刻在读”，否则显示“今天读完”，都没有则不显示
function buildPresenceText(presence, now = new Date()) {
  if (!presence) return '';
  const bjt = new Date(now.getTime() + 8 * 3600000);
  const minute = bjt.getUTCHours() * 60 + bjt.getUTCMinutes();
  const inWindow = minute >= 5 * 60 + 30 && minute < 8 * 60;
  if (inWindow && presence.readingNow !== null && presence.readingNow !== undefined) {
    return `此刻有 ${presence.readingNow} 位书友也在读`;
  }
  if (presence.completedToday !== null && presence.completedToday !== undefined) {
    return `今天已有 ${presence.completedToday} 位书友读完`;
  }
  return '';
}

// 日签出处：第 N 天 · 课程标题；算不出第几天时只用标题且不带 day
function buildDailyCardSource(section = {}) {
  const n = Number(section.lessonNumber);
  const title = section.title || '';
  if (!Number.isFinite(n) || n < 1) return { source: title, day: '' };
  return { source: `第 ${n} 天${title ? ` · ${title}` : ''}`, day: n };
}

// 营地角落：根据三个接口的返回算出卡片（没有内容的卡片不出现）
function buildCampCornerCards({ letter, practice, buddy } = {}) {
  const cards = [];
  if (letter) {
    const status = letter.status;
    if (letter.canWrite && (status === 'none' || status === 'draft')) {
      cards.push({ key: 'letter', kind: 'letter', title: '给结营那天的自己写封信' });
    } else if (status === 'sealed') {
      cards.push({ key: 'letter', kind: 'letter', title: `信在路上，还有 ${letter.daysToDeliver || 0} 天` });
    } else if (status === 'delivered') {
      cards.push({ key: 'letter', kind: 'letter', title: '有一封信到了' });
    }
  }
  if (practice && practice.active) {
    const text = practice.practice && (practice.practice.text || (typeof practice.practice === 'string' ? practice.practice : ''));
    if (!text) {
      cards.push({ key: 'practice', kind: 'practice', title: '给这一周定一个小行动' });
    } else {
      const done = practice.today && practice.today.done;
      cards.push({
        key: 'practice',
        kind: 'practice',
        title: text,
        sub: done === true ? '已记「做到了」' : done === false ? '今天没有' : '今天还没记',
        single: true
      });
    }
  }
  if (buddy) {
    if (buddy.state === 'none') {
      cards.push({ key: 'buddy', kind: 'buddy', title: '想要一位读伴' });
    } else if (buddy.state === 'waiting') {
      cards.push({ key: 'buddy', kind: 'buddy', title: '正在等一位读伴' });
    } else if (buddy.state === 'paired' && buddy.buddy) {
      cards.push({
        key: 'buddy',
        kind: 'buddy',
        title: buddy.buddy.nickname || '读伴',
        paired: true,
        read: !!buddy.buddy.readToday,
        checked: !!buddy.buddy.checkedInToday
      });
    }
  }
  return cards.slice(0, 3);
}

// 期次第几天（以日期计，从 1 开始）；不在期次内或缺少日期时返回 null
function getPeriodDayIndex(period, today = new Date()) {
  if (!period) return null;
  const start = getDateAtDayBoundary(period.startDate || period.startTime);
  if (!start) return null;
  const todayStart = getDateAtDayBoundary(today);
  const dayIndex = Math.round((todayStart - start) / 86400000) + 1;
  return dayIndex >= 1 ? dayIndex : null;
}

function getPeriodJourneyTotalDays(period) {
  const fromField = getPeriodTotalDays(period || {});
  if (fromField) return fromField;
  const start = getDateAtDayBoundary(period?.startDate || period?.startTime);
  const end = getDateAtDayBoundary(period?.endDate || period?.endTime);
  if (!start || !end) return null;
  const total = Math.round((end - start) / 86400000) + 1;
  return total > 0 ? total : null;
}

// 旅程地平线：每天一个刻度，最多 31 个；拿不到总天数或今天第几天时返回 null
function buildJourneyTicks(dayIndex, totalDays) {
  if (!dayIndex || !totalDays || dayIndex > totalDays) return null;
  const count = Math.min(totalDays, JOURNEY_MAX_TICKS);
  const todayPos =
    totalDays <= JOURNEY_MAX_TICKS
      ? dayIndex - 1
      : Math.round(((dayIndex - 1) / (totalDays - 1)) * (count - 1));
  return Array.from({ length: count }, (_, index) => ({
    state: index < todayPos ? 'past' : index === todayPos ? 'today' : 'future'
  }));
}

// 「摘一摘」富文本 -> 前 40 个字的纯文本；没有则返回空串
function buildTodayExtractText(extract) {
  if (!extract || typeof extract !== 'string') return '';
  const text = extract
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(text);
  if (chars.length <= TODAY_EXTRACT_MAX_CHARS) return text;
  return `${chars.slice(0, TODAY_EXTRACT_MAX_CHARS).join('')}…`;
}

// 今日晨读卡：由 todaySection 与社群状态得出主按钮、步骤条和文字入口
// 已打卡即视为已读完（读纸书或在会议里读完的书友不会触发 readingCompleted）
function buildTodayCardState(todaySection, communityEnabled) {
  const section = todaySection || {};
  const checkedIn = !!section.isCheckedIn;
  const read = !!section.readingCompleted || checkedIn;

  let primary;
  if (communityEnabled && checkedIn) {
    primary = { type: 'done', text: '今天读完了，明早见' };
  } else if (!read) {
    primary = { type: 'read', text: '开始晨读' };
  } else if (communityEnabled) {
    primary = { type: 'checkin', text: '去打卡' };
  } else {
    primary = { type: 'study', text: '去学习' };
  }

  const defs = [{ key: 'read', label: '读一读', done: read }];
  if (communityEnabled) defs.push({ key: 'checkin', label: '写打卡', done: checkedIn });
  if (section.podcastUrl) defs.push({ key: 'podcast', label: '听播客', done: false, optional: true });
  let currentAssigned = false;
  const steps = defs.map((def, index) => {
    let state = def.done ? 'done' : 'todo';
    if (!def.done && !def.optional && !currentAssigned) {
      state = 'current';
      currentAssigned = true;
    }
    return { key: def.key, label: def.label, state, dot: def.done ? '✓' : String(index + 1) };
  });

  return {
    primary,
    steps,
    showDirectCheckin: communityEnabled && !checkedIn && !read,
    showStudy: !communityEnabled && !read,
    showReread: read
  };
}

function isClosingSection(section = {}) {
  const title = String(section.title || section.name || '').trim();
  const hasClosingVideo = !!(
    section.closingVideo?.url ||
    section.closingVideoUrl ||
    section.closingVideoVisible
  );
  return hasClosingVideo || /结营|结课|结业|闭营|总结|复盘/.test(title);
}

function isLastPeriodDay(section = {}, period = {}) {
  const day = getSectionDay(section);
  const totalDays = getPeriodTotalDays(period);
  if (day === null || totalDays === null) return false;

  return day === totalDays;
}

function shouldShowReportShortcut(section = {}, period = {}, options = {}) {
  return (
    options.forceFinal === true ||
    isClosingSection(section) ||
    isLastPeriodDay(section, period)
  );
}

function selectFallbackTodaySection(sections = [], options = {}) {
  const candidates = (Array.isArray(sections) ? sections : [])
    .filter((section) => {
      const day = getSectionDay(section);
      return day !== null && day > 0;
    })
    .sort((a, b) => getSectionDay(a) - getSectionDay(b));

  if (candidates.length === 0) return null;

  if (options.periodEnded) {
    const closingSection = [...candidates].reverse().find(isClosingSection);
    return closingSection || candidates[candidates.length - 1];
  }

  return candidates.find((section) => !section.isCheckedIn) || candidates[0];
}

function buildTodayTaskEmptyState(period = null, options = {}) {
  if (options.noEnrollment) {
    return {
      type: 'no-enrollment',
      icon: '+',
      coverLabel: '未加入',
      title: '还没有加入晨读营',
      description: '加入一期晨读营后，这里会显示每天的晨读与打卡任务。',
      periodId: '',
      primaryAction: { text: '选择晨读营', type: 'periods' },
      secondaryActions: []
    };
  }

  if (period && options.periodEnded) {
    const periodId = period._id || period.id || '';
    const periodTitle = period.title || period.name || '本期晨读营';
    return {
      type: 'period-ended',
      icon: '✓',
      coverLabel: '已结营',
      title: `${periodTitle}读完了`,
      description: '这些天读过的、写下的、被看见的，都收在这一期的纪念册里。新一期开营后，这里会换成新的晨读。',
      periodId,
      primaryAction: periodId ? { text: '翻开纪念册', type: 'keepsake' } : null,
      secondaryActions: [
        ...(options.hasReport ? [{ text: '看结营实录', type: 'report' }] : []),
        { text: '回看课程', type: 'courses' }
      ]
    };
  }

  return {
    type: 'no-active-period',
    icon: '☀',
    coverLabel: '待开启',
    title: '今天没有安排晨读，好好休息',
    description: '当前没有进行中的晨读营，新一期开放后会更新。',
    periodId: '',
    primaryAction: { text: '看看全部期次', type: 'periods' },
    secondaryActions: []
  };
}

function isMorningReadPromptTime(date = new Date()) {
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  return (
    minuteOfDay >= MORNING_READ_PROMPT_START_MINUTE &&
    minuteOfDay <= MORNING_READ_PROMPT_END_MINUTE
  );
}

function buildReadingModeUrl(sectionId, periodId = '', section = {}) {
  const params = [
    `id=${encodeURIComponent(sectionId)}`,
    `periodId=${encodeURIComponent(periodId || '')}`
  ];

  if (section.readingCompleted) {
    params.push('readingCompleted=1');
    params.push(
      `readingDurationMs=${encodeURIComponent(section.readingDurationMs || 0)}`
    );
    if (section.readingCompletedAt) {
      params.push(
        `readingCompletedAt=${encodeURIComponent(section.readingCompletedAt)}`
      );
    }
  }

  return `/pages/reading-mode/reading-mode?${params.join('&')}`;
}

Page({
  // 暴露纯函数，便于单测
  buildTodayCardState,
  buildWelcomeBackText,
  buildPresenceText,
  buildCampCornerCards,
  buildDailyCardSource,
  formatHomeDateText,

  data: {
    // 用户信息
    userInfo: null,
    isLogin: false,
    hasValidSignature: false,

    // 晨光问候区
    daypart: 'day',
    greeting: '上午好',
    dateText: '',
    periodDayText: '',
    journeyTicks: [],

    // 当前期次
    currentPeriod: null,
    currentPeriodPaymentStatus: null,
    canAccessCurrentPeriodCommunity: false,
    currentPeriodCommunityState: 'locked',
    canUsePaidFeatures: false,
    presenceText: '',
    campCornerCards: [],
    campCornerStatus: 'idle',

    // 今日课节
    todaySection: null,
    todayCard: null,
    todayTaskEmptyState: null,
    currentPeriodReport: null,
    showMorningReadPrompt: false,

    // 播客播放状态（同步自 globalData）
    podcastPlaying: false,
    podcastSectionId: '',

    // 统计信息
    stats: {
      current_day: 1,
      total_days: 23
    },

    // 最近的小凡看见（最多3条）
    recentInsights: [],
    recentOtherInsights: [],
    insightActiveTab: 'mine',
    otherInsightsLoading: false,

    // 最近的打卡日记（最多3条）
    recentCheckins: [],
    welcomeBackText: '',
    periodDayIndex: 0,

    // 凡人生活（在场印记，最多3条）
    zaichangImprints: [],

    // 小凡看见请求列表
    requestDirectionTabs: [
      { value: 'received', label: '收到的' },
      { value: 'sent', label: '我发起的' }
    ],
    activeInsightRequestDirection: 'received',
    receivedInsightRequests: [],
    sentInsightRequests: [],
    insightRequests: [],
    allInsightRequests: [],
    insightRequestTotal: 0,
    insightRequestEmptyText: '还没有收到请求',
    focusRequestId: '',
    focusInsightId: '',
    highlightRequestId: '',
    unreadNotificationCount: 0,

    // 去晨读入口（腾讯会议入口暂时屏蔽）
    hasMeeting: false,
    meetingId: '',
    meetingJoinUrl: '',

    // 加载状态
    loading: true,

    // 活动弹窗
    showActivityPopup: false,
    popupActivity: null,
    upcomingActivities: [],
    upcomingActivitiesHasMore: false,
    homeSections: buildHomeSectionItems(HOME_SECTION_KEYS),

    // 编辑个人信息相关
    showEditProfile: false,
    nicknameError: '',
    profileSaveHint: '',
    isSavingProfile: false,
    themePrimaryColor: THEME_PRIMARY,
    brandName: getBrandName(),
    editForm: {
      avatar: '🦁',
      avatarUrl: '',
      nickname: '',
      signature: ''
    }
  },

  onLoad(options) {
    this.captureInsightRequestFocus(options);
  },

  onShow() {
    this._isPageAlive = true;
    this._isPageVisible = true;
    const app = getApp();
    this.refreshDaypart();
    // 同步播客播放状态
    this.setData({
      podcastPlaying: !!app.globalData.podcastPlaying,
      podcastSectionId: app.globalData.podcastSectionId || ''
    });
    // 打卡新增或删除时强制刷新"我的打卡"列表（跳过节流）
    if (app.globalData.checkinListDirty) {
      console.log('[首页 onShow] 检测到 checkinListDirty，强制刷新我的打卡');
      app.globalData.checkinListDirty = false;
      this.loadRecentCheckins().then(recentCheckins => {
        this.setData({ recentCheckins, welcomeBackText: this.buildWelcomeBack(recentCheckins) });
        console.log('[首页 onShow] 我的打卡已刷新，条数:', recentCheckins.length);
      }).catch(() => {});
    }
    // 登录状态每次都检查；全量数据刷新 30 秒内只做一次
    const now = Date.now();
    const shouldRefreshData = !this._lastLoadTime || now - this._lastLoadTime >= 30000;
    if (shouldRefreshData) {
      this._lastLoadTime = now;
    }
    this.checkLoginStatus({ refreshUserData: shouldRefreshData });

    // 通知页可能只改变未读数；首页数据刷新有 30 秒节流，但铃铛数字需要每次返回首页都同步。
    if (!shouldRefreshData && this.data.isLogin) {
      this.loadUnreadNotificationCount();
    }
  },

  /**
   * 晨光问候区：按时段更新问候、日期与导航栏底色（只影响首页）
   */
  refreshDaypart() {
    const now = new Date();
    const daypart = getDaypart(now);
    this.setData({
      daypart: daypart.key,
      greeting: daypart.greeting,
      dateText: formatHomeDateText(now)
    });
    try {
      wx.setNavigationBarColor({
        frontColor: daypart.navFront,
        backgroundColor: daypart.navBackground
      });
    } catch (error) {
      console.warn('设置首页导航栏颜色失败:', error);
    }
  },

  onHide() {
    this._isPageVisible = false;
  },

  onUnload() {
    this._isPageVisible = false;
    this._isPageAlive = false;
  },

  setPodcastUiData(data) {
    if (!this._isPageVisible || this._isPageAlive === false) return;
    this.setData(data);
  },

  onPullDownRefresh() {
    this.loadUserData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus(options = {}) {
    const { refreshUserData = false } = options;
    const app = getApp();
    const token = tenantStorage.get(constants.STORAGE_KEYS.TOKEN);
    const storedUserInfo = token
      ? tenantStorage.get(constants.STORAGE_KEYS.USER_INFO)
      : null;
    const isLogin = !!(token && storedUserInfo);
    const userInfo = isLogin ? storedUserInfo : null;
    const hasValidSignature = !!(
      userInfo && this.isValidSignature(userInfo.signature)
    );

    if (isLogin) {
      app.globalData.isLogin = true;
      app.globalData.userInfo = userInfo;
      app.globalData.token = token;
    } else {
      app.globalData.isLogin = false;
      app.globalData.userInfo = null;
      app.globalData.token = null;
    }

    const nextData = {
      isLogin,
      userInfo,
      hasValidSignature,
      loading: isLogin ? !!refreshUserData : false
    };

    if (!isLogin) {
      Object.assign(nextData, {
        currentPeriod: null,
        periodDayText: '',
        journeyTicks: [],
        currentPeriodPaymentStatus: null,
        canAccessCurrentPeriodCommunity: false,
        currentPeriodCommunityState: 'locked',
        canUsePaidFeatures: false,
        presenceText: '',
        campCornerCards: [],
        campCornerStatus: 'idle',
        todaySection: null,
        todayCard: null,
        todayTaskEmptyState: null,
        currentPeriodReport: null,
        showMorningReadPrompt: false,
        recentCheckins: [],
        welcomeBackText: '',
        periodDayIndex: 0,
        recentInsights: [],
        receivedInsightRequests: [],
        sentInsightRequests: [],
        insightRequests: [],
        allInsightRequests: [],
        insightRequestTotal: 0,
        insightRequestEmptyText: this.getInsightRequestEmptyText(
          this.data.activeInsightRequestDirection
        ),
        unreadNotificationCount: 0,
        hasMeeting: false,
        meetingId: '',
        meetingJoinUrl: ''
      });
    }

    this.setData(nextData, () => {
      this.updateTabBarVisibility(isLogin);

      if (isLogin && refreshUserData) {
        this.loadUserData(true);
        this.loadUnreadNotificationCount();
        this.loadPopupActivity();
        this.loadUpcomingActivities();
      }
    });
  },

  updateTabBarVisibility() {
    // 使用自定义 tabBar，不操作原生 tabBar
  },

  captureInsightRequestFocus(options = {}) {
    const focusRequestId = options.focusRequestId || options.requestId || '';
    const focusInsightId = options.focusInsightId || options.insightId || '';

    if (!focusRequestId && !focusInsightId) {
      return;
    }

    this.setData({
      focusRequestId,
      focusInsightId
    });
  },

  getInsightRequestPreview(requests = []) {
    const topRequests = requests.slice(0, 3);
    const { focusRequestId, focusInsightId } = this.data;

    if (!focusRequestId && !focusInsightId) {
      return topRequests;
    }

    const focusedRequest = requests.find((item) => {
      const requestId = item._id || item.id;
      const insightId = item.insightId;
      return (
        (focusRequestId && String(requestId) === String(focusRequestId)) ||
        (focusInsightId && String(insightId) === String(focusInsightId))
      );
    });

    if (!focusedRequest) {
      return topRequests;
    }

    const focusedRequestId = focusedRequest._id || focusedRequest.id;
    const alreadyVisible = topRequests.some(
      (item) => String(item._id || item.id) === String(focusedRequestId)
    );

    if (alreadyVisible) {
      return topRequests;
    }

    return [
      focusedRequest,
      ...topRequests
        .filter((item) => String(item._id || item.id) !== String(focusedRequestId))
        .slice(0, 2)
    ];
  },

  getInsightRequestEmptyText(direction = 'received') {
    return direction === 'sent'
      ? '你还没有发起过看见请求'
      : '还没有收到请求';
  },

  getInsightRequestListForDirection(requestGroups = {}, direction = 'received') {
    return direction === 'sent'
      ? requestGroups.sentInsightRequests || []
      : requestGroups.receivedInsightRequests || [];
  },

  setInsightRequestDirection(direction) {
    const nextDirection = direction === 'sent' ? 'sent' : 'received';
    const requestGroups = {
      receivedInsightRequests: this.data.receivedInsightRequests,
      sentInsightRequests: this.data.sentInsightRequests
    };
    const allInsightRequests = this.getInsightRequestListForDirection(
      requestGroups,
      nextDirection
    );

    this.setData(
      {
        activeInsightRequestDirection: nextDirection,
        allInsightRequests,
        insightRequests: this.getInsightRequestPreview(allInsightRequests),
        insightRequestTotal: allInsightRequests.length,
        insightRequestEmptyText: this.getInsightRequestEmptyText(nextDirection)
      },
      () => this.revealFocusedInsightRequest()
    );
  },

  handleInsightRequestDirectionTap(e) {
    const direction = e.currentTarget.dataset.direction;
    if (!direction || direction === this.data.activeInsightRequestDirection) {
      return;
    }

    this.setInsightRequestDirection(direction);
  },

  findFocusedInsightRequest(requests = this.data.insightRequests) {
    const { focusRequestId, focusInsightId } = this.data;

    if (!focusRequestId && !focusInsightId) {
      return null;
    }

    return requests.find((item) => {
      const requestId = item._id || item.id;
      const insightId = item.insightId;
      return (
        (focusRequestId && String(requestId) === String(focusRequestId)) ||
        (focusInsightId && String(insightId) === String(focusInsightId))
      );
    });
  },

  revealFocusedInsightRequest() {
    const focusedRequest = this.findFocusedInsightRequest();
    if (!focusedRequest) {
      return;
    }

    const requestId = focusedRequest._id || focusedRequest.id;
    const selector = `#request-${requestId}`;

    clearTimeout(this._requestHighlightTimer);
    setTimeout(() => {
      this.setData({ highlightRequestId: requestId });
      wx.pageScrollTo({
        selector,
        offsetTop: 96,
        duration: 520,
        fail: () => {
          wx.pageScrollTo({ scrollTop: 760, duration: 520 });
        }
      });

      this._requestHighlightTimer = setTimeout(() => {
        if (this.data.highlightRequestId === requestId) {
          this.setData({ highlightRequestId: '' });
        }
      }, 3600);
    }, 120);
  },

  /**
   * 加载用户数据
   */
  async loadUserData(forceLoggedIn = false) {
    if (!(forceLoggedIn || this.data.isLogin)) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });

    try {
      // ── Wave 1: 所有独立请求并行 ──────────────────────────────
      const [userInfo, stats, periods, userEnrollments, taskRes, homeConfig] =
        await Promise.all([
          userService.getUserProfile(),
          userService.getUserStats(),
          courseService.getPeriods(),
          enrollmentService
            .getUserEnrollments({ limit: 100 })
            .catch(() => ({ list: [] })),
          courseService.getTodayTask().catch(() => null),
          loadHomeConfig().catch(() => null)
        ]);

      const displayUserInfo = decorateUserAvatar(userInfo);
      const app = getApp();
      app.globalData.userInfo = displayUserInfo;
      tenantStorage.set(constants.STORAGE_KEYS.USER_INFO, displayUserInfo);

      // 计算当前期次
      const periodsList = periods.list || periods.items || periods || [];
      this._periodNameById = new Map(
        periodsList
          .map((period) => [
            String(period._id || period.id || ''),
            period.name || period.title || ''
          ])
          .filter(([id, name]) => id && name)
      );
      const enrollmentList = userEnrollments.list || userEnrollments || [];
      const enrolledPeriodIds = enrollmentList
        .filter((e) => e.status === 'active' || e.status === 'completed')
        .map((e) => e.periodId?._id || e.periodId);
      const hasEnrollment = enrolledPeriodIds.length > 0;
      const enrolledPeriods = periodsList.filter((p) =>
        enrolledPeriodIds.includes(p._id)
      );

      let currentPeriod = null;
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      for (const period of enrolledPeriods) {
        if (isPeriodActiveToday(period, todayDate)) {
          currentPeriod = period;
          break;
        }
      }
      if (!currentPeriod)
        currentPeriod =
          enrolledPeriods.find((p) => p.status === 'ongoing') || null;
      if (!currentPeriod && enrolledPeriods.length > 0) {
        currentPeriod = [...enrolledPeriods].sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        )[0];
      }

      const hasValidTask = !!(taskRes && taskRes.sectionId);

      // taskRes 返回了 periodId，优先用它来确定当前期次
      if (hasValidTask && taskRes.periodId && periodsList.length > 0) {
        const foundPeriod = periodsList.find(
          (p) => p._id === taskRes.periodId || p.id === taskRes.periodId
        );
        if (foundPeriod && isPeriodActiveToday(foundPeriod, todayDate)) {
          currentPeriod = foundPeriod;
        }
      }

      const currentPeriodId = currentPeriod?._id || currentPeriod?.id || null;
      const currentPeriodActiveToday = isPeriodActiveToday(currentPeriod, todayDate);
      const periodEnded = isPeriodEnded(currentPeriod, todayDate);
      const taskMatchesCurrentPeriod =
        hasValidTask &&
        (!taskRes.periodId ||
          String(taskRes.periodId) === String(currentPeriodId || ''));
      const shouldUseTodayTask =
        hasValidTask && currentPeriodActiveToday && taskMatchesCurrentPeriod;

      // ── Wave 2: 依赖 Wave1 的两个请求并行 ──────────────────────
      const [sectionRes, currentPeriodAccess, currentPeriodSectionsRes] = await Promise.all([
        shouldUseTodayTask
          ? courseService.getSectionDetail(taskRes.sectionId)
          : Promise.resolve(null),
        currentPeriodId
          ? getPeriodAccess(currentPeriodId, {
            enrollmentList,
            skipRequest: true
          })
          : Promise.resolve({
            canAccessCommunity: false,
            communityAccessState: 'locked',
            paymentStatus: null
          }),
        currentPeriodId && currentPeriodActiveToday
          ? Promise.resolve(courseService.getPeriodSections(currentPeriodId)).catch(() => null)
          : Promise.resolve(null)
      ]);
      const currentPeriodSections = currentPeriodSectionsRes?.list
        || currentPeriodSectionsRes?.items
        || currentPeriodSectionsRes
        || [];
      const lessonNumberingBase = getLessonNumberingBase(
        (Array.isArray(currentPeriodSections) ? currentPeriodSections : [])
          .map(section => section.day)
      );

      // 构建 todaySection（只保留展示需要的字段，避免传输全课节内容）
      let todaySection = null;
      const d = new Date();
      const displayDate = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} 全天`;
      const communityEnabled = currentPeriodAccess.canAccessCommunity === true;
      let todayTaskEmptyState = null;

      if (shouldUseTodayTask && sectionRes) {
        const sectionForShortcut = {
          ...sectionRes,
          day: sectionRes.day ?? taskRes.day
        };
        const checkinUsers = (taskRes.checkinUsers || [])
          .slice(0, TASK_CARD_LAYOUT_RPX.maxBackendAvatars)
          .map((user) => ({
            ...user,
            ...getUserAvatarDisplay(user, {
              userId: user._id || user.userId,
              displayName: user.nickname || user.name || '用户'
            })
          }));
        todaySection = {
          _id: sectionRes._id || taskRes.sectionId,
          id: sectionRes.id || taskRes.sectionId,
          day: taskRes.day,
          dayDisplay: formatLessonLabel(taskRes.day, lessonNumberingBase),
          lessonNumber: getLessonNumber(taskRes.day, lessonNumberingBase),
          title: sectionRes.title,
          periodId: taskRes.periodId,
          periodTitle: taskRes.periodTitle,
          checkinCount: taskRes.checkinCount || 0,
          checkinUsers,
          visibleCheckinUsers: getVisibleTaskCheckinUsers(
            checkinUsers,
            taskRes.checkinCount || 0,
            communityEnabled
          ),
          isCheckedIn: !!(taskRes.isCheckedIn || sectionRes.isCheckedIn),
          progress: taskRes.isCheckedIn || sectionRes.isCheckedIn ? 100 : 0,
          readingCompleted: !!(
            taskRes.readingCompleted || sectionRes.readingCompleted
          ),
          readingCompletedAt:
            taskRes.readingCompletedAt || sectionRes.readingCompletedAt || null,
          readingDurationMs:
            taskRes.readingDurationMs || sectionRes.readingDurationMs || 0,
          coverColor:
            sectionRes.coverColor || currentPeriod?.coverColor || THEME_PRIMARY,
          coverEmoji:
            sectionRes.coverEmoji || currentPeriod?.coverEmoji || '🏔️',
          subtitleDisplay: (sectionRes.subtitle || '').replace(/至$/, ''),
          extractText: buildTodayExtractText(sectionRes.extract),
          displayDate,
          podcastUrl: sectionRes.podcastUrl || null,
          podcastDuration: sectionRes.podcastDuration || null,
          canShowReportShortcut: shouldShowReportShortcut(
            sectionForShortcut,
            currentPeriod
          )
        };
      } else if (currentPeriodActiveToday && currentPeriodId) {
        // 仅进行中的期次允许兜底找未打卡课节；已结束期次不再伪装成今日任务。
        try {
          const sections = currentPeriodSections;
          const section = selectFallbackTodaySection(sections, {
            periodEnded
          });
          if (section) {
            todaySection = {
              _id: section._id,
              id: section.id,
              day: section.day,
              dayDisplay: formatLessonLabel(section.day, lessonNumberingBase),
              lessonNumber: getLessonNumber(section.day, lessonNumberingBase),
              title: section.title,
              periodId: currentPeriodId,
              periodTitle: currentPeriod?.title,
              checkinCount: section.checkinCount || 0,
              checkinUsers: [],
              visibleCheckinUsers: [],
              isCheckedIn: !!section.isCheckedIn,
              progress: section.isCheckedIn ? 100 : 0,
              readingCompleted: !!section.readingCompleted,
              readingCompletedAt: section.readingCompletedAt || null,
              readingDurationMs: section.readingDurationMs || 0,
              coverColor: currentPeriod?.coverColor || THEME_PRIMARY,
              coverEmoji: currentPeriod?.coverEmoji || '🏔️',
              subtitleDisplay: (section.subtitle || '').replace(/至$/, ''),
              extractText: buildTodayExtractText(section.extract),
              displayDate,
              podcastUrl: section.podcastUrl || null,
              podcastDuration: section.podcastDuration || null,
              canShowReportShortcut: shouldShowReportShortcut(
                section,
                currentPeriod,
                { forceFinal: periodEnded }
              )
            };
          }
        } catch (e) {
          console.error('降级获取课节失败:', e);
        }
      }

      if (!todaySection) {
        todayTaskEmptyState = buildTodayTaskEmptyState(currentPeriod, {
          periodEnded,
          noEnrollment: !hasEnrollment
        });
      }

      const paidFeatureAccessEnabled =
        communityEnabled || hasPaidEnrollment(enrollmentList);
      const canLoadReportShortcut =
        !!todaySection?.canShowReportShortcut &&
        (
          communityEnabled ||
          ['paid', 'free'].includes(currentPeriodAccess.paymentStatus || '')
        );
      const canLoadEndedPeriodReport =
        !!todayTaskEmptyState &&
        todayTaskEmptyState.type === 'period-ended' &&
        (
          communityEnabled ||
          ['paid', 'free'].includes(currentPeriodAccess.paymentStatus || '')
        );
      getApp().globalData.canUsePaidFeatures = paidFeatureAccessEnabled;
      if (todaySection) {
        todaySection = decorateSectionWithReadingCompletion(todaySection);
      }

      // 只存展示字段，避免 setData 传输整个 period 对象
      const currentPeriodDisplay = currentPeriod
        ? {
          _id: currentPeriod._id,
          id: currentPeriod.id,
          name: currentPeriod.name,
          title: currentPeriod.title,
          coverColor: currentPeriod.coverColor,
          coverEmoji: currentPeriod.coverEmoji,
          status: currentPeriod.status,
          meetingId: currentPeriod.meetingId || '',
          meetingJoinUrl: currentPeriod.meetingJoinUrl || ''
        }
        : null;

      const periodDayIndex = getPeriodDayIndex(currentPeriod, todayDate);
      // 期次在进行中但总天数拿不到或比今天还小（比如按周排课的期次），就以今天为终点画地平线
      const journeyTotalDays = getPeriodJourneyTotalDays(currentPeriod);
      const journeyTicks =
        buildJourneyTicks(
          periodDayIndex,
          currentPeriodActiveToday && periodDayIndex
            ? Math.max(journeyTotalDays || 0, periodDayIndex)
            : journeyTotalDays
        ) || [];
      const periodName = currentPeriod?.name || currentPeriod?.title || '';
      const periodDayText =
        periodName && periodDayIndex && currentPeriodActiveToday
          ? `${periodName} 第 ${periodDayIndex} 天`
          : '';

      // ── Wave 2 完成后立即渲染主内容，消除转圈 ──────────────────
      this.setData(
        {
          journeyTicks,
          periodDayText,
          periodDayIndex: currentPeriodActiveToday ? periodDayIndex || 0 : 0,
          userInfo: displayUserInfo,
          hasValidSignature: !!this.isValidSignature(
            displayUserInfo && displayUserInfo.signature
          ),
          userStats: stats,
          currentPeriod: currentPeriodDisplay,
          currentPeriodPaymentStatus: currentPeriodAccess.paymentStatus || null,
          canAccessCurrentPeriodCommunity: communityEnabled,
          currentPeriodCommunityState:
            currentPeriodAccess.communityAccessState || 'locked',
          canUsePaidFeatures: paidFeatureAccessEnabled,
          homeSections: buildHomeSectionItems(homeConfig?.sections, {
            appendMissing: !homeConfig?.sections
          }),
          todaySection: todaySection || null,
          todayCard: todaySection
            ? buildTodayCardState(todaySection, communityEnabled)
            : null,
          todayTaskEmptyState: todayTaskEmptyState || null,
          hasMeeting: !!todaySection,
          meetingId: currentPeriod?.meetingId || '',
          meetingJoinUrl: currentPeriod?.meetingJoinUrl || '',
          loading: false
        },
        () => {
          this.maybeShowMorningReadPrompt();
          if (canLoadReportShortcut) {
            this.loadCurrentPeriodReport(currentPeriodId);
          } else if (canLoadEndedPeriodReport) {
            this.loadCurrentPeriodReport(currentPeriodId, {
              updateEmptyState: true
            });
          } else {
            this.setData({ currentPeriodReport: null });
          }
        }
      );

      // ── Wave 3: 社区数据后台异步填充，不阻塞首屏 ───────────────
      if (!paidFeatureAccessEnabled) {
        this.setData({ campCornerCards: [], campCornerStatus: 'idle' });
        return;
      }

      if (communityEnabled) {
        this.loadHomeExtras(currentPeriodId);
      } else {
        this.setData({ presenceText: '', campCornerCards: [], campCornerStatus: 'idle' });
      }

      Promise.all([
        this.loadRecentCheckins().catch(() => []),
        this.loadRecentInsights(currentPeriod).catch(() => []),
        this.loadInsightRequests(false).catch(() => ({
          receivedInsightRequests: [],
          sentInsightRequests: []
        })),
        this.loadZaichangImprints().catch(() => [])
      ]).then(([recentCheckins, recentInsights, insightRequestGroups, zaichangImprints]) => {
        const allInsightRequests = this.getInsightRequestListForDirection(
          insightRequestGroups,
          this.data.activeInsightRequestDirection
        );
        this.setData(
          {
            recentCheckins,
            welcomeBackText: this.buildWelcomeBack(recentCheckins),
            recentInsights,
            zaichangImprints,
            receivedInsightRequests:
              insightRequestGroups.receivedInsightRequests || [],
            sentInsightRequests: insightRequestGroups.sentInsightRequests || [],
            allInsightRequests,
            insightRequests: this.getInsightRequestPreview(allInsightRequests),
            insightRequestTotal: allInsightRequests.length,
            insightRequestEmptyText: this.getInsightRequestEmptyText(
              this.data.activeInsightRequestDirection
            )
          },
          () => {
            this.revealFocusedInsightRequest();
          }
        );
      });
    } catch (error) {
      console.error('加载用户数据失败:', error);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败,请重试', icon: 'none' });
    }
  },

  maybeShowMorningReadPrompt() {
    const { isLogin, todaySection, showMorningReadPrompt } = this.data;

    if (!isLogin || showMorningReadPrompt || !todaySection) {
      return;
    }

    if (todaySection.readingCompleted) {
      return;
    }

    const now = new Date();
    if (!isMorningReadPromptTime(now)) {
      return;
    }

    const todayKey = getLocalDateKey(now);
    let promptedDate = '';
    try {
      promptedDate = wx.getStorageSync(MORNING_READ_PROMPT_KEY);
    } catch (error) {
      console.warn('读取晨读提醒状态失败:', error);
    }
    if (promptedDate === todayKey) {
      return;
    }

    this.setData({ showMorningReadPrompt: true });
  },

  // 同行感与营地角落：锦上添花，各自失败各自不显示，不阻塞首屏
  loadHomeExtras(periodId) {
    if (!periodId) {
      this.setData({ presenceText: '', campCornerCards: [], campCornerStatus: 'idle' });
      return;
    }
    this.setData({ campCornerCards: [], campCornerStatus: 'loading' });
    const safe = (fn) => {
      try {
        return Promise.resolve(fn()).catch(() => null);
      } catch (error) {
        return Promise.resolve(null);
      }
    };
    safe(() => presenceService.getToday(periodId)).then((presence) => {
      if (this.data.currentPeriod && (this.data.currentPeriod._id || this.data.currentPeriod.id) !== periodId) return;
      this.setData({ presenceText: buildPresenceText(presence) });
    });
    Promise.all([
      safe(() => letterService.getPeriodLetter(periodId)),
      safe(() => practiceService.getCurrent(periodId)),
      safe(() => buddyService.getState(periodId))
    ]).then(([letter, practice, buddy]) => {
      if (this.data.currentPeriod && (this.data.currentPeriod._id || this.data.currentPeriod.id) !== periodId) return;
      const cards = buildCampCornerCards({ letter, practice, buddy });
      this.setData({
        campCornerCards: cards,
        campCornerStatus: letter || practice || buddy ? 'ready' : 'error'
      });
    });
  },

  retryCampCorner() {
    const periodId = this.data.currentPeriod?._id || this.data.currentPeriod?.id || '';
    if (periodId) this.loadHomeExtras(periodId);
  },

  handleCampCornerTap(e) {
    const kind = e.currentTarget.dataset.kind;
    const periodId = this.data.currentPeriod?._id || this.data.currentPeriod?.id || '';
    const pages = {
      letter: '/pages/slow-mail/slow-mail',
      practice: '/pages/practice/practice',
      buddy: '/pages/buddy/buddy'
    };
    if (!pages[kind] || !periodId) return;
    wx.navigateTo({ url: `${pages[kind]}?periodId=${periodId}` });
  },

  handleDailyCardTap() {
    const { todaySection, currentPeriod } = this.data;
    if (!todaySection) return;
    const enc = (v) => encodeURIComponent(v === undefined || v === null ? '' : String(v));
    const { source, day } = buildDailyCardSource(todaySection);
    const periodName = currentPeriod?.name || currentPeriod?.title || todaySection.periodTitle || '';
    wx.navigateTo({
      url:
        `/pages/daily-card/daily-card?quote=${enc(todaySection.extractText)}` +
        `&source=${enc(source)}&periodName=${enc(periodName)}&day=${enc(day)}`
    });
  },

  async loadCurrentPeriodReport(periodId, options = {}) {
    if (!periodId || !this.data.canUsePaidFeatures) {
      this.setData({ currentPeriodReport: null });
      return;
    }

    const requestKey = String(periodId);
    this._reportShortcutRequestKey = requestKey;

    try {
      const res = await completionReportService.getMyReports();
      if (this._reportShortcutRequestKey !== requestKey) {
        return;
      }

      const reports = Array.isArray(res?.list) ? res.list : [];
      const report = reports.find((item) => {
        const itemPeriodId = item.periodId?._id || item.periodId?.id || item.periodId;
        return String(itemPeriodId || '') === requestKey && item.hasReport === true;
      });

      const nextData = {
        currentPeriodReport: report || null
      };

      if (options.updateEmptyState && this.data.todayTaskEmptyState?.periodId === requestKey) {
        nextData.todayTaskEmptyState = buildTodayTaskEmptyState(
          this.data.currentPeriod,
          {
            periodEnded: this.data.todayTaskEmptyState.type === 'period-ended',
            hasReport: !!report
          }
        );
      }

      this.setData(nextData);
    } catch (error) {
      console.error('加载实录报告入口失败:', error);
      if (this._reportShortcutRequestKey === requestKey) {
        this.setData({ currentPeriodReport: null });
      }
    }
  },

  markMorningReadPromptHandled() {
    try {
      wx.setStorageSync(MORNING_READ_PROMPT_KEY, getLocalDateKey());
    } catch (error) {
      console.warn('保存晨读提醒状态失败:', error);
    }
  },

  handleMorningReadPromptCancel() {
    this.markMorningReadPromptHandled();
    this.setData({ showMorningReadPrompt: false });
  },

  handleMorningReadPromptGo() {
    this.markMorningReadPromptHandled();
    this.setData({ showMorningReadPrompt: false }, () => {
      this.handleJoinMeeting();
    });
  },

  async loadRecentCheckins() {
    try {
      const res = await checkinService.getUserCheckinsWithStats({
        page: 1,
        limit: 6
      });

      const list = Array.isArray(res?.list)
        ? res.list
        : Array.isArray(res)
          ? res
          : [];
      return list
        .filter((item) => {
          const text = richContentToPlainText(
            item.note || item.content || ''
          ).trim();
          const imageCount = Array.isArray(item.images) ? item.images.filter(Boolean).length : 0;
          return text.length > 0 || imageCount > 0;
        })
        .slice(0, 3)
        .map(buildRecentCheckinCard);
    } catch (error) {
      console.error('加载最近打卡失败:', error);
      return [];
    }
  },

  async loadZaichangImprints() {
    try {
      const res = await imprintService.list({ page: 1, pageSize: 3 });
      const list = res.list || [];
      return list.map(item => {
        const cover = (item.mediaList || [])[0];
        const d = item.happenedAt ? new Date(item.happenedAt) : null;
        const dateStr = d ? `${d.getMonth() + 1}月${d.getDate()}日` : '';
        return {
          _id: item._id,
          title: item.title || '',
          coverType: cover ? (cover.type || 'image') : '',
          coverUrl: cover ? cover.url : '',
          authorName: item.author ? (item.author.nickname || '') : '',
          dateStr
        };
      });
    } catch (e) {
      return [];
    }
  },

  /**
   * 加载最近的小凡看见记录
   * 改为加载所有小凡看见（不限期次），然后只取最新的2条
   * 这样可以保证即使当前期次判断有误，也能显示用户的最新小凡看见
   */
  async loadRecentInsights() {
    try {
      const insightService = require('../../services/insight.service');

      const res = await insightService.getInsightsList({ limit: 100 });

      // request.js 会自动提取 data.data，所以这里 res 应该是 { list: [...], pagination: {...} }
      let insights = [];
      if (res && res.list) {
        // 标准格式
        insights = res.list;
      } else if (Array.isArray(res)) {
        // 直接是数组
        insights = res;
      }

      if (!insights || insights.length === 0) {
        return [];
      }

      insights.sort(compareInsightsByPeriodAndDayDesc);

      // 格式化数据
      const { getInsightTypeConfig, getAvatarColorByUserId } = require('../../utils/formatters');
      const currentUser = getApp().globalData.userInfo || {};
      const currentUserId = currentUser._id || currentUser.id || '';
      const currentNickname = currentUser.nickname || currentUser.name || '用户';
      const currentAvatar = getUserAvatarDisplay(currentUser, {
        userId: currentUserId,
        displayName: currentNickname
      });
      const formatted = insights.map((item) => {
        // 提取preview：和insights.js保持一致逻辑
        let preview = richContentToPlainText(item.summary || '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!preview && item.content) {
          const plainText = richContentToPlainText(item.content)
            .replace(/\s+/g, ' ')
            .trim();
          // 直接取前150个字符
          preview = plainText.substring(0, 150);
          if (plainText.length > 150) {
            preview += '...';
          }
        }

        const typeConfig = getInsightTypeConfig(item.type);
        const courseDisplay = buildInsightCourseDisplay(item);

        return {
          id: item._id || item.id,
          day: item.day === null || item.day === undefined
            ? ''
            : formatShortLessonLabel(item.day),
          title: item.sectionId?.title || '学习反馈',
          unread: isInsightUnread(item, currentUserId),
          dateLabel: formatRecentCheckinDate(item.createdAt),
          courseTitle: courseDisplay.title,
          courseDayLabel: courseDisplay.dayLabel,
          periodName: getInsightPeriodName(item, this._periodNameById),
          preview: preview || (item.imageUrl ? '点击查看图片反馈' : '还没有内容'),
          mediaType: item.mediaType || 'text',
          imageUrl: item.imageUrl || null,
          periodId: item.periodId,
          type: item.type,
          typeConfig: typeConfig,
          targetUserAvatarUrl: currentAvatar.avatarUrl,
          targetUserAvatarText: currentAvatar.avatarText,
          targetUserAvatarColor: getAvatarColorByUserId(currentUserId)
        };
      });

      // 有没读的信就先把它放到信封上，其余顺序不变
      const unreadFirst = [...formatted.filter(item => item.unread), ...formatted.filter(item => !item.unread)];
      return unreadFirst.slice(0, 2);
    } catch (error) {
      console.error('加载小凡看见失败:', error);
      return [];
    }
  },

  handleInsightTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.insightActiveTab) return;
    this.setData({ insightActiveTab: tab });
    if (tab === 'others' && this.data.recentOtherInsights.length === 0 && !this.data.otherInsightsLoading) {
      this.loadRecentOtherInsights();
    }
  },

  async loadRecentOtherInsights() {
    this.setData({ otherInsightsLoading: true });
    try {
      const insightService = require('../../services/insight.service');
      const { getInsightTypeConfig, getAvatarColorByUserId } = require('../../utils/formatters');

      const sentRes = await insightService.getSentRequests({ status: 'approved', limit: 100 });
      const approvedRequests = sentRes.list || sentRes || [];

      const userMap = {};
      approvedRequests.forEach(req => {
        const userObj = req.toUserId;
        const uid = (typeof userObj === 'object' ? userObj?._id : userObj) || null;
        if (uid && !userMap[uid]) userMap[uid] = userObj;
      });

      const allInsights = [];
      await Promise.all(Object.entries(userMap).map(async ([userId, userInfo]) => {
        const res = await insightService.getUserInsightsList(userId, { limit: 100 });
        const list = (res.list || (Array.isArray(res) ? res : [])).filter(item => item.isAccessible !== false);
        const nickname = (typeof userInfo === 'object' ? userInfo?.nickname || userInfo?.name : '') || '用户';
        list.forEach(insight => {
          allInsights.push({ ...insight, _targetUserId: userId, _targetNickname: nickname, _targetAvatarUrl: (typeof userInfo === 'object' ? userInfo?.avatarUrl : '') || '' });
        });
      }));

      allInsights.sort(compareInsightsByPeriodAndDayDesc);

      const formatted = allInsights.slice(0, 2).map(item => {
        let preview = richContentToPlainText(item.summary || '').replace(/\s+/g, ' ').trim();
        if (!preview && item.content) {
          const plain = richContentToPlainText(item.content).replace(/\s+/g, ' ').trim();
          preview = plain.substring(0, 150) + (plain.length > 150 ? '...' : '');
        }
        const typeConfig = getInsightTypeConfig(item.type);
        const courseDisplay = buildInsightCourseDisplay(item);
        const nickname = item._targetNickname;
        const targetAvatar = getUserAvatarDisplay(
          { avatarUrl: item._targetAvatarUrl, nickname },
          { userId: item._targetUserId, displayName: nickname }
        );
        return {
          id: item._id || item.id,
          courseTitle: courseDisplay.title,
          courseDayLabel: courseDisplay.dayLabel,
          periodName: getInsightPeriodName(item, this._periodNameById),
          preview: preview || (item.imageUrl ? '点击查看图片反馈' : '还没有内容'),
          mediaType: item.mediaType || 'text',
          imageUrl: item.imageUrl || null,
          type: item.type,
          typeConfig: typeConfig,
          targetUserAvatarUrl: targetAvatar.avatarUrl,
          targetUserAvatarText: targetAvatar.avatarText,
          targetUserAvatarColor: getAvatarColorByUserId(item._targetUserId)
        };
      });

      this.setData({ recentOtherInsights: formatted });
    } catch (err) {
      console.error('加载他人洞见失败:', err);
    } finally {
      this.setData({ otherInsightsLoading: false });
    }
  },

  /**
   * 加载小凡看见请求
   */
  async loadInsightRequests(updatePage = true) {
    try {
      const insightService = require('../../services/insight.service');
      const app = getApp();
      const currentUser = app.globalData.userInfo;

      if (!currentUser || !currentUser._id) {
        console.warn('用户未登录，无法加载小凡看见请求');
        if (updatePage) {
          this.setData({
            receivedInsightRequests: [],
            sentInsightRequests: [],
            insightRequests: [],
            allInsightRequests: [],
            insightRequestTotal: 0,
            insightRequestEmptyText: this.getInsightRequestEmptyText(
              this.data.activeInsightRequestDirection
            )
          });
        }
        return { receivedInsightRequests: [], sentInsightRequests: [] };
      }

      const [receivedResponse, sentResponse] = await Promise.all([
        insightService.getReceivedRequests(),
        insightService.getSentRequests()
      ]);

      const requestGroups = {
        receivedInsightRequests: extractInsightRequests(receivedResponse).map(
          (item) => buildInsightRequestDisplay(item, { direction: 'received' })
        ),
        sentInsightRequests: extractInsightRequests(sentResponse).map((item) =>
          buildInsightRequestDisplay(item, { direction: 'sent' })
        )
      };
      const allInsightRequests = this.getInsightRequestListForDirection(
        requestGroups,
        this.data.activeInsightRequestDirection
      );

      if (updatePage) {
        this.setData(
          {
            receivedInsightRequests: requestGroups.receivedInsightRequests,
            sentInsightRequests: requestGroups.sentInsightRequests,
            allInsightRequests,
            insightRequests: this.getInsightRequestPreview(allInsightRequests),
            insightRequestTotal: allInsightRequests.length,
            insightRequestEmptyText: this.getInsightRequestEmptyText(
              this.data.activeInsightRequestDirection
            )
          },
          () => this.revealFocusedInsightRequest()
        );
      }

      return requestGroups;
    } catch (error) {
      console.error('加载小凡看见请求失败:', error);
      if (updatePage) {
        this.setData({
          receivedInsightRequests: [],
          sentInsightRequests: [],
          insightRequests: [],
          allInsightRequests: [],
          insightRequestTotal: 0,
          insightRequestEmptyText: this.getInsightRequestEmptyText(
            this.data.activeInsightRequestDirection
          )
        });
      }
      return { receivedInsightRequests: [], sentInsightRequests: [] };
    }
  },

  ensureCurrentPeriodCommunityAccess(title = '完成支付后可查看') {
    if (this.data.currentPeriodCommunityState === 'enabled') {
      return true;
    }

    wx.showToast({
      title,
      icon: 'none'
    });
    return false;
  },

  ensurePaidFeatureAccess(title = '完成支付后可查看') {
    if (this.data.canUsePaidFeatures) {
      return true;
    }

    wx.showToast({
      title,
      icon: 'none'
    });
    return false;
  },

  /**
   * 微信一键登录
   */
  async handleWechatLogin() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      console.log('开始获取用户信息...');

      // 1. 必须在点击事件中同步调用getUserProfile
      const userInfo = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善会员资料',
          success: (res) => {
            console.log('获取用户信息成功:', res.userInfo);
            resolve(res.userInfo);
          },
          fail: (err) => {
            console.error('获取用户信息失败:', err);
            reject(err);
          }
        });
      });

      console.log('用户信息获取完成，开始登录...');

      // 2. 使用Mock登录（因为没有后端服务器）
      const envConfig = require('../../config/env');
      let loginData;

      if (envConfig.useMock) {
        // Mock模式
        loginData = await authService.wechatLoginMock(userInfo);
      } else {
        // 生产模式
        loginData = await authService.wechatLogin(userInfo);
      }

      console.log('登录成功:', loginData);

      // 3. 更新全局状态
      const app = getApp();
      app.globalData.isLogin = true;
      const loginUserInfo = decorateUserAvatar(loginData.user);
      app.globalData.userInfo = loginUserInfo;
      app.globalData.token = loginData.access_token;

      // 4. 更新页面状态
      this.setData({
        isLogin: true,
        userInfo: loginUserInfo,
        loading: false
      });

      // 5. 显示tabBar
      this.updateTabBarVisibility(true);

      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 2000
      });

      // 6. 加载用户数据
      this.loadUserData();
    } catch (error) {
      console.error('登录失败:', error);

      this.setData({ loading: false });

      // 处理用户拒绝授权的情况
      if (
        error.errMsg &&
        error.errMsg.includes('getUserProfile:fail auth deny')
      ) {
        wx.showToast({
          title: '你拒绝了授权',
          icon: 'none',
          duration: 2000
        });
      } else {
        wx.showToast({
          title: '登录失败,请重试',
          icon: 'none',
          duration: 2000
        });
      }
    }
  },

  /**
   * 跳转到登录页（包含隐私协议）
   */
  goToLogin() {
    const navigate = () => {
      wx.navigateTo({
        url: '/pages/login/login'
      });
    };
    if (wx.nextTick) {
      wx.nextTick(navigate);
    } else {
      setTimeout(navigate, 0);
    }
  },

  /**
   * 返回首页
   */
  handleBackHome() {
    wx.switchTab({
      url: '/pages/periods/periods'
    });
  },

  /**
   * 点击头像
   */
  handleAvatarClick() {
    if (!this.data.isLogin) {
      this.handleLogin();
      return;
    }

    // 跳转到编辑资料页面
    wx.navigateTo({
      url: '/pages/edit-profile/edit-profile'
    });
  },

  /**
   * 授权请求 - 同意查看小凡看见
   */
  handleApproveRequest(e) {
    if (!this.ensurePaidFeatureAccess('完成支付后可处理申请')) {
      return;
    }
    const { request } = e.currentTarget.dataset;
    this.approveRequest(request);
  },

  /**
   * 拒绝请求
   */
  handleRejectRequest(e) {
    if (!this.ensurePaidFeatureAccess('完成支付后可处理申请')) {
      return;
    }
    const { request } = e.currentTarget.dataset;
    this.rejectRequest(request);
  },

  /**
   * 点击请求记录 - 跳转到他人主页
   */
  handleInsightRequestTap(e) {
    if (!this.ensurePaidFeatureAccess('完成支付后可查看请求')) {
      return;
    }
    const { request } = e.currentTarget.dataset;
    if (!request?.canNavigate) {
      return;
    }

    const userId = request?.displayUserId;
    const periodId = request?.periodId;

    if (!userId) {
      console.warn('请求记录缺少展示用户ID，无法跳转');
      return;
    }

    let url = `/pages/profile-others/profile-others?userId=${userId}`;
    if (periodId) {
      url += `&periodId=${periodId}`;
    }

    wx.navigateTo({ url });
  },

  handleRequestAvatarClick(e) {
    const { request, userId, periodId } = e.currentTarget.dataset;
    if (request && !request.canNavigate) {
      return;
    }

    this.navigateToOtherProfile(userId, periodId);
  },

  handleMiniAvatarClick(e) {
    const { userId } = e.currentTarget.dataset;
    const periodId = this.data.currentPeriod?._id || this.data.currentPeriod?.id;
    this.navigateToOtherProfile(userId, periodId);
  },

  navigateToOtherProfile(userId, periodId = '') {
    if (!userId) {
      return;
    }

    let url = `/pages/profile-others/profile-others?userId=${userId}`;
    if (periodId) {
      url += `&periodId=${periodId}`;
    }

    wx.navigateTo({ url });
  },

  /**
   * 批准请求
   */
  async approveRequest(request) {
    if (!this.ensurePaidFeatureAccess('完成支付后可处理申请')) {
      return;
    }
    try {
      console.log('📨 批准请求:', request);

      const insightService = require('../../services/insight.service');
      const requestId = request._id || request.id;

      // 调用后端API批准申请
      await insightService.approveRequest(requestId, {
        periodId: request.periodId || ''
      });
      activityService.track('insight_request_approve', {
        targetType: 'insight_request',
        targetId: requestId,
        periodId: request.periodId || null,
        metadata: {
          fromUserId: request.fromUserId || null
        }
      });

      console.log('✅ 申请已批准');
      this.updateInsightRequestStatus(requestId, 'approved');

      wx.showToast({
        title: '已批准申请',
        icon: 'success'
      });
    } catch (error) {
      console.error('❌ 批准申请失败:', error);
      wx.showToast({
        title: '没批准成，再试一次',
        icon: 'none'
      });
    }
  },

  /**
   * 拒绝请求
   */
  async rejectRequest(request) {
    if (!this.ensurePaidFeatureAccess('完成支付后可处理申请')) {
      return;
    }
    try {
      console.log('📨 拒绝请求:', request);

      const insightService = require('../../services/insight.service');
      const requestId = request._id || request.id;

      // 调用后端API拒绝申请
      await insightService.rejectRequest(requestId, {
        reason: '暂不同意'
      });

      console.log('✅ 申请已拒绝');
      this.updateInsightRequestStatus(requestId, 'rejected');

      wx.showToast({
        title: '已拒绝申请',
        icon: 'success'
      });
    } catch (error) {
      console.error('❌ 拒绝申请失败:', error);
      wx.showToast({
        title: '没拒绝成，再试一次',
        icon: 'none'
      });
    }
  },

  updateInsightRequestStatus(requestId, nextStatus) {
    const statusMap = {
      approved: { text: '已同意', className: 'approved' },
      rejected: { text: '已拒绝', className: 'rejected' }
    };
    const statusInfo = statusMap[nextStatus];
    if (!statusInfo) return;

    const updatedReceived = (this.data.receivedInsightRequests || []).map(
      (item) =>
        (item._id || item.id) === requestId
          ? {
            ...item,
            status: nextStatus,
            statusText: statusInfo.text,
            statusClass: statusInfo.className,
            canApprove: false,
            canReject: false
          }
          : item
    );
    const requestGroups = {
      receivedInsightRequests: updatedReceived,
      sentInsightRequests: this.data.sentInsightRequests || []
    };
    const updatedAll = this.getInsightRequestListForDirection(
      requestGroups,
      this.data.activeInsightRequestDirection
    );

    this.setData({
      receivedInsightRequests: updatedReceived,
      allInsightRequests: updatedAll,
      insightRequests: this.getInsightRequestPreview(updatedAll),
      insightRequestTotal: updatedAll.length
    });
  },

  navigateToInsightRequests() {
    if (!this.ensurePaidFeatureAccess('完成支付后可查看请求')) {
      return;
    }
    wx.navigateTo({
      url:
        '/pages/insight-requests/insight-requests?direction=' +
        (this.data.activeInsightRequestDirection || 'received')
    });
  },

  handleTodayPodcastBtnTap(e) {
    e.stopPropagation && e.stopPropagation();
    const { todaySection } = this.data;
    if (!todaySection) return;
    const id = todaySection.id || todaySection._id;
    activityService.track('index_podcast_enter', { targetId: id });
    subscribeAutoTopUp.maybeAutoTopUpSubscriptions({
      sourceAction: 'index_podcast_btn_tap',
      sourcePage: 'index',
      sceneKeys: ['podcast_published'],
      requestMode: 'any'
    });
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${id}&anchor=podcast`
    });
  },

  handleTodayReportBtnTap(e) {
    e.stopPropagation && e.stopPropagation();
    const periodId =
      this.data.currentPeriodReport?.periodId ||
      this.data.todaySection?.periodId ||
      this.data.currentPeriod?._id ||
      this.data.currentPeriod?.id;

    if (!periodId) {
      wx.showToast({ title: '没找到这一期，返回再进一次', icon: 'none' });
      return;
    }

    wx.navigateTo({
      url: `/pages/completion-report-detail/completion-report-detail?periodId=${periodId}`
    });
  },

  // 隔了几天回来时今日卡片上的那句话（已打卡、没有今日任务时为空）
  buildWelcomeBack(recentCheckins) {
    return buildWelcomeBackText({
      todaySection: this.data.todaySection,
      recentCheckins,
      totalCheckinDays: this.data.userStats ? this.data.userStats.totalCheckinDays : null,
      periodDayIndex: this.data.periodDayIndex
    });
  },

  handleTodayTaskEmptyAction(e) {
    e.stopPropagation && e.stopPropagation();
    const action = e.currentTarget.dataset.action;
    const periodId =
      this.data.todayTaskEmptyState?.periodId ||
      this.data.currentPeriod?._id ||
      this.data.currentPeriod?.id ||
      '';

    if (action === 'report') {
      this.handleTodayReportBtnTap(e);
      return;
    }

    if (action === 'courses') {
      if (!periodId) {
        wx.showToast({ title: '没找到这一期，返回再进一次', icon: 'none' });
        return;
      }
      wx.navigateTo({
        url: `/pages/courses/courses?periodId=${periodId}`
      });
      return;
    }

    if (action === 'keepsake') {
      if (!periodId) return;
      wx.navigateTo({
        url: `/pages/keepsake/keepsake?periodId=${periodId}`
      });
      return;
    }

    if (action === 'checkins') {
      this.navigateToCheckinRecords();
      return;
    }

    if (action === 'periods') {
      wx.switchTab({
        url: '/pages/periods/periods'
      });
    }
  },

  handleTodayPodcastPlay() {
    const { todaySection } = this.data;
    if (!todaySection || !todaySection.podcastUrl) return;

    const app = getApp();
    const sectionId = todaySection.id || todaySection._id;
    const isThisSection = app.globalData.podcastSectionId === sectionId;

    if (isThisSection && app.globalData.podcastPlaying) {
      app.globalData.audioContext && app.globalData.audioContext.pause();
      app.globalData.podcastPlaying = false;
      this.setPodcastUiData({ podcastPlaying: false });
      return;
    }

    subscribeAutoTopUp.maybeAutoTopUpSubscriptions({
      sourceAction: 'index_podcast_play',
      sourcePage: 'index',
      sceneKeys: ['podcast_published'],
      requestMode: 'any'
    });

    if (isThisSection && !app.globalData.podcastPlaying) {
      app.globalData.audioContext && app.globalData.audioContext.play();
      app.globalData.podcastPlaying = true;
      this.setPodcastUiData({ podcastPlaying: true });
      return;
    }

    if (app.globalData.audioContext) {
      stopPodcastAudio(app.globalData.audioContext);
    }

    const ctx = createPodcastAudioContext({
      title: todaySection.title || '凡人播客',
      coverUrl: todaySection.coverImage || ''
    });

    ctx.onPlay(() => {
      app.globalData.podcastPlaying = true;
      app.globalData.podcastActive = true;
      app.globalData.podcastSectionId = sectionId;
      app.globalData.podcastTitle = todaySection.title || '';
      app.globalData.podcastUrl = todaySection.podcastUrl;
      app.globalData.podcastCoverUrl = todaySection.coverImage || '/assets/images/fanren-boke.jpg';
      app.globalData.podcastDuration = todaySection.podcastDuration || 0;
      this.setPodcastUiData({ podcastPlaying: true, podcastSectionId: sectionId });
    });

    ctx.onPause(() => {
      app.globalData.podcastPlaying = false;
      this.setPodcastUiData({ podcastPlaying: false });
    });

    ctx.onStop(() => {
      app.globalData.podcastPlaying = false;
      this.setPodcastUiData({ podcastPlaying: false });
    });

    ctx.onEnded(() => {
      app.globalData.podcastPlaying = false;
      app.globalData.podcastCurrentTime = 0;
      this.setPodcastUiData({ podcastPlaying: false });
    });

    ctx.onTimeUpdate(() => {
      app.globalData.podcastCurrentTime = ctx.currentTime || 0;
      app.globalData.podcastDuration = ctx.duration || todaySection.podcastDuration || 0;
    });

    ctx.onError((err) => {
      console.error('播客播放失败:', err);
      wx.showToast({ title: '没播出来，再试一次', icon: 'none' });
      app.globalData.podcastPlaying = false;
      this.setPodcastUiData({ podcastPlaying: false });
    });

    app.globalData.audioContext = ctx;
    setPodcastAudioSource(ctx, todaySection.podcastUrl);
  },

  /**
   * 点击今日课节卡片
   */
  handleTodaySectionClick() {
    const { todaySection } = this.data;
    const sectionId = todaySection && (todaySection.id || todaySection._id);

    if (!sectionId) {
      console.error('今日课节信息不存在');
      wx.showToast({
        title: '课节信息不存在',
        icon: 'none'
      });
      return;
    }

    // 跳转到课程详情页
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${sectionId}`
    });
  },

  handleRecentCheckinTap(e) {
    if (!this.ensurePaidFeatureAccess('完成支付后可查看打卡日记')) {
      return;
    }

    const { checkinId, sectionId, periodId } = e.currentTarget.dataset || {};
    if (!checkinId) {
      wx.showToast({
        title: '打卡记录不存在',
        icon: 'none'
      });
      return;
    }

    return this.openCheckinDetail(checkinId, sectionId, periodId);
  },

  async loadUnreadNotificationCount() {
    if (!this.data.isLogin) {
      this.setData({ unreadNotificationCount: 0 });
      return;
    }

    try {
      const unreadResponse = await notificationService.getUnreadCount();
      this.setData({
        unreadNotificationCount: unreadResponse?.unreadCount || 0
      });
    } catch (error) {
      console.error('加载首页通知未读数失败:', error);
    }
  },

  navigateToNotifications() {
    wx.navigateTo({
      url: '/pages/notifications/notifications'
    });
  },

  async openCheckinDetail(checkinId, sectionId = '', periodId = '') {
    let targetSectionId = sectionId;
    let targetPeriodId = periodId;

    try {
      if (!targetSectionId) {
        wx.showLoading({
          title: '正在打开…',
          mask: true
        });

        const detail = await checkinService.getCheckinDetail(checkinId);
        targetSectionId = detail?.sectionId?._id || detail?.sectionId || '';
        targetPeriodId = detail?.periodId?._id || detail?.periodId || targetPeriodId;
      }

      if (!targetSectionId) {
        throw new Error('sectionId missing');
      }

      wx.navigateTo({
        url:
          `/pages/course-detail/course-detail?id=${targetSectionId}&checkinId=${checkinId}` +
          (targetPeriodId ? `&periodId=${targetPeriodId}` : '')
      });
    } catch (error) {
      console.error('打开打卡详情失败:', error);
      wx.showToast({
        title: '详情没打开，再点一次',
        icon: 'none'
      });
    } finally {
      wx.hideLoading?.();
    }
  },

  navigateToCheckinRecords() {
    if (!this.ensurePaidFeatureAccess('完成支付后可查看打卡日记')) {
      return;
    }

    wx.navigateTo({
      url: '/pages/checkin-records/checkin-records'
    });
  },

  navigateToNewCheckin() {
    if (!this.ensurePaidFeatureAccess('完成报名后可打卡')) return;
    const periodId = this.data.currentPeriod?._id || this.data.currentPeriod?.id || '';
    const sectionId = this.data.todaySection?._id || this.data.todaySection?.id || '';
    wx.navigateTo({
      url: `/pages/checkin/checkin?select=1&periodId=${encodeURIComponent(periodId)}&sectionId=${encodeURIComponent(sectionId)}`
    });
  },

  navigateToZaichang() {
    wx.navigateTo({ url: '/pages/zaichang/list/list' });
  },

  navigateToZaichangPublish() {
    if (!this.ensurePaidFeatureAccess('完成支付后可发布印记')) {
      return;
    }

    wx.navigateTo({ url: '/pages/zaichang/publish/publish' });
  },

  onTapZaichangCard(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/zaichang/detail/detail?id=${id}` });
  },

  /**
   * 点击小凡看见条目
   */
  handleInsightClick(e) {
    if (!this.ensurePaidFeatureAccess('完成支付后可查看反馈')) {
      return;
    }

    const { id } = e.currentTarget.dataset;

    if (!id) {
      console.error('❌ ID不存在');
      return;
    }

    // 点开就算读过了：首页的信封立刻换成已拆开的样子
    const recentInsights = (this.data.recentInsights || []).map(item =>
      item.id === id && item.unread ? { ...item, unread: false } : item
    );
    this.setData({ recentInsights });

    const url = `/pages/insight-detail/insight-detail?id=${id}`;

    wx.navigateTo({
      url: url,
      fail: (err) => console.error('❌ 跳转失败:', err)
    });
  },

  /**
   * 跳转到小凡看见列表
   */
  navigateToInsights() {
    if (!this.ensurePaidFeatureAccess('完成支付后可查看反馈')) {
      return;
    }

    wx.showToast({
      title: '正在跳转列表...',
      icon: 'none'
    });

    const tab = this.data.insightActiveTab || 'mine';
    const url = `/pages/insights/insights?tab=${tab}`;

    wx.navigateTo({
      url: url,
      fail: (err) => console.error('❌ 跳转失败:', err)
    });
  },

  /**
   * 去打卡 - 跳转到打卡页面（或显示已打卡提示）
   */
  handleCreateCheckin() {
    const { currentPeriod, todaySection, currentPeriodCommunityState } =
      this.data;

    if (!currentPeriod || !todaySection) {
      wx.showToast({
        title: '无法获取课程信息',
        icon: 'none'
      });
      return;
    }

    if (currentPeriodCommunityState !== 'enabled') {
      this.handleTodaySectionClick();
      return;
    }

    // 检查是否已经打卡
    if (todaySection.isCheckedIn) {
      wx.showToast({
        title: '今天已打卡，继续加油！',
        icon: 'success'
      });
      return;
    }

    const periodId = currentPeriod._id || currentPeriod.id;
    const sectionId = todaySection._id || todaySection.id;

    wx.navigateTo({
      url: `/pages/checkin/checkin?periodId=${periodId}&sectionId=${sectionId}`
    });
  },

  /**
   * 去晨读
   * 腾讯会议入口暂时屏蔽，统一进入当前课节的沉浸阅读页。
   */
  async handleJoinMeeting() {
    const { currentPeriod, todaySection } = this.data;
    const periodId =
      todaySection?.periodId || currentPeriod?._id || currentPeriod?.id || '';
    const sectionId = todaySection?._id || todaySection?.id || '';

    if (!sectionId) {
      wx.showToast({ title: '课节信息不存在', icon: 'none' });
      return;
    }

    await subscribeAutoTopUp
      .maybeAutoTopUpNextDayStudyReminder({
        periodId,
        sectionId,
        sourcePage: 'index',
        sourceAction: 'morning_read_click'
      })
      .catch((error) => {
        console.warn('补充明日开课通知失败，继续进入晨读:', error);
      });

    activityService.track('meeting_enter', {
      targetType: 'immersive_reading',
      targetId: sectionId,
      periodId: periodId || null,
      sectionId,
      metadata: {
        source: 'profile_today_task',
        tencentMeetingDisabled: true
      }
    });

    wx.navigateTo({
      url: buildReadingModeUrl(sectionId, periodId, todaySection)
    });
  },

  getCurrentPlatform() {
    const app = getApp();
    const platform =
      app?.globalData?.platform || wx.getDeviceInfo?.().platform || '';
    return String(platform).toLowerCase();
  },

  showInviteLinkGuide(meetingJoinUrl) {
    wx.showModal({
      title: '请在浏览器中打开腾讯会议',
      content: '复制链接后，请在浏览器中打开腾讯会议。',
      confirmText: '复制链接',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.copyMeetingValue(meetingJoinUrl, '邀请链接已复制');
        }
      }
    });
  },

  showMeetingLaunchOptions({ meetingId, meetingJoinUrl }) {
    const itemList = [];
    const actions = [];

    const pushAction = (label, action) => {
      itemList.push(label);
      actions.push(action);
    };

    if (meetingId) {
      pushAction('打开腾讯会议小程序', () =>
        this.openMeetingMiniProgram(meetingId)
      );
    }

    pushAction('复制邀请链接', () => {
      this.showInviteLinkGuide(meetingJoinUrl);
    });

    wx.showActionSheet({
      itemList,
      success: (res) => {
        const action = actions[res.tapIndex];
        if (action) {
          action();
        }
      },
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.includes('cancel')) {
          return;
        }

        if (meetingId) {
          this.openMeetingMiniProgram(meetingId);
          return;
        }

        this.promptManualMeetingJoin(meetingId);
      }
    });
  },

  copyMeetingValue(value, title) {
    if (!value) {
      wx.showToast({
        title: '没有可复制的内容',
        icon: 'none'
      });
      return;
    }

    wx.setClipboardData({
      data: value,
      success: () => {
        wx.showToast({
          title,
          icon: 'success'
        });
      }
    });
  },

  isDesktopPlatform() {
    const platform = this.getCurrentPlatform();
    return platform === 'windows' || platform === 'mac';
  },

  isDesktopLikePlatform() {
    const platform = this.getCurrentPlatform();
    return (
      platform === 'windows' || platform === 'mac' || platform === 'devtools'
    );
  },

  normalizeMeetingJoinUrl(url) {
    if (!url || typeof url !== 'string') {
      return '';
    }

    const trimmedUrl = url.trim();
    const allowedHostPattern =
      /^https:\/\/(meeting\.tencent\.com|wemeet\.qq\.com|voovmeeting\.com)\//i;
    return allowedHostPattern.test(trimmedUrl) ? trimmedUrl : '';
  },

  openMeetingWebView(meetingJoinUrl, meetingId = '') {
    wx.navigateTo({
      url:
        '/pages/meeting-webview/meeting-webview?url=' +
        encodeURIComponent(meetingJoinUrl) +
        '&meetingId=' +
        encodeURIComponent(meetingId || ''),
      fail: () => {
        this.promptManualMeetingJoin(
          meetingId,
          '当前环境无法打开腾讯会议邀请链接。'
        );
      }
    });
  },

  openMeetingMiniProgram() {
    wx.showToast({
      title: '腾讯会议入口已暂停',
      icon: 'none'
    });
  },

  promptManualMeetingJoin(meetingId, prefix = '') {
    const contentParts = [];
    if (prefix) {
      contentParts.push(prefix);
    }
    if (meetingId) {
      contentParts.push(`请手动打开腾讯会议APP，输入会议号：${meetingId}`);
    } else {
      contentParts.push('请手动打开腾讯会议APP或浏览器中的腾讯会议邀请链接。');
    }

    wx.showModal({
      title: '无法直接打开腾讯会议',
      content: contentParts.join('\n'),
      confirmText: meetingId ? '复制会议号' : '知道了',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm && meetingId) {
          wx.setClipboardData({ data: meetingId });
        }
      }
    });
  },

  /**
   * 格式化数字
   */
  formatNumber(num) {
    return formatNumber(num);
  },

  /**
   * 格式化加入时间
   */
  formatJoinDate(date) {
    if (!date) return '';
    return '加入于 ' + formatDate(date, 'YYYY-MM-DD');
  },

  loadPopupActivity() {
    communityActivityService.getPopup()
      .then(res => {
        const activity = res && (res.data || res);
        if (!activity || !activity._id) return;
        const key = 'activity_popup_shown';
        const stored = wx.getStorageSync(key) || {};
        const today = new Date().toISOString().slice(0, 10);
        if (stored.activityId === activity._id && stored.date === today) return;
        this.setData({ showActivityPopup: true, popupActivity: activity });
      })
      .catch(() => {});
  },

  loadUpcomingActivities() {
    communityActivityService.getList({
      limit: UPCOMING_ACTIVITIES_DISPLAY_LIMIT + 1,
      sort: 'desc'
    })
      .then(res => {
        const data = res && (res.data || res);
        const items = (data && (data.list || data.items || (Array.isArray(data) ? data : []))) || [];
        const hasMore = items.length > UPCOMING_ACTIVITIES_DISPLAY_LIMIT;
        const formatted = items.slice(0, UPCOMING_ACTIVITIES_DISPLAY_LIMIT).map(a => {
          let startTimeText = '';
          let startDateText = '';
          if (a.startTime) {
            const d = new Date(a.startTime);
            const mo = d.getMonth() + 1;
            const day = d.getDate();
            const h = String(d.getHours()).padStart(2, '0');
            const m = String(d.getMinutes()).padStart(2, '0');
            startTimeText = `${mo}月${day}日 ${h}:${m}`;
            startDateText = `${mo}月${day}日`;
          }
          return { ...a, startTimeText, startDateText };
        });
        this.setData({ upcomingActivities: formatted, upcomingActivitiesHasMore: hasMore });
      })
      .catch(() => {});
  },

  handleMoreActivities() {
    wx.navigateTo({ url: '/pages/activities/activities' });
  },

  handlePopupClose() {
    const activity = this.data.popupActivity;
    if (activity && activity._id) {
      const today = new Date().toISOString().slice(0, 10);
      wx.setStorageSync('activity_popup_shown', { activityId: activity._id, date: today });
    }
    this.setData({ showActivityPopup: false });
  },

  handlePopupViewDetail() {
    const activity = this.data.popupActivity;
    activityService.track('index_popup_view', { targetId: activity && activity._id });
    this.handlePopupClose();
    if (activity && activity._id) {
      wx.navigateTo({ url: `/pages/community-activity-detail/community-activity-detail?activityId=${activity._id}` });
    }
  },

  handleActivityCardTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/community-activity-detail/community-activity-detail?activityId=${id}` });
  },

  /**
   * 分享
   */
  onShareAppMessage() {
    const { currentPeriod } = this.data;
    const defaultShareImage = getDefaultShareImage();
    if (currentPeriod && currentPeriod._id) {
      const app = getApp();
      const userId = app.globalData.userInfo && (app.globalData.userInfo._id || app.globalData.userInfo.id);
      const inviterParam = userId ? `&inviterId=${userId}` : '';
      const title = currentPeriod.inviteTitle ||
        `${currentPeriod.name}·${currentPeriod.subtitle || '21天七个习惯晨读营'}，快来加入！`;
      return {
        title,
        path: `/pages/invite/invite?periodId=${currentPeriod._id}${inviterParam}`,
        imageUrl: currentPeriod.coverImage || defaultShareImage
      };
    }
    return {
      title: getDefaultShareTitle(),
      path: '/pages/index/index?from=share',
      imageUrl: defaultShareImage
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: getDefaultShareTitle(),
      query: '',
      imageUrl: getDefaultShareImage()
    };
  },

  /**
   * 打开编辑个人信息模态框
   */
  openEditProfile() {
    const { userInfo } = this.data;
    if (!userInfo) return;

    this.setData({
      showEditProfile: true,
      originalProfile: profileValues(userInfo),
      nicknameError: '',
      profileSaveHint: '',
      editForm: {
        avatar: userInfo.avatar || '🦁',
        avatarUrl: userInfo.avatarUrl || '',
        avatarText:
          userInfo.avatarText ||
          getLastTextChar(userInfo.nickname || userInfo.name || '', '用'),
        avatarColor:
          userInfo.avatarColor ||
          getUserAvatarDisplay(userInfo).avatarColor,
        nickname: userInfo.nickname || userInfo.name || '',
        signature: userInfo.signature || ''
      }
    });
  },

  /**
   * 关闭编辑个人信息模态框
   */
  closeEditProfile() {
    this.setData({
      showEditProfile: false
    });
  },

  /**
   * 防止事件冒泡
   */
  stopPropagation() {
    return false;
  },

  /**
   * 使用微信头像
   */
  async handleChooseWechatAvatar(e) {
    const avatarUrl = e.detail && e.detail.avatarUrl;
    if (!avatarUrl) {
      wx.showToast({
        title: '未获取到头像',
        icon: 'none'
      });
      return;
    }

    const normalizedAvatar = await this.compressAvatarImage(avatarUrl);
    this.setData({
      'editForm.avatarUrl': normalizedAvatar
    });
  },

  /**
   * 压缩头像，降低上传体积
   */
  compressAvatarImage(filePath) {
    if (!filePath || !wx.compressImage) {
      return Promise.resolve(filePath);
    }

    return new Promise((resolve) => {
      wx.compressImage({
        src: filePath,
        quality: 80,
        success: (res) => {
          resolve(res.tempFilePath || filePath);
        },
        fail: () => {
          resolve(filePath);
        }
      });
    });
  },

  isRemoteAvatarUrl(avatarUrl) {
    return /^https?:\/\//i.test(avatarUrl || '');
  },

  /**
   * 将微信临时头像路径上传为可长期访问的 URL
   */
  async prepareAvatarUrlForSave(avatarUrl) {
    if (!avatarUrl || this.isRemoteAvatarUrl(avatarUrl)) {
      return avatarUrl || '';
    }

    const uploadResult = await userService.uploadAvatar(avatarUrl);
    return uploadResult.avatarUrl || uploadResult.url || '';
  },

  /**
   * 昵称输入事件
   */
  onNicknameInput(e) {
    const { value } = e.detail;
    const avatarDisplay = getUserAvatarDisplay(this.data.editForm, {
      displayName: value || '用户',
      userId: this.data.userInfo?._id || this.data.userInfo?.id
    });
    this.setData({
      nicknameError: '',
      profileSaveHint: '',
      'editForm.nickname': value,
      'editForm.avatarText': avatarDisplay.avatarText,
      'editForm.avatarColor': avatarDisplay.avatarColor
    });
  },

  /**
   * 签名输入事件
   */
  onSignatureInput(e) {
    const { value } = e.detail;
    this.setData({
      'editForm.signature': value
    });
  },

  /**
   * 检查签名是否有效（不为空、不只有空白字符和换行）
   */
  isValidSignature(signature) {
    if (!signature) return false;
    // 移除所有空白字符和换行，如果还有内容则认为有效
    return signature.trim().length > 0;
  },

  /**
   * 更新签名有效性状态
   */
  updateSignatureValidation() {
    const { userInfo } = this.data;
    const hasValidSignature =
      userInfo && this.isValidSignature(userInfo.signature);
    this.setData({ hasValidSignature });
  },

  /**
   * 保存用户个人信息
   */
  async saveUserProfile() {
    const { editForm, userInfo } = this.data;
    if (this.data.isSavingProfile) return;

    if (!editForm.nickname.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }

    if (editForm.nickname.length > 20) {
      wx.showToast({
        title: '昵称不能超过20个字符',
        icon: 'none'
      });
      return;
    }

    if (editForm.signature && editForm.signature.length > 200) {
      wx.showToast({
        title: '签名不能超过200个字符',
        icon: 'none'
      });
      return;
    }

    if (isProfileUnchanged(editForm, this.data.originalProfile)) {
      this.setData({ showEditProfile: false, nicknameError: '', profileSaveHint: '' });
      wx.showToast({ title: '个人信息未修改，无需保存', icon: 'none' });
      return;
    }
    this.setData({ isSavingProfile: true, nicknameError: '', profileSaveHint: '' });

    try {
      const app = getApp();
      const savedAvatarUrl = await this.prepareAvatarUrlForSave(editForm.avatarUrl);

      // 调用更新用户信息API
      const response = await userService.updateUserProfile({
        avatar: editForm.avatar,
        avatarUrl: savedAvatarUrl,
        nickname: editForm.nickname.trim(),
        signature: editForm.signature || null
      });

      // 如果没有异常，说明request.js已经验证了响应成功
      // 此时response是解包后的用户数据对象
      if (response && response._id) {
        activityService.track('profile_update', {
          targetType: 'profile'
        });

        // 更新本地用户信息
        const updatedUserInfo = decorateUserAvatar({
          ...userInfo,
          avatar: editForm.avatar,
          avatarUrl:
            response.avatarUrl !== undefined ? response.avatarUrl : savedAvatarUrl,
          nickname: editForm.nickname.trim(),
          signature: editForm.signature || null
        });

        this.setData({
          userInfo: updatedUserInfo,
          hasValidSignature: !!this.isValidSignature(updatedUserInfo.signature)
        });

        // 更新全局应用数据
        app.globalData.userInfo = updatedUserInfo;

        // 保存到本地存储（使用 constants 中定义的 key 保持一致）
        const constants = require('../../config/constants');
        tenantStorage.set(constants.STORAGE_KEYS.USER_INFO, updatedUserInfo);

        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });

        // 关闭对话框
        this.setData({ showEditProfile: false });

        // 延迟 500ms 后刷新页面数据，确保签名等信息立即显示
        setTimeout(() => {
          this.loadUserData();
        }, 500);
      } else {
        wx.showToast({
          title: '没保存上，再试一次',
          icon: 'none'
        });
      }
    } catch (error) {
      const failure = profileError(error);
      if (failure.conflict) {
        this.setData({
          nicknameError: failure.message,
          profileSaveHint: `修改未保存，当前昵称仍为「${this.data.originalProfile.nickname}」`
        });
      } else {
        wx.showToast({ title: failure.message, icon: 'none' });
      }
    } finally {
      this.setData({ isSavingProfile: false });
    }
  }
});
