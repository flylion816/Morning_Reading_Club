const { parseDateKey, getSolarTerm, getLatestSolarTerm } = require('./solar-terms');

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const QUOTE_MAX = 60;
const NOTE_MAX = 40;
// 小程序分享路径总长有限制，超出时先砍感想、再砍金句，保证落地页一定能打开
const PATH_BUDGET = 900;

// 小程序码 scene 里的来源短码 → 线索来源
const SCENE_SOURCE_MAP = { d: 'daily_card', q: 'quote_card', k: 'keepsake', v: 'invite' };
const SOURCE_TYPES = ['daily_card', 'quote_card', 'keepsake', 'invite', 'other'];

const REASON_OPTIONS = ['想找人一起读', '想养成早起习惯', '想读《七个习惯》', '朋友推荐'];

// 授权文案，版本号要和后端 CONSENT_VERSION 一致
const CONSENT_VERSION = 'newcomer-consent-v1';
const CONSENT_TEXT =
  '我们是一群早起读书的普通人，会有一位接待书友来加你微信，聊聊你想读什么。' +
  '你的手机号只用于这一次联系，不用于营销，不对其他书友展示，可以随时要求删除。';

function safeDecode(value) {
  if (value === undefined || value === null) return '';
  try {
    return decodeURIComponent(String(value));
  } catch (error) {
    return String(value);
  }
}

function clamp(text, max) {
  return Array.from(String(text || '').trim()).slice(0, max).join('');
}

function isObjectId(value) {
  return /^[0-9a-f]{24}$/i.test(String(value || ''));
}

// scene 形如 `i=<分享人id>&s=d`，微信会把它整体编码后放进 options.scene
function parseScene(scene) {
  const result = {};
  safeDecode(scene)
    .split('&')
    .forEach(pair => {
      const index = pair.indexOf('=');
      if (index > 0) result[pair.slice(0, index)] = pair.slice(index + 1);
    });
  return result;
}

function parseLandingOptions(options = {}) {
  const fromScene = options.scene ? parseScene(options.scene) : {};
  const inviterId = safeDecode(options.inviterId) || fromScene.i || '';
  const sourceType =
    SOURCE_TYPES.includes(options.src) ? options.src : SCENE_SOURCE_MAP[fromScene.s] || 'other';
  const dateParam = safeDecode(options.date);
  const dayNumber = Number(safeDecode(options.day));

  return {
    inviterId: isObjectId(inviterId) ? inviterId : '',
    sourceType,
    dateStr: /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : '',
    quote: clamp(safeDecode(options.quote), QUOTE_MAX),
    lessonName: clamp(safeDecode(options.source), 30),
    dayNumber: Number.isFinite(dayNumber) && dayNumber > 0 ? Math.floor(dayNumber) : 0,
    note: clamp(safeDecode(options.note), NOTE_MAX)
  };
}

// 朋友圈分享用：只要问号后面的参数（朋友圈分享的是当前页，不需要路径）
function buildLandingQuery(params = {}) {
  return buildLandingPath(params).split('?')[1] || '';
}

function buildLandingPath(params = {}) {
  const base = '/pages/landing/landing';
  const parts = [];
  const add = (key, value) => {
    if (value === undefined || value === null || value === '') return;
    parts.push(`${key}=${encodeURIComponent(String(value))}`);
  };

  add('inviterId', isObjectId(params.inviterId) ? params.inviterId : '');
  add('src', SOURCE_TYPES.includes(params.sourceType) ? params.sourceType : 'daily_card');
  add('date', params.dateStr);
  add('source', clamp(params.lessonName, 30));
  add('day', params.dayNumber);

  let quote = clamp(params.quote, QUOTE_MAX);
  let note = clamp(params.note, NOTE_MAX);
  const assemble = () => {
    const extra = [];
    if (quote) extra.push(`quote=${encodeURIComponent(quote)}`);
    if (note) extra.push(`note=${encodeURIComponent(note)}`);
    return `${base}?${parts.concat(extra).join('&')}`;
  };

  let path = assemble();
  while (path.length > PATH_BUDGET && note) {
    note = Array.from(note).slice(0, -2).join('');
    path = assemble();
  }
  while (path.length > PATH_BUDGET && quote) {
    quote = Array.from(quote).slice(0, -4).join('');
    path = assemble();
  }
  return path;
}

function todayKey(now = Date.now()) {
  const d = new Date(now + 8 * 3600000);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

function describeDate(dateStr) {
  const parsed = parseDateKey(dateStr) || parseDateKey(todayKey());
  const key = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  let termText = getSolarTerm(key);
  if (!termText) {
    const latest = getLatestSolarTerm(key);
    if (latest) termText = `${latest.name}第 ${latest.daysSince + 1} 天`;
  }
  return {
    key,
    dayNumber: String(parsed.d),
    dateLine: `${parsed.y} 年 ${parsed.m} 月 · 周${WEEKDAYS[new Date(parsed.utc).getUTCDay()]}`,
    termText
  };
}

function formatContactBy(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const shanghai = new Date(date.getTime() + 8 * 3600000);
  return `${shanghai.getUTCMonth() + 1} 月 ${shanghai.getUTCDate()} 日`;
}

function isValidPhone(phone) {
  return /^1\d{10}$/.test(String(phone || '').trim());
}

const STATUS_TEXT = {
  pending: '待联系',
  contacted: '已联系',
  talked: '已交流',
  connected: '已连接',
  declined: '暂不连接'
};

module.exports = {
  buildLandingQuery,
  REASON_OPTIONS,
  CONSENT_VERSION,
  CONSENT_TEXT,
  STATUS_TEXT,
  parseLandingOptions,
  buildLandingPath,
  describeDate,
  todayKey,
  formatContactBy,
  isValidPhone
};
