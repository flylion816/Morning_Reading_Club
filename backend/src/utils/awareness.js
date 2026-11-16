/**
 * 觉察日记：结构化字段的校验、content 拼接、回访到期时间。
 *
 * 觉察记录和随喜共用 JoyNote 集合：content 由这里拼成纯文本（便于搜索、复制、日签），
 * 结构化内容放在 awareness 子文档里。
 */
const { toDayKey } = require('./checkin-day-metrics');
const { sanitizeRichHtml, richTextHtmlToPlainText, hasRichFormatting, MAX_RICH_HTML_LENGTH } = require('./rich-text');

const DAY_MS = 24 * 60 * 60 * 1000;
const REVISIT_DAYS = 7;
const REVISIT_TIME = '06:00:00'; // 东八区早上 6 点
const MAX_CONTENT_LENGTH = 3000;
const MAX_TITLE_LENGTH = 40;
// 觉察里每个带格式的字段，HTML 比纯文本长（标签和样式），上限单独放宽
const MAX_FIELD_HTML = 12000;

const HABIT_KEYS = ['habit1', 'habit2', 'habit3', 'habit4', 'habit5', 'habit6', 'habit7', 'general'];

// 各字段上限合计 + 前缀小于 MAX_CONTENT_LENGTH，保证拼出来的 content 不会超长
const LIMITS = {
  facts: 600,
  feelingNote: 200,
  answer: 500,
  question: 80,
  choice: 300,
  followUp: 500,
  word: 8,
  feelings: 3,
  bodyAreas: 3,
  asks: 3,
  followUps: 30
};

const ACTIVE_REVISIT_STATUSES = ['pending', 'delivering', 'delivered'];

function textOf(value) {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : '';
}

function length(value) {
  return Array.from(value).length;
}

function fail(message) {
  return { ok: false, message };
}

// 标题：选填，最多 40 字，空白折叠成一个空格。provided 表示客户端有没有带这个字段
function cleanTitle(value) {
  if (value === undefined || value === null) return { ok: true, value: '', provided: false };
  if (typeof value !== 'string') return fail('标题格式不正确');
  const title = textOf(value).replace(/\s+/g, ' ');
  if (length(title) > MAX_TITLE_LENGTH) return fail(`标题最多 ${MAX_TITLE_LENGTH} 字`);
  return { ok: true, value: title, provided: true };
}

/**
 * 带格式的文字字段：有 HTML 时，HTML 经白名单清洗后推出纯文本（客户端传来的纯文本不被信任）；
 * 没有任何格式时只留纯文本，不存 HTML。清洗后的长度还要再查一次：
 * 转义和保留的样式属性会让输出比输入长，不能让合法长度的请求落到 schema 上限之外变成笼统的 400。
 */
function cleanRichField(html, text, label, maxHtml = MAX_FIELD_HTML) {
  let plain = textOf(text);
  let richHtml = '';
  if (html !== undefined && html !== null && html !== '') {
    const sanitized = sanitizeRichHtml(html, { maxLength: maxHtml });
    if (sanitized.error) return fail(`「${label}」${sanitized.error}`);
    if (sanitized.value) {
      if (sanitized.value.length > maxHtml) {
        return fail(`「${label}」富文本内容不能超过${maxHtml}字`);
      }
      plain = richTextHtmlToPlainText(sanitized.value);
      if (hasRichFormatting(sanitized.value)) richHtml = sanitized.value;
    } else {
      plain = '';
    }
  }
  return { ok: true, text: plain, html: richHtml };
}

function cleanWords(raw, max, label) {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return fail(`${label}格式不正确`);
  const seen = new Set();
  const words = [];
  for (const item of raw) {
    const word = textOf(item);
    if (!word) continue;
    if (length(word) > LIMITS.word) return fail(`${label}每个词最多 ${LIMITS.word} 个字`);
    if (seen.has(word)) continue;
    seen.add(word);
    words.push(word);
  }
  if (words.length > max) return fail(`${label}最多选 ${max} 个`);
  return { ok: true, value: words };
}

/**
 * 校验并整理客户端提交的觉察内容。
 * 返回 { ok: true, value } 或 { ok: false, message }。
 */
function sanitizeAwareness(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('觉察内容格式不正确');

  const factsRich = cleanRichField(input.factsHtml, input.facts, '看');
  if (!factsRich.ok) return factsRich;
  const facts = factsRich.text;
  if (length(facts) > LIMITS.facts) return fail(`「看」最多 ${LIMITS.facts} 字`);

  const feelingNote = textOf(input.feelingNote);
  if (length(feelingNote) > LIMITS.feelingNote) return fail(`「感」最多 ${LIMITS.feelingNote} 字`);

  const feelings = cleanWords(input.feelings, LIMITS.feelings, '情绪词');
  if (!feelings.ok) return feelings;
  const bodyAreas = cleanWords(input.bodyAreas, LIMITS.bodyAreas, '身体感觉');
  if (!bodyAreas.ok) return bodyAreas;

  let rawAsks = input.asks;
  if (rawAsks === undefined || rawAsks === null) rawAsks = [];
  if (!Array.isArray(rawAsks)) return fail('「问」格式不正确');
  if (rawAsks.length > LIMITS.asks) return fail(`「问」最多追问 ${LIMITS.asks} 层`);
  const asks = [];
  for (const item of rawAsks) {
    const answerRich = cleanRichField(item && item.answerHtml, item && item.answer, '问');
    if (!answerRich.ok) return answerRich;
    const answer = answerRich.text;
    if (!answer) continue;
    const question = textOf(item && item.question);
    if (!question) return fail('回答缺少对应的问题');
    if (length(question) > LIMITS.question) return fail('问题文字过长');
    if (length(answer) > LIMITS.answer) return fail(`每一问最多 ${LIMITS.answer} 字`);
    const ask = { level: asks.length + 1, question, answer };
    if (answerRich.html) ask.answerHtml = answerRich.html;
    asks.push(ask);
  }

  const choiceRich = cleanRichField(input.choiceHtml, input.choice, '择');
  if (!choiceRich.ok) return choiceRich;
  const choice = choiceRich.text;
  if (length(choice) > LIMITS.choice) return fail(`「择」最多 ${LIMITS.choice} 字`);

  const habitKey = HABIT_KEYS.includes(input.habitKey) ? input.habitKey : 'general';

  const value = {
    facts,
    feelings: feelings.value,
    bodyAreas: bodyAreas.value,
    feelingNote,
    asks,
    habitKey,
    choice
  };
  if (factsRich.html) value.factsHtml = factsRich.html;
  if (choiceRich.html) value.choiceHtml = choiceRich.html;
  if (!facts && !feelingNote && !value.feelings.length && !value.bodyAreas.length && !asks.length && !choice) {
    return fail('至少写一句再保存');
  }
  return { ok: true, value };
}

// 把结构化内容拼成一段纯文本，用于搜索、复制和日签
function composeContent(awareness) {
  const lines = [];
  if (awareness.facts) lines.push(`看：${awareness.facts}`);
  const feeling = [awareness.feelings.join('、'), awareness.feelingNote].filter(Boolean).join('。');
  if (feeling) lines.push(`感：${feeling}`);
  if (awareness.bodyAreas.length) lines.push(`身：${awareness.bodyAreas.join('、')}`);
  awareness.asks.forEach(ask => lines.push(`问：${ask.answer}`));
  if (awareness.choice) lines.push(`择：${awareness.choice}`);
  return lines.join('\n');
}

// 创建当天起第 N 天的东八区早上 6 点
function computeRevisitDueAt(createdAt = new Date(), days = REVISIT_DAYS) {
  const key = toDayKey(createdAt);
  if (!key) return null;
  return new Date(Date.parse(`${key}T${REVISIT_TIME}+08:00`) + days * DAY_MS);
}

function cleanFollowUp(value) {
  const content = textOf(value);
  if (!content) return fail('请写一句再保存');
  if (length(content) > LIMITS.followUp) return fail(`最多 ${LIMITS.followUp} 字`);
  return { ok: true, value: content };
}

module.exports = {
  HABIT_KEYS,
  LIMITS,
  MAX_CONTENT_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_FIELD_HTML,
  MAX_RICH_HTML_LENGTH,
  REVISIT_DAYS,
  ACTIVE_REVISIT_STATUSES,
  sanitizeAwareness,
  cleanTitle,
  cleanRichField,
  composeContent,
  computeRevisitDueAt,
  cleanFollowUp
};
