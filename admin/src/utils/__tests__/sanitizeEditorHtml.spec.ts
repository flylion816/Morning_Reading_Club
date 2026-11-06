import { describe, expect, it } from 'vitest';
import { sanitizeEditorHtml } from '../sanitizeEditorHtml';

describe('sanitizeEditorHtml', () => {
  it('removes executable markup and event handlers while preserving editor content', () => {
    const cleaned = sanitizeEditorHtml('<p onclick="alert(1)">安全文本<img src="https://example.test/a.png" onerror="alert(2)"></p><script>alert(3)</script><a href="javascript:alert(4)">链接</a>');
    expect(cleaned).toContain('安全文本');
    expect(cleaned).toContain('<img');
    expect(cleaned).not.toMatch(/onclick|onerror|<script|javascript:/i);
  });
});
