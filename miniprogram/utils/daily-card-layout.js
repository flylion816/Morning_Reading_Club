/**
 * 晨读日签排版：纯函数。预览（WXML）与画布（canvas）共用同一份结果。
 * 坐标单位为设计稿像素，画布宽度固定 750（与 rpx 一致）。
 */
const { parseDateKey, getSolarTerm, getLatestSolarTerm } = require('./solar-terms');

const CARD_WIDTH = 750;
const VARIANTS = ['dawn', 'paper', 'blank'];
const QUOTE_MAX_LENGTH = 120;
const NOTE_MAX_LENGTH = 40;
const QUOTE_MAX_LINES = 6;
const PLACEHOLDER_TEXT = '写下今天想留下的一句话';
const SLOGAN = '每天清晨，一起读一页书';
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const FONTS = {
  serif: "'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Source Han Serif SC', serif",
  num: "Georgia, 'Times New Roman', serif",
  sans: 'sans-serif'
};

const COLORS = {
  paper: '#fffdf8',
  text: '#2b2622',
  soft: '#62584d',
  muted: '#776c5f',
  rule: 'rgba(92, 70, 44, 0.14)',
  border: 'rgba(92, 70, 44, 0.32)',
  dawn: '#ee9b45',
  dawnDeep: '#b8631f',
  dawnInk: '#8a4b12',
  glow: 'rgba(255, 196, 120, 0.55)',
  seal: '#b4452c'
};

const NO_LINE_START = '，。、；：！？）》」』”’,.;:!?)]}…';

function estimateTextWidth(text, fontSize) {
  let units = 0;
  Array.from(String(text || '')).forEach(ch => {
    units += ch.charCodeAt(0) < 128 ? 0.56 : 1;
  });
  return units * fontSize;
}

/** 折行：按段落（换行符）与宽度折行，超出 maxLines 截断并加省略号 */
function wrapText(text, fontSize, maxWidth, maxLines, measure) {
  const measureFn = measure || estimateTextWidth;
  const lines = [];
  String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .forEach(paragraph => {
      const chars = Array.from(paragraph.trim());
      if (!chars.length) return;
      let line = '';
      chars.forEach(ch => {
        if (line && measureFn(line + ch, fontSize) > maxWidth && !NO_LINE_START.includes(ch)) {
          lines.push(line);
          line = ch;
        } else {
          line += ch;
        }
      });
      if (line) lines.push(line);
    });
  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  let last = clipped[maxLines - 1];
  while (last && measureFn(`${last}…`, fontSize) > maxWidth) {
    last = last.slice(0, -1);
  }
  clipped[maxLines - 1] = `${last.replace(/[，。、；：,.;:]$/, '')}…`;
  return clipped;
}

function getTodayKey(now = Date.now()) {
  const d = new Date(now + 8 * 3600000);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

function describeDate(dateStr) {
  const parsed = parseDateKey(dateStr) || parseDateKey(getTodayKey());
  const key = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
  const weekday = WEEKDAYS[new Date(parsed.utc).getUTCDay()];
  let termText = getSolarTerm(key);
  if (!termText) {
    const latest = getLatestSolarTerm(key);
    if (latest) termText = `${latest.name}第 ${latest.daysSince + 1} 天`;
  }
  return {
    key,
    dayNumber: String(parsed.d),
    dateLine: `${parsed.y} 年 ${parsed.m} 月 · 周${weekday}`,
    termText
  };
}

function clamp(text, max) {
  return Array.from(String(text || '').trim()).slice(0, max).join('');
}

function buildPeriodLine(periodName, day) {
  const name = String(periodName || '').trim();
  const n = Number(day);
  const dayText = Number.isFinite(n) && n > 0 ? `第 ${Math.floor(n)} 天` : '';
  return [name, dayText].filter(Boolean).join(' · ');
}

function text(o) {
  return { type: 'text', align: 'left', weight: 'normal', family: 'serif', ...o };
}

/**
 * @param {object} opts variant, quote, source, periodName, day, note, dateStr, brandName,
 *   primaryColor, placeholder(无今日一句时是否显示输入引导，仅预览使用), measure(可选)
 */
function computeDailyCardLayout(opts = {}) {
  const variant = VARIANTS.includes(opts.variant) ? opts.variant : 'dawn';
  const measure = opts.measure;
  const date = describeDate(opts.dateStr);
  const quote = clamp(opts.quote, QUOTE_MAX_LENGTH);
  const source = clamp(opts.source, 40);
  const note = clamp(opts.note, NOTE_MAX_LENGTH);
  const periodLine = buildPeriodLine(clamp(opts.periodName, 30), opts.day);
  const brandName = String(opts.brandName || '晨读营');
  const primary = opts.primaryColor || '#4a90e2';
  const W = CARD_WIDTH;
  const els = [];

  const cfg = {
    dawn: { x: 64, minH: 1000, quoteSize: 40, quoteLH: 66, showPeriod: true, showSource: true },
    paper: { x: 76, minH: 1000, quoteSize: 40, quoteLH: 66, showPeriod: true, showSource: true },
    blank: { x: 96, minH: 1100, quoteSize: 38, quoteLH: 70, showPeriod: false, showSource: false }
  }[variant];
  const x = cfg.x;
  const contentW = W - x * 2;
  let background = COLORS.paper;
  let y;

  // 背景与日期块
  if (variant === 'dawn') {
    els.push({
      type: 'gradient', x: 0, y: 0, w: W, h: 520,
      stops: [[0, '#f7d9b0'], [0.55, '#fbe3c3'], [1, '#fdf0dc']]
    });
    els.push({ type: 'circle', cx: 560, cy: 520, r: 190, fill: COLORS.glow });
    els.push({ type: 'circle', cx: 560, cy: 520, r: 120, fill: COLORS.dawn });
    els.push({ type: 'rect', x: 0, y: 520, w: W, h: 2000, fill: COLORS.paper });
    els.push(text({ x, y: 84, w: 300, h: 170, text: date.dayNumber, size: 150, family: 'num', color: COLORS.dawnInk }));
    els.push(text({ x, y: 262, w: 520, h: 40, text: date.dateLine, size: 28, color: COLORS.dawnInk }));
    if (date.termText) {
      els.push(text({ x, y: 308, w: 520, h: 36, text: date.termText, size: 26, color: COLORS.dawnDeep }));
    }
    y = 580;
  } else if (variant === 'paper') {
    background = '#faf5ea';
    els.push({ type: 'rect', x: 0, y: 0, w: W, h: 3000, fill: background });
    els.push({ type: 'frame', x: 28, y: 28, w: W - 56, h: 0, stroke: COLORS.border, lineWidth: 2 });
    els.push({ type: 'rect', x: x, y: 76, w: 64, h: 64, fill: COLORS.seal, radius: 8 });
    els.push(text({ x, y: 76, w: 64, h: 64, text: '晨', size: 38, color: '#fffdf8', align: 'center', weight: 'bold' }));
    els.push(text({ x, y: 176, w: 300, h: 170, text: date.dayNumber, size: 150, family: 'num', color: COLORS.text }));
    els.push(text({ x, y: 354, w: 520, h: 40, text: date.dateLine, size: 28, color: COLORS.soft }));
    if (date.termText) {
      els.push(text({ x, y: 400, w: 520, h: 36, text: date.termText, size: 26, color: COLORS.dawnDeep }));
    }
    y = date.termText ? 490 : 450;
  } else {
    els.push({ type: 'rect', x: 0, y: 0, w: W, h: 3000, fill: background });
    els.push({ type: 'rect', x, y: 120, w: 48, h: 4, fill: primary });
    els.push(text({ x, y: 150, w: 460, h: 250, text: date.dayNumber, size: 220, family: 'num', color: COLORS.text }));
    els.push(text({ x, y: 408, w: 520, h: 38, text: date.dateLine, size: 26, color: COLORS.muted }));
    if (date.termText) {
      els.push(text({ x, y: 452, w: 520, h: 36, text: date.termText, size: 26, color: COLORS.dawnDeep }));
    }
    y = date.termText ? 570 : 530;
  }

  // 正文
  if (cfg.showPeriod && periodLine) {
    const lines = wrapText(periodLine, 26, contentW, 1, measure);
    els.push(text({ x, y, w: contentW, h: 36, text: lines[0], size: 26, color: COLORS.dawnInk }));
    y += 36 + 28;
  }

  const quoteLines = wrapText(quote, cfg.quoteSize, contentW, QUOTE_MAX_LINES, measure);
  let placeholderShown = false;
  if (quoteLines.length) {
    quoteLines.forEach(line => {
      els.push(text({ x, y, w: contentW, h: cfg.quoteLH, text: line, size: cfg.quoteSize, color: COLORS.text }));
      y += cfg.quoteLH;
    });
    y += 20;
  } else if (opts.placeholder) {
    placeholderShown = true;
    els.push(text({
      x, y, w: contentW, h: cfg.quoteLH, text: PLACEHOLDER_TEXT, size: 34, color: COLORS.muted, placeholder: true
    }));
    y += cfg.quoteLH + 20;
  }

  if (cfg.showSource && source) {
    const lines = wrapText(`—— ${source}`, 24, contentW, 1, measure);
    els.push(text({ x, y, w: contentW, h: 36, text: lines[0], size: 24, color: COLORS.muted, family: 'sans' }));
    y += 36 + 24;
  }

  if (note) {
    const lines = wrapText(`—— 我想说：${note}`, 28, contentW, 3, measure);
    lines.forEach(line => {
      els.push(text({ x, y, w: contentW, h: 44, text: line, size: 28, color: COLORS.soft }));
      y += 44;
    });
    y += 12;
  }

  // 底部品牌
  const footerH = 140;
  const footerY = Math.max(y + 56, cfg.minH - footerH);
  const height = footerY + footerH;
  if (variant !== 'blank') {
    els.push({ type: 'rect', x, y: footerY, w: contentW, h: 2, fill: COLORS.rule });
  }
  els.push({ type: 'circle', cx: x + 7, cy: footerY + 42, r: 7, fill: primary });
  els.push(text({
    x: x + 26, y: footerY + 20, w: contentW - 26, h: 44, text: brandName, size: 30, weight: 'bold', color: COLORS.text
  }));
  els.push(text({
    x, y: footerY + 70, w: contentW, h: 34, text: SLOGAN, size: 24, color: COLORS.muted, family: 'sans'
  }));

  // 纸墨版式细边框的高度依赖总高
  els.forEach(el => {
    if (el.type === 'frame') el.h = height - 56;
  });
  // 铺底矩形裁到总高
  els.forEach(el => {
    if (el.type === 'rect' && el.h >= 2000) el.h = height - el.y;
  });

  return {
    width: W,
    height,
    variant,
    background,
    date,
    quoteLines,
    placeholderShown,
    elements: els.map((el, i) => ({ id: i, ...el }))
  };
}

module.exports = {
  CARD_WIDTH,
  VARIANTS,
  QUOTE_MAX_LENGTH,
  NOTE_MAX_LENGTH,
  PLACEHOLDER_TEXT,
  FONTS,
  COLORS,
  estimateTextWidth,
  wrapText,
  getTodayKey,
  describeDate,
  computeDailyCardLayout
};
