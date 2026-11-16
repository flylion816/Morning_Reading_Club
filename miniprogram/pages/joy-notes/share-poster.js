/**
 * 随喜 / 觉察分享长图：把一条记录排成一张暖纸色的长图，底部带指向这一页的小程序码。
 * 标题、颜色、粗体、下划线、标题、列表都保留（不走 rich-text，在 canvas 上逐行排版）。
 *
 * 分三层，方便单独测试：
 *   payloadFromNote  服务端的记录 → 海报需要的数据
 *   buildPosterModel 数据 → 分好段的海报内容
 *   renderPoster     在 canvas 上测量、排版、绘制，返回导出尺寸
 */
const richNote = require('../../utils/rich-note');
const text = require('./awareness-text');
const { getBrandName, getBrandSlogan } = require('../../utils/brand');

const POSTER_WIDTH = 900;
const MAX_HEIGHT = 7200;
// canvas 2d 的像素总量有上限，太高的长图自动降低清晰度而不是画不出来
const MAX_PIXELS = 16000000;
const SERIF = '"Songti SC", "STSong", "Noto Serif SC", serif';
const SANS = 'sans-serif';

const COLORS = {
  ink: '#2b2622',
  soft: '#6b5d4d',
  muted: '#9a8d7b',
  dawn: '#ee9b45',
  dawnDeep: '#b8631f',
  dawnInk: '#8a4b12',
  dawnSoft: '#fdf0dc',
  paper: '#fffdf8',
  chip: '#efe9dd',
  rule: 'rgba(92, 70, 44, 0.16)'
};

// ---------------- 数据 ----------------

function payloadFromNote(note = {}, { authorName = '', sourceLabel = '' } = {}) {
  const awareness = note.kind === 'awareness' && note.awareness ? note.awareness : null;
  return {
    id: String(note.id || note._id || ''),
    kind: awareness ? 'awareness' : 'joy',
    title: String(note.title || ''),
    authorName: authorName || '书友',
    dateLabel: text.dateWithDaypart(note.createdAt || new Date()),
    sourceLabel,
    periodLinked: Boolean(note.periodId),
    content: String(note.content || ''),
    contentHtml: String(note.contentHtml || ''),
    awareness: awareness
      ? {
          facts: awareness.facts || '',
          factsHtml: awareness.factsHtml || '',
          feelings: Array.from(awareness.feelings || []),
          bodyAreas: Array.from(awareness.bodyAreas || []),
          feelingNote: awareness.feelingNote || '',
          asks: Array.from(awareness.asks || []).map(ask => ({
            label: text.LEVEL_LABELS[(ask.level || 1) - 1] || '问',
            question: ask.question || '',
            answer: ask.answer || '',
            answerHtml: ask.answerHtml || ''
          })),
          choice: awareness.choice || '',
          choiceHtml: awareness.choiceHtml || '',
          followUps: Array.from(awareness.followUps || []).map(item => ({
            content: item.content || '',
            dateLabel: text.monthDay(item.createdAt)
          }))
        }
      : null
  };
}

function plainBlocks(value) {
  return String(value || '')
    .split('\n')
    .map(line => ({
      kind: 'p',
      runs: [{ text: line || '\n', bold: false, italic: false, underline: false, strike: false, color: '' }]
    }));
}

function blocksOf(html, plain) {
  const parsed = html ? richNote.parseRuns(html) : [];
  return parsed.length ? parsed : plainBlocks(plain);
}

function buildPosterModel(payload) {
  const isAwareness = payload.kind === 'awareness' && payload.awareness;
  const sections = [];
  if (isAwareness) {
    const a = payload.awareness;
    if (a.facts) sections.push({ type: 'body', label: '看', blocks: blocksOf(a.factsHtml, a.facts) });
    if (a.feelings.length || a.feelingNote || a.bodyAreas.length) {
      sections.push({ type: 'feel', label: '感', chips: a.feelings, note: a.feelingNote, body: a.bodyAreas });
    }
    a.asks.forEach(ask => {
      sections.push({ type: 'ask', label: `问 · ${ask.label}`, question: ask.question, blocks: blocksOf(ask.answerHtml, ask.answer) });
    });
    if (a.choice) sections.push({ type: 'choose', label: '择', blocks: blocksOf(a.choiceHtml, a.choice) });
    a.followUps.forEach(item => {
      sections.push({ type: 'later', label: `后来 · ${item.dateLabel}`.trim(), blocks: plainBlocks(item.content) });
    });
  } else {
    sections.push({ type: 'joy', label: '', blocks: blocksOf(payload.contentHtml, payload.content) });
  }
  return {
    kind: isAwareness ? 'awareness' : 'joy',
    seal: isAwareness ? '觉' : '喜',
    kicker: isAwareness ? '觉察日记' : '随喜记',
    authorLine: `${payload.authorName || '书友'} ${isAwareness ? '分享了一页觉察' : '分享了一句随喜'}`,
    title: payload.title || '',
    meta: [payload.dateLabel, payload.sourceLabel].filter(Boolean).join(' · '),
    sections
  };
}

// ---------------- 排版 ----------------

function createMeasurer(ctx) {
  const cache = new Map();
  return (font, ch) => {
    const key = `${font}|${ch}`;
    let width = cache.get(key);
    if (width === undefined) {
      ctx.font = font;
      width = ctx.measureText(ch).width;
      cache.set(key, width);
    }
    return width;
  };
}

function fontOf({ size, bold, italic, family }) {
  return `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${Math.round(size * 10) / 10}px ${family}`;
}

/**
 * 把「带样式的文字片段」排成行。每一行是若干同样式的片段。
 * options: { width, fontSize, lineHeight, family, color, boldAll }
 */
function layoutBlocks(measure, blocks, options) {
  const { width, fontSize, lineHeight, family = SERIF, color = COLORS.ink, boldAll = false } = options;
  const lines = [];

  blocks.forEach(block => {
    const scale = block.kind === 'h' ? (block.level <= 1 ? 1.35 : block.level === 2 ? 1.2 : 1.1) : 1;
    const size = fontSize * scale;
    const height = lineHeight * scale;
    const indent = block.kind === 'li' ? fontSize * 1.5 : block.kind === 'quote' ? fontSize * 0.9 : 0;
    const maxWidth = width - indent;
    const bullet = block.kind === 'li' ? (block.ordered ? `${block.index}.` : '•') : '';
    let current = null;
    let firstLine = true;
    const open = () => {
      current = { segments: [], width: 0, size, height, indent, quote: block.kind === 'quote', bullet: firstLine ? bullet : '', after: 0 };
      firstLine = false;
    };
    const push = () => {
      if (current) lines.push(current);
      current = null;
    };

    block.runs.forEach(run => {
      if (run.text === '\n') {
        if (!current) open();
        push();
        return;
      }
      const style = {
        size,
        bold: run.bold || block.kind === 'h' || boldAll,
        italic: run.italic,
        family,
        underline: run.underline,
        strike: run.strike,
        color: run.color || color
      };
      const font = fontOf(style);
      Array.from(run.text).forEach(ch => {
        const w = measure(font, ch);
        if (!current) open();
        if (current.width + w > maxWidth && current.segments.length) {
          push();
          open();
        }
        const last = current.segments[current.segments.length - 1];
        if (last && last.font === font && last.color === style.color && last.underline === style.underline && last.strike === style.strike) {
          last.text += ch;
          last.width += w;
        } else {
          current.segments.push({ text: ch, width: w, font, color: style.color, underline: style.underline, strike: style.strike });
        }
        current.width += w;
      });
    });
    push();
    if (lines.length) lines[lines.length - 1].after = height * 0.32;
  });
  return lines;
}

function linesHeight(lines) {
  return lines.reduce((sum, line) => sum + line.height + line.after, 0);
}

// 把「文字」按宽度排成若干行（不带样式，用于标题、说明）
function wrapPlain(measure, value, { width, size, bold = false, family = SERIF, maxLines = 99 }) {
  const font = fontOf({ size, bold, italic: false, family });
  const rows = [];
  let current = '';
  let currentWidth = 0;
  Array.from(String(value || '')).forEach(ch => {
    if (ch === '\n') {
      rows.push(current);
      current = '';
      currentWidth = 0;
      return;
    }
    const w = measure(font, ch);
    if (currentWidth + w > width && current) {
      rows.push(current);
      current = '';
      currentWidth = 0;
    }
    current += ch;
    currentWidth += w;
  });
  if (current) rows.push(current);
  if (rows.length > maxLines) {
    const kept = rows.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, -1)}…`;
    return kept;
  }
  return rows;
}

// ---------------- 绘制小工具 ----------------

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function fillRound(ctx, x, y, w, h, r, fill) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawLines(ctx, lines, x, top) {
  let y = top;
  lines.forEach(line => {
    const baseline = y + line.height / 2 + line.size * 0.34;
    const left = x + line.indent;
    if (line.quote) {
      ctx.fillStyle = '#e6d6bd';
      ctx.fillRect(x, y + line.height * 0.1, 5, line.height * 0.8);
    }
    if (line.bullet) {
      ctx.font = fontOf({ size: line.size, bold: false, italic: false, family: SERIF });
      ctx.fillStyle = COLORS.soft;
      ctx.textAlign = 'right';
      ctx.fillText(line.bullet, left - line.size * 0.35, baseline);
      ctx.textAlign = 'left';
    }
    let cursor = left;
    line.segments.forEach(segment => {
      ctx.font = segment.font;
      ctx.fillStyle = segment.color;
      ctx.fillText(segment.text, cursor, baseline);
      const thickness = Math.max(2, line.size / 16);
      if (segment.underline) {
        ctx.fillRect(cursor, baseline + line.size * 0.14, segment.width, thickness);
      }
      if (segment.strike) {
        ctx.fillRect(cursor, baseline - line.size * 0.3, segment.width, thickness);
      }
      cursor += segment.width;
    });
    y += line.height + line.after;
  });
  return y;
}

// ---------------- 海报 ----------------

/**
 * 在 canvas 上画出整张海报。
 * options: { canvas, model, qrImage, qrPrecise, dpr }
 * 返回 { width, height, scale, truncated }，调用方用它导出图片。
 */
function renderPoster({ canvas, model, qrImage = null, qrPrecise = false, dpr = 2 }) {
  const ctx = canvas.getContext('2d');
  const W = POSTER_WIDTH;
  const pageX = 56;
  const contentW = W - pageX * 2;
  const measure = createMeasurer(ctx);
  const isAwareness = model.kind === 'awareness';
  // 觉察左边有一条「夜到晨」的竖线，正文整体往右缩进一点
  const bodyX = isAwareness ? pageX + 38 : pageX;
  const bodyW = W - pageX - bodyX;

  // ---- 测量 ----
  const headerH = 188;
  const titleRows = model.title
    ? wrapPlain(measure, model.title, { width: contentW, size: 46, bold: true, maxLines: 3 })
    : [];
  const titleH = titleRows.length ? titleRows.length * 64 + 8 : 0;
  const metaH = model.meta ? 54 : 0;
  const topBlockH = headerH + titleH + metaH + 24;
  const footerH = 300;

  const items = [];
  let bodyH = 0;
  let truncated = false;
  const budget = MAX_HEIGHT - topBlockH - footerH - 40;

  const place = (item) => {
    if (truncated) return;
    if (bodyH + item.height > budget) {
      // 放不下的段落：保留能放下的前几行，其余用省略提示
      if (item.lines && item.lines.length > 1) {
        const kept = [];
        let h = item.labelH || 0;
        for (const line of item.lines) {
          if (bodyH + h + line.height + line.after > budget - 70) break;
          kept.push(line);
          h += line.height + line.after;
        }
        if (kept.length) items.push({ ...item, lines: kept, height: h + (item.padH || 0) });
        bodyH += h + (item.padH || 0);
      }
      items.push({ type: 'more', height: 70 });
      bodyH += 70;
      truncated = true;
      return;
    }
    items.push(item);
    bodyH += item.height;
  };

  model.sections.forEach(section => {
    if (truncated) return;
    if (section.type === 'joy') {
      const lines = layoutBlocks(measure, section.blocks, { width: bodyW, fontSize: 36, lineHeight: 36 * 1.85 });
      place({ type: 'lines', lines, height: linesHeight(lines) + 20 });
      return;
    }
    const labelH = 50;
    if (section.type === 'feel') {
      const chipFont = fontOf({ size: 27, bold: false, italic: false, family: SANS });
      let x = 0;
      let rows = 1;
      const chipPlan = section.chips.map(label => {
        const textW = Array.from(label).reduce((sum, ch) => sum + measure(chipFont, ch), 0) + 44;
        const width = Math.max(textW, 88);
        if (x + width > bodyW && x > 0) {
          x = 0;
          rows += 1;
        }
        const plan = { label, x, row: rows - 1, width };
        x += width + 14;
        return plan;
      });
      const noteLines = section.note
        ? layoutBlocks(measure, plainBlocks(section.note), { width: bodyW, fontSize: 31, lineHeight: 31 * 1.8 })
        : [];
      const bodyLine = section.body.length ? `身体：${section.body.join('、')}` : '';
      const chipsH = section.chips.length ? rows * 56 + 6 : 0;
      const height = labelH + chipsH + linesHeight(noteLines) + (bodyLine ? 48 : 0) + 22;
      place({ type: 'feel', label: section.label, chipPlan, chipFont, noteLines, bodyLine, chipsH, height, labelH });
      return;
    }
    const lines = layoutBlocks(measure, section.blocks, {
      width: section.type === 'choose' ? bodyW - 80 : bodyW,
      fontSize: 32,
      lineHeight: 32 * 1.8,
      boldAll: section.type === 'choose',
      color: section.type === 'choose' ? COLORS.dawnInk : COLORS.ink
    });
    const questionRows = section.type === 'ask' && section.question
      ? wrapPlain(measure, section.question, { width: bodyW, size: 25, family: SANS, maxLines: 3 })
      : [];
    const questionH = questionRows.length ? questionRows.length * 38 + 8 : 0;
    const padH = section.type === 'choose' ? 56 : 0;
    place({
      type: section.type,
      label: section.label,
      lines,
      questionRows,
      questionH,
      labelH,
      padH,
      height: labelH + questionH + linesHeight(lines) + padH + 22
    });
  });

  const H = Math.max(900, Math.ceil(topBlockH + bodyH + footerH + 30));

  // ---- 画布尺寸：太高的长图降低清晰度 ----
  const scale = Math.max(1, Math.min(dpr, Math.sqrt(MAX_PIXELS / (W * H))));
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = 'left';

  // ---- 背景 ----
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#fbe3c3');
  bg.addColorStop(0.07, '#fdf0dc');
  bg.addColorStop(0.2, COLORS.paper);
  bg.addColorStop(1, COLORS.paper);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 觉察长图的头部沿用分享封面的夜色语言，正文仍从暖纸开始，保证长文阅读舒适。
  if (isAwareness) {
    fillRound(ctx, pageX - 18, 34, contentW + 36, 132, 26, '#231c17');
    const headerLine = ctx.createLinearGradient(pageX + 100, 0, W - pageX, 0);
    headerLine.addColorStop(0, COLORS.dawn);
    headerLine.addColorStop(1, 'rgba(240, 168, 90, 0)');
    ctx.fillStyle = headerLine;
    ctx.fillRect(pageX + 100, 158, contentW - 100, 3);
  }

  // ---- 头部：印章 + 栏目名 + 谁分享的 ----
  const sealY = 58;
  fillRound(ctx, pageX, sealY, 76, 76, 18, COLORS.dawnSoft);
  roundRectPath(ctx, pageX, sealY, 76, 76, 18);
  ctx.strokeStyle = COLORS.dawnDeep;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.font = fontOf({ size: 44, bold: true, italic: false, family: SERIF });
  ctx.fillStyle = COLORS.dawnDeep;
  ctx.textAlign = 'center';
  ctx.fillText(model.seal, pageX + 38, sealY + 54);
  ctx.textAlign = 'left';
  ctx.font = fontOf({ size: 34, bold: true, italic: false, family: SERIF });
  ctx.fillStyle = isAwareness ? COLORS.dawn : COLORS.dawnInk;
  ctx.fillText(model.kicker, pageX + 100, sealY + 36);
  ctx.font = fontOf({ size: 26, bold: false, italic: false, family: SANS });
  ctx.fillStyle = isAwareness ? '#d7c4aa' : COLORS.soft;
  ctx.fillText(model.authorLine, pageX + 100, sealY + 72);

  let y = headerH;
  // ---- 标题和日期 ----
  if (titleRows.length) {
    ctx.font = fontOf({ size: 46, bold: true, italic: false, family: SERIF });
    ctx.fillStyle = COLORS.ink;
    titleRows.forEach(row => {
      ctx.fillText(row, pageX, y + 46);
      y += 64;
    });
    y += 8;
  }
  if (model.meta) {
    ctx.font = fontOf({ size: 25, bold: false, italic: false, family: SANS });
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(model.meta, pageX, y + 30);
    y += 54;
  }
  y += 24;

  // ---- 觉察的竖线 ----
  const bodyTop = y;
  if (isAwareness && bodyH > 0) {
    const lineGradient = ctx.createLinearGradient(0, bodyTop, 0, bodyTop + bodyH);
    lineGradient.addColorStop(0, '#1c1815');
    lineGradient.addColorStop(0.5, '#6a4322');
    lineGradient.addColorStop(0.85, COLORS.dawn);
    lineGradient.addColorStop(1, '#f7d6a6');
    fillRound(ctx, pageX, bodyTop + 6, 10, Math.max(bodyH - 24, 20), 5, lineGradient);
  }

  // ---- 各段 ----
  items.forEach(item => {
    if (item.type === 'more') {
      ctx.font = fontOf({ size: 26, bold: false, italic: false, family: SANS });
      ctx.fillStyle = COLORS.muted;
      ctx.fillText('… 内容较长，完整的请扫码查看', bodyX, y + 40);
      y += item.height;
      return;
    }
    if (item.type === 'lines') {
      y = drawLines(ctx, item.lines, bodyX, y + 6) + 14;
      return;
    }
    // 带标签的段落：小圆点 + 标签
    const labelColor = item.type === 'later' ? COLORS.dawnDeep : COLORS.muted;
    ctx.beginPath();
    ctx.arc(pageX + 5, y + 22, 8, 0, Math.PI * 2);
    ctx.fillStyle = item.type === 'choose' || item.type === 'later' ? COLORS.dawn : COLORS.paper;
    ctx.fill();
    ctx.strokeStyle = item.type === 'choose' || item.type === 'later' ? COLORS.dawn : '#6a4322';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = fontOf({ size: 24, bold: item.type === 'later', italic: false, family: SANS });
    ctx.fillStyle = labelColor;
    ctx.fillText(item.label, bodyX, y + 30);
    y += item.labelH;

    if (item.type === 'feel') {
      item.chipPlan.forEach(chip => {
        const cy = y + chip.row * 56;
        fillRound(ctx, bodyX + chip.x, cy, chip.width, 46, 23, COLORS.chip);
        ctx.font = item.chipFont;
        ctx.fillStyle = COLORS.soft;
        ctx.textAlign = 'center';
        ctx.fillText(chip.label, bodyX + chip.x + chip.width / 2, cy + 32);
        ctx.textAlign = 'left';
      });
      y += item.chipsH;
      y = drawLines(ctx, item.noteLines, bodyX, y);
      if (item.bodyLine) {
        ctx.font = fontOf({ size: 26, bold: false, italic: false, family: SANS });
        ctx.fillStyle = COLORS.soft;
        ctx.fillText(item.bodyLine, bodyX, y + 34);
        y += 48;
      }
      y += 22;
      return;
    }
    if (item.type === 'ask' && item.questionRows.length) {
      ctx.font = fontOf({ size: 25, bold: false, italic: false, family: SANS });
      ctx.fillStyle = COLORS.soft;
      item.questionRows.forEach(row => {
        ctx.fillText(row, bodyX, y + 30);
        y += 38;
      });
      y += 8;
    }
    if (item.type === 'choose') {
      const boxH = linesHeight(item.lines) + 56;
      fillRound(ctx, bodyX, y, bodyW, boxH, 24, COLORS.dawnSoft);
      ctx.beginPath();
      ctx.arc(bodyX + 34, y + 38, 9, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.dawn;
      ctx.fill();
      drawLines(ctx, item.lines, bodyX + 64, y + 28);
      y += boxH + 22;
      return;
    }
    y = drawLines(ctx, item.lines, bodyX, y) + 22;
  });

  // ---- 页脚：品牌 + 小程序码 ----
  const footerTop = H - footerH;
  ctx.strokeStyle = COLORS.rule;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pageX, footerTop);
  ctx.lineTo(W - pageX, footerTop);
  ctx.stroke();

  ctx.font = fontOf({ size: 38, bold: true, italic: false, family: SERIF });
  ctx.fillStyle = COLORS.ink;
  ctx.fillText(getBrandName(), pageX, footerTop + 90);
  ctx.font = fontOf({ size: 26, bold: false, italic: false, family: SANS });
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(getBrandSlogan(), pageX, footerTop + 134);
  ctx.font = fontOf({ size: 23, bold: false, italic: false, family: SANS });
  ctx.fillText('登录的书友扫码，可以直接读到这一页', pageX, footerTop + 178);

  if (qrImage) {
    const size = 168;
    const qx = W - pageX - size;
    const qy = footerTop + 36;
    fillRound(ctx, qx - 14, qy - 14, size + 28, size + 28, 24, '#ffffff');
    ctx.drawImage(qrImage, qx, qy, size, size);
    ctx.font = fontOf({ size: 23, bold: false, italic: false, family: SANS });
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = 'center';
    ctx.fillText(qrPrecise ? '扫码，读 TA 的这一页' : '扫码共读', qx + size / 2, qy + size + 50);
    ctx.textAlign = 'left';
  }

  return { width: W, height: H, scale, truncated };
}

module.exports = {
  POSTER_WIDTH,
  MAX_HEIGHT,
  MAX_PIXELS,
  COLORS,
  payloadFromNote,
  buildPosterModel,
  createMeasurer,
  layoutBlocks,
  wrapPlain,
  linesHeight,
  renderPoster
};
