/**
 * 富文本（微信 editor 导出的 HTML）的清洗和纯文本转换。
 * 打卡、随喜、觉察共用一份规则：只放行白名单标签和样式属性，去掉脚本、事件属性和危险链接。
 */
const MAX_RICH_HTML_LENGTH = 20000;

const ALLOWED_HTML_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'span', 'div', 'blockquote',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a'
]);

const ALLOWED_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-align',
  'line-height',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-left',
  'border-left'
]);

function decodeHtmlEntities(text = '') {
  return String(text)
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&');
}

function escapeHtmlAttribute(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function richTextHtmlToPlainText(html = '') {
  return decodeHtmlEntities(
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

function sanitizeStyle(style = '') {
  return String(style || '')
    .split(';')
    .map(rule => rule.trim())
    .filter(Boolean)
    .map(rule => {
      const separatorIndex = rule.indexOf(':');
      if (separatorIndex === -1) return '';

      const prop = rule.slice(0, separatorIndex).trim().toLowerCase();
      const value = rule.slice(separatorIndex + 1).trim();
      if (!ALLOWED_STYLE_PROPS.has(prop)) return '';
      if (/expression\s*\(|url\s*\(|javascript:/i.test(value)) return '';

      return `${prop}:${value}`;
    })
    .filter(Boolean)
    .join(';');
}

/**
 * 清洗 HTML。返回 { value }（value 为 null 表示清洗后什么都没有）或 { error }。
 * 与原来打卡里的 sanitizeCheckinHtml 行为完全一致。
 */
function sanitizeRichHtml(contentHtml, { maxLength = MAX_RICH_HTML_LENGTH } = {}) {
  if (contentHtml === undefined || contentHtml === null) {
    return { value: null };
  }

  if (typeof contentHtml !== 'string') {
    return { error: '富文本内容格式不正确' };
  }

  if (contentHtml.length > maxLength) {
    return { error: `富文本内容不能超过${maxLength}字` };
  }

  let sanitized = contentHtml
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!doctype[\s\S]*?>/gi, '');

  sanitized = sanitized.replace(/<\/?([a-zA-Z][\w:-]*)([^>]*)>/g, (match, tagName, rawAttrs = '') => {
    const lowerTagName = tagName.toLowerCase();
    const isClosingTag = /^<\//.test(match);

    if (!ALLOWED_HTML_TAGS.has(lowerTagName)) {
      return '';
    }

    if (isClosingTag) {
      return `</${lowerTagName}>`;
    }

    const attrs = [];
    const attrPattern = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    for (const attrMatch of rawAttrs.matchAll(attrPattern)) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[3] ?? attrMatch[4] ?? attrMatch[5] ?? '';

      if (attrName.startsWith('on')) continue;

      if (attrName === 'style') {
        const safeStyle = sanitizeStyle(attrValue);
        if (safeStyle) {
          attrs.push(`style="${escapeHtmlAttribute(safeStyle)}"`);
        }
        continue;
      }

      if (lowerTagName === 'a' && attrName === 'href') {
        const trimmedHref = String(attrValue).trim();
        if (/^(https?:\/\/|\/|#)/i.test(trimmedHref)) {
          attrs.push(`href="${escapeHtmlAttribute(trimmedHref)}"`);
        }
      }
    }

    const suffix = lowerTagName === 'br' ? ' /' : '';
    return `<${lowerTagName}${attrs.length ? ` ${attrs.join(' ')}` : ''}${suffix}>`;
  });

  return { value: sanitized.trim() || null };
}

// 有没有真正的格式（颜色、加粗、列表…）。没有格式时只保存纯文本，不存 HTML
function hasRichFormatting(html = '') {
  const value = String(html || '');
  return /<\s*(strong|b|em|i|u|s|h[1-6]|ul|ol|li|blockquote|a)\b/i.test(value) || /<[^>]+\sstyle\s*=/i.test(value);
}

module.exports = {
  MAX_RICH_HTML_LENGTH,
  ALLOWED_HTML_TAGS,
  ALLOWED_STYLE_PROPS,
  decodeHtmlEntities,
  escapeHtmlAttribute,
  richTextHtmlToPlainText,
  sanitizeStyle,
  sanitizeRichHtml,
  hasRichFormatting
};
