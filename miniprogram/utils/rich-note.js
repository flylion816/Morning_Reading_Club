/**
 * 随喜 / 觉察的富文本小工具（微信 editor 导出的 HTML）。
 * 纯文本换算与服务端 utils/rich-text.js 的 richTextHtmlToPlainText 保持同一算法，
 * 这样本地字数、列表摘录和服务端保存的 content 不会对不上。
 */

const DEFAULT_COLOR = '#2b2622';

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&');
}

// 与服务端 richTextHtmlToPlainText 一致
function htmlToPlainText(html = '') {
  return decodeEntities(
    String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 纯文本 → editor 能接受的 HTML：一行一个段落，空行是空段落
function plainTextToHtml(text = '') {
  const value = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!value.trim()) return '';
  return value
    .split('\n')
    .map(line => (line ? `<p>${escapeHtml(line)}</p>` : '<p><br></p>'))
    .join('');
}

// 有没有真正的格式（颜色、加粗、列表…）。只有普通段落时返回 false
function hasFormatting(html = '') {
  const value = String(html || '');
  return /<\s*(strong|b|em|i|u|s|h[1-6]|ul|ol|li|blockquote|a)\b/i.test(value) || /<[^>]+\sstyle\s*=/i.test(value);
}

// editor 给的颜色可能是 #fff / rgb(1, 2, 3) / 大写，统一成小写 #rrggbb
function normalizeColor(value) {
  if (!value) return '';
  const color = String(value).trim().toLowerCase();
  const short = color.match(/^#([0-9a-f]{3})$/);
  if (short) return `#${short[1].split('').map(char => char + char).join('')}`;
  const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map(part => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, '0'))
      .join('')}`;
  }
  return color;
}

function colorFromStyle(style = '') {
  const match = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(String(style || ''));
  return match ? normalizeColor(match[1]) : '';
}

/**
 * 保存前的整理：editor 导出的 HTML 为空（<p><br></p>）而纯文本不为空时，用纯文本补出 HTML；
 * 纯文本为空则一律视为没有内容。
 */
function normalizeHtml(html = '', plainText = '') {
  const value = String(html || '').trim();
  if (!plainText || !String(plainText).trim()) return '';
  if (!value || value === '<p><br></p>') return plainTextToHtml(plainText);
  return value;
}

// 给 <p> / 列表 / 标题补上紧凑的间距。已有 style 时合并，不覆盖
function withStyle(tagSource, extra) {
  if (/\sstyle\s*=\s*"/i.test(tagSource)) {
    return tagSource.replace(/\sstyle\s*=\s*"([^"]*)"/i, (match, existing) => ` style="${extra};${existing}"`);
  }
  return tagSource.replace(/>$/, ` style="${extra}">`);
}

/**
 * 供 <rich-text nodes> 展示：清掉 class / id / data-*（editor 会带 ql-* 之类），
 * 给段落、列表、标题补上紧凑的间距，整体包一层字号、行高和颜色。
 * 默认全部继承 <rich-text> 外层的样式（页面用 wxss 给 rich-text 设字号、行高、颜色），
 * 这样 rpx 单位也不会出问题；需要时可以显式传入。
 */
function toDisplayHtml(html = '', options = {}) {
  const { fontSize = 'inherit', lineHeight = 'inherit', color = 'inherit', family = 'inherit' } = options;
  const body = String(html || '').trim();
  if (!body) return '';
  const cleaned = body
    .replace(/\s(?:class|id|data-[\w-]+)\s*=\s*"[^"]*"/gi, '')
    .replace(/<p(\s[^>]*)?>/gi, match => withStyle(match, 'margin:0 0 .45em'))
    .replace(/<(ul|ol)(\s[^>]*)?>/gi, match => withStyle(match, 'margin:0 0 .45em;padding-left:1.4em'))
    .replace(/<(h[1-6])(\s[^>]*)?>/gi, match => withStyle(match, 'margin:.2em 0 .45em'))
    .replace(/<blockquote(\s[^>]*)?>/gi, match => withStyle(match, 'margin:0 0 .45em;padding-left:.8em;border-left:3px solid #e6d6bd'));
  const wrapper = `font-size:${fontSize};line-height:${lineHeight};color:${color};font-family:${family}`;
  return `<div style="${wrapper}">${cleaned}</div>`;
}

const BLOCK_TAGS = ['p', 'div', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const TAG_PATTERN = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)/g;

/**
 * 把 HTML 解析成「带样式的文字片段」，给长图在 canvas 上逐行排版用。
 * 返回块的数组：{ kind: 'p' | 'h' | 'li' | 'quote', level, ordered, index, runs: [{ text, bold, italic, underline, strike, color }] }
 * 一个块内的换行（<br>）用 text 为 '\n' 的片段表示。
 */
function parseRuns(html = '') {
  const blocks = [];
  let current = null;
  const lists = []; // { ordered, count }
  const state = { bold: 0, italic: 0, underline: 0, strike: 0, colors: [], headings: [], quote: 0 };

  const open = (kind, extra = {}) => {
    current = { kind, level: 0, ordered: false, index: 0, runs: [], ...extra };
    blocks.push(current);
    return current;
  };
  const close = () => {
    current = null;
  };
  const ensure = () => current || open(state.quote ? 'quote' : 'p');

  String(html || '').replace(TAG_PATTERN, (match, slash, rawName, attrs, text) => {
    if (text !== undefined) {
      const value = decodeEntities(text).replace(/\r?\n/g, '');
      if (!value) return match;
      const block = ensure();
      const heading = state.headings.length > 0;
      block.runs.push({
        text: value,
        bold: state.bold > 0 || heading,
        italic: state.italic > 0,
        underline: state.underline > 0,
        strike: state.strike > 0,
        color: state.colors.length ? state.colors[state.colors.length - 1] : ''
      });
      return match;
    }
    const name = rawName.toLowerCase();
    const closing = slash === '/';
    if (name === 'br') {
      ensure().runs.push({ text: '\n', bold: false, italic: false, underline: false, strike: false, color: '' });
      return match;
    }
    if (name === 'ul' || name === 'ol') {
      if (closing) lists.pop();
      else lists.push({ ordered: name === 'ol', count: 0 });
      close();
      return match;
    }
    if (name === 'strong' || name === 'b') state.bold += closing ? -1 : 1;
    else if (name === 'em' || name === 'i') state.italic += closing ? -1 : 1;
    else if (name === 'u') state.underline += closing ? -1 : 1;
    else if (name === 's') state.strike += closing ? -1 : 1;
    else if (name === 'span' || name === 'a') {
      if (closing) state.colors.pop();
      else {
        const styleMatch = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs || '');
        const own = styleMatch ? colorFromStyle(styleMatch[1] || styleMatch[2]) : '';
        // 没有自己的颜色就沿用外层的（<span> 嵌套 <span>）
        state.colors.push(own || (state.colors.length ? state.colors[state.colors.length - 1] : ''));
      }
    }

    if (BLOCK_TAGS.includes(name)) {
      if (closing) {
        if (/^h[1-6]$/.test(name)) state.headings.pop();
        if (name === 'blockquote') state.quote -= 1;
        close();
        return match;
      }
      close();
      if (/^h[1-6]$/.test(name)) {
        state.headings.push(name);
        open('h', { level: Number(name[1]) });
      } else if (name === 'li') {
        const list = lists[lists.length - 1] || { ordered: false, count: 0 };
        list.count += 1;
        open('li', { ordered: list.ordered, index: list.count });
      } else if (name === 'blockquote') {
        state.quote += 1;
        open('quote');
      } else {
        open(state.quote ? 'quote' : 'p');
      }
    }
    return match;
  });

  // 去掉没有任何文字的空块，但保留「空段落」当作一行空白（p 里只有 <br> 时 runs 是一个换行）
  return blocks.filter(block => block.runs.length > 0);
}

module.exports = {
  DEFAULT_COLOR,
  escapeHtml,
  decodeEntities,
  htmlToPlainText,
  plainTextToHtml,
  hasFormatting,
  normalizeColor,
  colorFromStyle,
  normalizeHtml,
  toDisplayHtml,
  parseRuns
};
