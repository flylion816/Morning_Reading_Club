const { parseDateKey, getSolarTerm, getLatestSolarTerm } = require('./solar-terms');

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const QUOTE_MAX = 120;
const NOTE_MAX = 40;
// 微信分享参数使用紧凑编码，优先保留与日签一致的完整正文。
const PATH_BUDGET = 900;
const SHARE_TEXT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const CARD_VARIANTS = ['dawn', 'paper', 'blank'];
const SHARE_CODE_PATTERN = /^[a-z0-9]{8}$/i;

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
  const raw = String(value);
  try {
    const decoded = decodeURIComponent(raw);
    // 微信桌面端可能把已编码的中文再次编码；普通百分号文字不重复解码。
    if (/%25/i.test(raw) && /%(?:c[2-9a-f]|d[0-9a-f]|e[0-9a-f]|f[0-4])%[89ab][0-9a-f]/i.test(decoded)) {
      try { return decodeURIComponent(decoded); } catch (error) { return decoded; }
    }
    return decoded;
  } catch (error) {
    return raw;
  }
}

// 使用 URL 安全的 UTF-8 编码，120 字的日签无需被中文百分号编码撑爆分享路径。
function encodeShareText(value) {
  const safe = Array.from(String(value || '')).map(char => {
    const code = char.codePointAt(0);
    return code >= 0xd800 && code <= 0xdfff ? '�' : char;
  }).join('');
  const encoded = encodeURIComponent(safe);
  const bytes = [];
  for (let i = 0; i < encoded.length; i += 1) {
    if (encoded[i] === '%') {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(encoded.charCodeAt(i));
    }
  }
  let bits = 0;
  let buffer = 0;
  let output = '';
  bytes.forEach(byte => {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      output += SHARE_TEXT_ALPHABET[(buffer >>> bits) & 63];
    }
    buffer &= (1 << bits) - 1;
  });
  if (bits) output += SHARE_TEXT_ALPHABET[(buffer << (6 - bits)) & 63];
  return output;
}

function decodeShareText(value) {
  const input = String(value || '');
  if (!/^[A-Za-z0-9_-]*$/.test(input) || input.length % 4 === 1) return '';
  let bits = 0;
  let buffer = 0;
  const bytes = [];
  for (const char of input) {
    buffer = (buffer << 6) | SHARE_TEXT_ALPHABET.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 255);
      buffer &= (1 << bits) - 1;
    }
  }
  try {
    return decodeURIComponent(bytes.map(byte => `%${byte.toString(16).padStart(2, '0')}`).join(''));
  } catch (error) {
    return '';
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
  const shareCode = safeDecode(options.c || fromScene.c);
  const variant = safeDecode(options.variant);
  const compactQuote = options.q ? decodeShareText(safeDecode(options.q)) : '';

  return {
    inviterId: isObjectId(inviterId) ? inviterId : '',
    sourceType,
    dateStr: /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : '',
    quote: clamp(compactQuote || safeDecode(options.quote), QUOTE_MAX),
    lessonName: clamp(safeDecode(options.source), 40),
    periodName: clamp(safeDecode(options.period !== undefined ? options.period : options.periodName), 30),
    dayNumber: Number.isFinite(dayNumber) && dayNumber > 0 ? Math.floor(dayNumber) : 0,
    note: clamp(safeDecode(options.note), NOTE_MAX),
    variant: CARD_VARIANTS.includes(variant) ? variant : 'dawn',
    shareCode: SHARE_CODE_PATTERN.test(shareCode) ? shareCode.toLowerCase() : ''
  };
}

// 接口返回的快照已经是明文，不应再对正文做 URI 解码。
function parseLandingSnapshot(value = {}, shareCode = '') {
  const dayNumber = Number(value.dayNumber);
  const dateStr = typeof value.dateStr === 'string' ? value.dateStr : '';
  return {
    inviterId: isObjectId(value.inviterId) ? value.inviterId : '',
    sourceType: SOURCE_TYPES.includes(value.sourceType) ? value.sourceType : 'daily_card',
    dateStr: /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : '',
    quote: clamp(value.quote, QUOTE_MAX),
    lessonName: clamp(value.lessonName, 40),
    periodName: clamp(value.periodName, 30),
    dayNumber: Number.isFinite(dayNumber) && dayNumber > 0 ? Math.floor(dayNumber) : 0,
    note: clamp(value.note, NOTE_MAX),
    variant: CARD_VARIANTS.includes(value.variant) ? value.variant : 'dawn',
    shareCode: SHARE_CODE_PATTERN.test(shareCode) ? shareCode.toLowerCase() : ''
  };
}

// 朋友圈分享用：只要问号后面的参数（朋友圈分享的是当前页，不需要路径）
function buildLandingQuery(params = {}) {
  return buildLandingPath(params).split('?')[1] || '';
}

function buildLandingPath(params = {}) {
  const base = '/pages/landing/landing';
  const quote = clamp(params.quote, QUOTE_MAX);
  let note = clamp(params.note, NOTE_MAX);
  let lesson = clamp(params.lessonName, 40);
  let period = clamp(params.periodName, 30);
  const day = Number(params.dayNumber);

  const assemble = () => {
    const parts = [];
    const add = (key, value) => {
      if (value === undefined || value === null || value === '') return;
      parts.push(`${key}=${encodeURIComponent(String(value))}`);
    };
    add('inviterId', isObjectId(params.inviterId) ? params.inviterId : '');
    add('src', SOURCE_TYPES.includes(params.sourceType) ? params.sourceType : 'daily_card');
    add('date', /^\d{4}-\d{2}-\d{2}$/.test(params.dateStr || '') ? params.dateStr : '');
    add('source', lesson);
    add('period', period);
    add('day', Number.isFinite(day) && day > 0 ? Math.min(Math.floor(day), 9999) : '');
    add('variant', CARD_VARIANTS.includes(params.variant) ? params.variant : '');
    add('q', quote ? encodeShareText(quote) : '');
    add('note', note);
    return `${base}?${parts.join('&')}`;
  };

  let path = assemble();
  // 路径空间不足时先收短附加字段，完整金句不再被截掉。
  while (path.length > PATH_BUDGET && note) {
    note = Array.from(note).slice(0, -1).join('');
    path = assemble();
  }
  while (path.length > PATH_BUDGET && lesson) {
    lesson = Array.from(lesson).slice(0, -1).join('');
    path = assemble();
  }
  while (path.length > PATH_BUDGET && period) {
    period = Array.from(period).slice(0, -1).join('');
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
  parseLandingSnapshot,
  buildLandingPath,
  describeDate,
  todayKey,
  formatContactBy,
  isValidPhone
};
