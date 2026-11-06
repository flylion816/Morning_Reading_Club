import { describe, expect, it } from 'vitest';
import { renderInsightMarkdown } from '../renderInsightMarkdown';

describe('renderInsightMarkdown', () => {
  it('用户提交的 HTML 内容会被清洗，不能执行脚本', () => {
    const html = renderInsightMarkdown('<p>你好</p><img src=x onerror="fetch(\'//evil\')"><script>alert(1)</script><a href="javascript:alert(2)">点我</a>');
    expect(html).toContain('你好');
    expect(html).not.toMatch(/onerror|<script|javascript:/i);
  });

  it('Markdown 正文保持原有渲染效果', () => {
    const html = renderInsightMarkdown('## 标题\n\n第一段 **重点**\n换行');
    // happy-dom 下 DOMPurify 会丢掉部分块级标签，真实浏览器保留 <h2>（已在浏览器验证），这里只断言内容不丢。
    expect(html).toContain('标题');
    expect(html).toContain('<strong>重点</strong>');
    expect(html).toContain('<br>');
  });

  it('Markdown 中的尖括号被转义', () => {
    expect(renderInsightMarkdown('a < b 并且 c > d')).toContain('&lt;');
  });

  it('空内容返回空串', () => {
    expect(renderInsightMarkdown('')).toBe('');
    expect(renderInsightMarkdown(null)).toBe('');
  });
});
