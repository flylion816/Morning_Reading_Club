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

function renderInlineMarkdown(text) {
  let rendered = escapeHtml(text);

  rendered = rendered.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g,
    '<img src="$2" alt="$1" style="display:block;max-width:100%;height:auto;margin:12px 0;border-radius:8px;" />'
  );
  rendered = rendered.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" style="color:#357abd;text-decoration:underline;">$1</a>'
  );
  rendered = rendered.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  rendered = rendered.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  rendered = rendered.replace(/(^|[^*])\*([^*\n]+)\*(?=[^*]|$)/g, '$1<em>$2</em>');
  rendered = rendered.replace(/(^|[^_])_([^_\n]+)_(?=[^_]|$)/g, '$1<em>$2</em>');

  return rendered;
}

function paragraphNode(content, extraStyle = '') {
  const style = ['margin:0 0 16px;', 'line-height:1.8;', extraStyle].filter(Boolean).join('');
  return `<p style="${style}">${content}</p>`;
}

function flushParagraph(paragraphLines, blocks) {
  if (!paragraphLines.length) return;
  const joined = paragraphLines.map(renderInlineMarkdown).join('<br/>');
  blocks.push(paragraphNode(joined));
  paragraphLines.length = 0;
}

function flushList(listType, listItems, blocks) {
  if (!listType || !listItems.length) return;

  const items = listItems
    .map(item => `<li style="margin:0 0 10px;">${renderInlineMarkdown(item)}</li>`)
    .join('');
  blocks.push(
    `<${listType} style="margin:0 0 16px 1.4em;padding:0;line-height:1.8;">${items}</${listType}>`
  );

  listItems.length = 0;
}

function markdownToRichText(markdown) {
  const lines = String(markdown || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');
  const blocks = [];
  const paragraphLines = [];
  const listItems = [];
  let listType = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph(paragraphLines, blocks);
      flushList(listType, listItems, blocks);
      listType = null;
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      flushParagraph(paragraphLines, blocks);
      flushList(listType, listItems, blocks);
      listType = null;
      blocks.push(paragraphNode(`<strong>${renderInlineMarkdown(headingMatch[1])}</strong>`));
      continue;
    }

    const quoteMatch = trimmed.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      flushParagraph(paragraphLines, blocks);
      flushList(listType, listItems, blocks);
      listType = null;
      blocks.push(
        paragraphNode(renderInlineMarkdown(quoteMatch[1]), 'padding-left:12px;border-left:3px solid #d6e4ff;color:#5b6b8c;')
      );
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph(paragraphLines, blocks);
      if (listType && listType !== 'ul') {
        flushList(listType, listItems, blocks);
        listType = null;
      }
      listType = 'ul';
      listItems.push(unorderedMatch[1]);
      continue;
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph(paragraphLines, blocks);
      if (listType && listType !== 'ol') {
        flushList(listType, listItems, blocks);
        listType = null;
      }
      listType = 'ol';
      listItems.push(orderedMatch[1]);
      continue;
    }

    if (listType) {
      flushList(listType, listItems, blocks);
      listType = null;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph(paragraphLines, blocks);
  flushList(listType, listItems, blocks);

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

  return isLikelyHtml(content) ? sanitizeHtml(content) : markdownToRichText(content);
}

module.exports = {
  isLikelyHtml,
  renderRichTextContent,
  richContentToPlainText
};
