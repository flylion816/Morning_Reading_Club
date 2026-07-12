const {
  renderRichTextContent,
  renderInsightRichTextContent,
  richContentToPlainText,
  isLikelyHtml
} = require('../../utils/markdown');
const currentTenant = require('../../config/current-tenant');

describe('markdown utils', () => {
  test('should render markdown to rich-text friendly html', () => {
    const content = [
      '# 你的光',
      '',
      '你有 **稳定** 的力量，也有 *柔软* 的感受。',
      '',
      '- 第一条',
      '- 第二条'
    ].join('\n');

    const rendered = renderRichTextContent(content);

    expect(rendered).toContain('<strong>稳定</strong>');
    expect(rendered).toContain('<em>柔软</em>');
    expect(rendered).toContain('<ul');
    expect(rendered).toContain('<li style=');
  });

  test('should keep html content instead of escaping it again', () => {
    const content = '<p><strong>已经是 HTML</strong></p>';

    const rendered = renderRichTextContent(content);

    expect(rendered).toBe(content);
    expect(rendered).not.toContain('&lt;p&gt;');
  });

  test('should render html divider paragraphs as subtle separators', () => {
    const content = '<p>第一段</p><p><span>---</span></p><p>第二段</p>';

    const rendered = renderRichTextContent(content);

    expect(rendered).toContain('<p>第一段</p>');
    expect(rendered).toContain('<p>第二段</p>');
    expect(rendered).not.toContain('>---<');
    expect(rendered).toContain('width:72px');
    expect(rendered).toContain('background:#d8e0ea');
  });

  test('should strip markdown syntax when building plain text', () => {
    const content = '看到你的 **专注** 与 *柔软*。\n\n- 第一条\n- 第二条';
    const plainText = richContentToPlainText(content);

    expect(plainText).toContain('看到你的 专注 与 柔软。');
    expect(plainText).toContain('- 第一条');
    expect(plainText).toContain('- 第二条');
    expect(plainText).not.toContain('**');
  });

  test('should render standalone markdown dividers as subtle separators', () => {
    const content = ['第一段', '', '---', '', '第二段'].join('\n');

    const rendered = renderInsightRichTextContent(content);

    expect(rendered).not.toContain('>---<');
    expect(rendered).toContain('width:72px');
    expect(rendered).toContain('background:#d8e0ea');
  });

  test('should detect html-like strings', () => {
    expect(isLikelyHtml('<p>hello</p>')).toBe(true);
    expect(isLikelyHtml('**hello**')).toBe(false);
  });

  test('should render insight sections with visual hierarchy', () => {
    const content = [
      '### 筷筷在凡人晨读中的分享',
      '',
      '这是一段原文分享。',
      '',
      '## 小凡看见',
      '',
      '我看到了你的**真实与勇敢**。'
    ].join('\n');

    const rendered = renderInsightRichTextContent(content);

    expect(rendered).toContain('font-size:22px');
    expect(rendered).toContain(`border-left:4px solid ${currentTenant.primaryColor}`);
    expect(rendered).toContain('筷筷在凡人晨读中的分享');
    expect(rendered).toContain('background:#e8edf3');
    expect(rendered).toContain('margin:34px 0 22px');
    expect(rendered).toContain('font-size:22px');
    expect(rendered).toContain(`color:${currentTenant.primaryColor}`);
    expect(rendered).toContain('<strong style="color:#168c91;font-weight:800;">真实与勇敢</strong>');
  });
});
