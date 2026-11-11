const { THEME_PRIMARY } = require('./theme');

function isLikelyHtml(content) {
  return typeof content === 'string' && /<\/?[a-z][\s\S]*>/i.test(content);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .trim();
}

const INSIGHT_SHARE_TITLE_PATTERN = /在凡人晨读营?中的分享$/;

function renderInlineMarkdown(text, options = {}) {
  let rendered = escapeHtml(text);
  const strongStyle = options.strongStyle ? ` style="${options.strongStyle}"` : '';

  rendered = rendered.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
    '<img src="$2" alt="$1" style="display:block;max-width:100%;height:auto;margin:12px 0;border-radius:8px;" />'
  );
  rendered = rendered.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    `<a href="$2" style="color:${THEME_PRIMARY};text-decoration:underline;">$1</a>`
  );
  rendered = rendered.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, `<strong${strongStyle}>$1</strong>`);
  rendered = rendered.replace(/__([^_]+)__/g, `<strong${strongStyle}>$1</strong>`);
  rendered = rendered.replace(/(^|[^*])\*([^*\n]+)\*(?=[^*]|$)/g, '$1<em>$2</em>');
  rendered = rendered.replace(/(^|[^_])_([^_\n]+)_(?=[^_]|$)/g, '$1<em>$2</em>');

  return rendered;
}

function paragraphNode(content, extraStyle = '') {
  const style = ['margin:0 0 16px;', 'line-height:1.8;', extraStyle].filter(Boolean).join('');
  return `<p style="${style}">${content}</p>`;
}

function dividerNode() {
  return '<div style="width:72px;height:2px;background:#d8e0ea;border-radius:999px;margin:30px auto 28px;"></div>';
}

function renderHtmlDividers(html) {
  return String(html).replace(
    /<(p|div)(?:\s[^>]*)?>\s*(?:<(?:span|strong|em|b|i|u)(?:\s[^>]*)?>\s*)*(?:-{3,}|\*{3,}|_{3,})\s*(?:<\/(?:span|strong|em|b|i|u)>\s*)*<\/\1>/gi,
    dividerNode()
  );
}

function getInsightTitleType(text) {
  const normalized = String(text || '')
    .replace(/^#{1,6}\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .trim();

  if (normalized === '小凡看见') return 'xiaofan';
  if (INSIGHT_SHARE_TITLE_PATTERN.test(normalized)) return 'share';
  return '';
}

function insightTitleNode(type, title) {
  if (type === 'share') {
    return [
      `<p style="margin:0 0 28px;padding-left:12px;border-left:4px solid ${THEME_PRIMARY};line-height:1.35;font-size:22px;font-weight:900;color:#1f2937;">`,
      renderInlineMarkdown(title),
      '</p>'
    ].join('');
  }

  return [
    '<div style="height:1px;background:#e8edf3;margin:34px 0 22px;"></div>',
    `<p style="margin:0 0 24px;padding-left:12px;border-left:4px solid ${THEME_PRIMARY};line-height:1.35;font-size:22px;font-weight:900;color:${THEME_PRIMARY};">`,
    renderInlineMarkdown(title),
    '</p>'
  ].join('');
}

function flushParagraph(paragraphLines, blocks, options = {}) {
  if (!paragraphLines.length) return;
  const joined = paragraphLines
    .map(line => renderInlineMarkdown(line, options.inlineOptions))
    .join('<br/>');
  blocks.push(paragraphNode(joined));
  paragraphLines.length = 0;
}

function flushList(listType, listItems, blocks, options = {}) {
  if (!listType || !listItems.length) return;

  const listStart = Number.isInteger(options.listStart) ? ` start=\"${options.listStart}\"` : '';

  const items = listItems
    .map(item => `<li style="margin:0 0 10px;">${renderInlineMarkdown(item, options.inlineOptions)}</li>`)
    .join('');
  blocks.push(
    `<${listType}${listStart} style="margin:0 0 16px 1.4em;padding:0;line-height:1.8;">${items}</${listType}>`
  );

  listItems.length = 0;
}

function markdownToRichText(markdown, options = {}) {
  const lines = String(markdown || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');
  const blocks = [];
  const paragraphLines = [];
  const listItems = [];
  let listType = null;
  let listStart = null;
  let insightSection = '';

  const getInlineOptions = () => {
    if (options.insightMode && insightSection === 'xiaofan') {
      return {
        strongStyle: 'color:#168c91;font-weight:800;'
      };
    }
    return undefined;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph(paragraphLines, blocks, { inlineOptions: getInlineOptions() });
      flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions(), listStart });
      listType = null;
      listStart = null;
      continue;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph(paragraphLines, blocks, { inlineOptions: getInlineOptions() });
      flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions(), listStart });
      listType = null;
      listStart = null;
      blocks.push(dividerNode());
      continue;
    }

    if (options.insightMode) {
      const titleType = getInsightTitleType(trimmed);
      if (titleType) {
        flushParagraph(paragraphLines, blocks, { inlineOptions: getInlineOptions() });
        flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions(), listStart });
        listType = null;
        listStart = null;
        insightSection = titleType;
        blocks.push(insightTitleNode(titleType, trimmed.replace(/^#{1,6}\s+/, '')));
        continue;
      }
    }

    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      flushParagraph(paragraphLines, blocks, { inlineOptions: getInlineOptions() });
      flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions(), listStart });
      listType = null;
      listStart = null;
      blocks.push(paragraphNode(`<strong>${renderInlineMarkdown(headingMatch[1], getInlineOptions())}</strong>`));
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      flushParagraph(paragraphLines, blocks, { inlineOptions: getInlineOptions() });
      flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions(), listStart });
      listType = null;
      listStart = null;
      blocks.push(
        paragraphNode(
          renderInlineMarkdown(quoteMatch[1], getInlineOptions()),
          'padding-left:12px;border-left:3px solid #d6e4ff;color:#5b6b8c;'
        )
      );
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph(paragraphLines, blocks, { inlineOptions: getInlineOptions() });
      if (listType && listType !== 'ul') {
        flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions(), listStart });
        listType = null;
        listStart = null;
      }
      listType = 'ul';
      listItems.push(unorderedMatch[1]);
      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+)[.、]\s*(.+)$/);
    if (orderedMatch) {
      flushParagraph(paragraphLines, blocks, { inlineOptions: getInlineOptions() });
      if (listType && listType !== 'ol') {
        flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions(), listStart });
        listType = null;
        listStart = null;
      }
      listType = 'ol';
      if (listStart === null) listStart = Number(orderedMatch[1]);
      listItems.push(orderedMatch[2]);
      continue;
    }

    if (listType) {
      flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions(), listStart });
      listType = null;
      listStart = null;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph(paragraphLines, blocks, { inlineOptions: getInlineOptions() });
  flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions(), listStart });

  return blocks.join('');
}

function decodeHtmlEntities(text) {
  return String(text)
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&');
}

function richContentToPlainText(content) {
  if (!content) return '';

  const html = isLikelyHtml(content) ? sanitizeHtml(content) : markdownToRichText(content);

  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/(ul|ol)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderRichTextContent(content) {
  if (!content) return '';

  // 如果内容是纯 HTML（含块级标签），直接 sanitize
  if (isLikelyHtml(content)) {
    // 但如果同时含有 Markdown 语法（## / ** 等），说明是混合内容，
    // 先剥离 HTML 标签转为纯文本再走 Markdown 渲染
    const hasMarkdownSyntax = /^#{1,6}\s|^\*\*|^\*\s|^-\s|^>\s/m.test(content);
    if (hasMarkdownSyntax) {
      const plain = richContentToPlainText(content);
      return markdownToRichText(plain);
    }
    return renderHtmlDividers(sanitizeHtml(content));
  }

  return markdownToRichText(content);
}

function renderInsightRichTextContent(content) {
  if (!content) return '';

  if (isLikelyHtml(content)) {
    const plain = richContentToPlainText(content);
    if (getInsightTitleType(plain) || /小凡看见/.test(plain)) {
      return markdownToRichText(plain, { insightMode: true });
    }
    return renderHtmlDividers(sanitizeHtml(content));
  }

  return markdownToRichText(content, { insightMode: true });
}

// 信纸横线的行高（px）。详情页的横线背景按这个周期重复，正文必须落在同一套网格上。
const LETTER_LINE_HEIGHT = 32;

// 把渲染好的富文本压到信纸网格上：行高固定，段间距取整行，分隔线换成一行空行。
function alignToLetterGrid(html) {
  const line = `${LETTER_LINE_HEIGHT}px`;
  return String(html)
    // 「××在凡人晨读中的分享」是栏目标题，不属于信的正文
    .replace(/<p style="[^"]*font-size:22px;font-weight:900;color:#1f2937;">[\s\S]*?<\/p>/g, '')
    // 「小凡看见」小标题：去掉色条和大字号，只留一行加粗的暖色字
    .replace(/<p style="[^"]*font-size:22px;font-weight:900;color:[^"]*">/g, '<p style="margin:0;line-height:32px;font-weight:700;color:#8a4b12;">')
    .replace(/color:#168c91;font-weight:800;/g, 'color:#8a4b12;font-weight:700;')
    // 「小凡看见」前的细线：上一段已经留了一行空行，这里不再多空一行
    .replace(/<div style="height:1px;background:#e8edf3;margin:34px 0 22px;"><\/div>/g, '')
    .replace(/<div style="width:72px;height:2px;[^"]*"><\/div>/g, `<div style="height:${line};"></div>`)
    .replace(/line-height:[^;"]+;/g, `line-height:${line};`)
    .replace(/margin:0 0 (\d+)px( 1\.4em)?;/g, (match, size, indent) =>
      Number(size) <= 10 ? `margin:0${indent ? ` 0 0${indent}` : ''};` : `margin:0 0 ${line}${indent || ''};`
    );
}

// 小凡看见详情页用：返回 { html, lined }。
// 只有走 Markdown 渲染的内容才能保证每一行都落在横线上；原样保留的 HTML 不画横线。
function renderInsightLetterContent(content) {
  if (!content) return { html: '', lined: false };

  if (isLikelyHtml(content)) {
    const plain = richContentToPlainText(content);
    if (getInsightTitleType(plain) || /小凡看见/.test(plain)) {
      return { html: alignToLetterGrid(markdownToRichText(plain, { insightMode: true })), lined: true };
    }
    return { html: renderHtmlDividers(sanitizeHtml(content)), lined: false };
  }

  const html = markdownToRichText(content, { insightMode: true });
  // 图片高度不定，会把后面的文字挤出网格
  if (/<img\s/i.test(html)) return { html, lined: false };
  return { html: alignToLetterGrid(html), lined: true };
}

module.exports = {
  LETTER_LINE_HEIGHT,
  renderInsightLetterContent,
  isLikelyHtml,
  renderRichTextContent,
  renderInsightRichTextContent,
  richContentToPlainText
};
