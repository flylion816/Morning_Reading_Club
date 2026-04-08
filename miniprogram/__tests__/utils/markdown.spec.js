const {
  renderRichTextContent,
  richContentToPlainText,
  isLikelyHtml
} = require('../../utils/markdown');

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

  test('should strip markdown syntax when building plain text', () => {
    const content = '看到你的 **专注** 与 *柔软*。\n\n- 第一条\n- 第二条';
    const plainText = richContentToPlainText(content);

    expect(plainText).toContain('看到你的 专注 与 柔软。');
    expect(plainText).toContain('- 第一条');
    expect(plainText).toContain('- 第二条');
    expect(plainText).not.toContain('**');
  });

  test('should detect html-like strings', () => {
    expect(isLikelyHtml('<p>hello</p>')).toBe(true);
    expect(isLikelyHtml('**hello**')).toBe(false);
  });
});
