import { sanitizeEditorHtml } from './sanitizeEditorHtml';

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const renderInline = (s: string) => escapeHtml(s)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/__([^_]+)__/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\n]+)\*(?=[^*]|$)/g, '$1<em>$2</em>');

function markdownToHtml(text: string): string {
  return text.split(/\n{2,}/).map(para => {
    const t = para.trim();
    if (!t) return '';
    if (/^#{1,3}\s/.test(t)) {
      const level = t.match(/^(#{1,3})/)?.[1]?.length || 2;
      const size = level === 1 ? 18 : level === 2 ? 16 : 14;
      return `<h${level} style="margin:0 0 10px;font-size:${size}px">${renderInline(t.replace(/^#+\s*/, ''))}</h${level}>`;
    }
    return `<p style="margin:0 0 14px;line-height:1.8">${renderInline(t).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

/**
 * 渲染「小凡看见」正文供 v-html 使用。
 * 内容可能来自小程序用户，任何分支的输出都必须经过 DOMPurify。
 */
export function renderInsightMarkdown(text: string | null | undefined): string {
  if (!text) return '';
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(text);
  return sanitizeEditorHtml(isHtml ? text : markdownToHtml(text));
}
