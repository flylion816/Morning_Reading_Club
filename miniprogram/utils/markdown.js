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

  const items = listItems
    .map(item => `<li style="margin:0 0 10px;">${renderInlineMarkdown(item, options.inlineOptions)}</li>`)
    .join('');
  blocks.push(
    `<${listType} style="margin:0 0 16px 1.4em;padding:0;line-height:1.8;">${items}</${listType}>`
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
      flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions() });
      listType = null;
      continue;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph(paragraphLines, blocks, { inlineOptions: getInlineOptions() });
      flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions() });
      listType = null;
      blocks.push(dividerNode());
      continue;
    }

    if (options.insightMode) {
      const titleType = getInsightTitleType(trimmed);
      if (titleType) {
        flushParagraph(paragraphLines, blocks, { inlineOptions: getInlineOptions() });
        flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions() });
        listType = null;
        insightSection = titleType;
        blocks.push(insightTitleNode(titleType, trimmed.replace(/^#{1,6}\s+/, '')));
        continue;
      }
    }

    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      flushParagraph(paragraphLines, blocks, { inlineOptions: getInlineOptions() });
      flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions() });
      listType = null;
      blocks.push(paragraphNode(`<strong>${renderInlineMarkdown(headingMatch[1], getInlineOptions())}</strong>`));
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      flushParagraph(paragraphLines, blocks, { inlineOptions: getInlineOptions() });
      flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions() });
      listType = null;
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
        flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions() });
        listType = null;
      }
      listType = 'ul';
      listItems.push(unorderedMatch[1]);
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph(paragraphLines, blocks, { inlineOptions: getInlineOptions() });
      if (listType && listType !== 'ol') {
        flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions() });
        listType = null;
      }
      listType = 'ol';
      listItems.push(orderedMatch[1]);
      continue;
    }

    if (listType) {
      flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions() });
      listType = null;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph(paragraphLines, blocks, { inlineOptions: getInlineOptions() });
  flushList(listType, listItems, blocks, { inlineOptions: getInlineOptions() });

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

module.exports = {
  isLikelyHtml,
  renderRichTextContent,
  renderInsightRichTextContent,
  richContentToPlainText
};
