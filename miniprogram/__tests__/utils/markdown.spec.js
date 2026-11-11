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

  test('should preserve explicit ordered item numbers across explanatory paragraphs', () => {
    const content = [
      '1、第一条',
      '',
      '第一条的解释。',
      '',
      '2、第二条',
      '',
      '第二条的解释。',
      '',
      '3、第三条'
    ].join('\n');

    const rendered = renderInsightRichTextContent(content);

    expect(rendered).toContain('<ol start="1"');
    expect(rendered).toContain('<ol start="2"');
    expect(rendered).toContain('<ol start="3"');
    expect(rendered.match(/<ol /g)).toHaveLength(3);
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
  describe('renderInsightLetterContent（信纸横线）', () => {
    const { renderInsightLetterContent, LETTER_LINE_HEIGHT } = require('../../utils/markdown');
    const line = `${LETTER_LINE_HEIGHT}px`;

    test('Markdown 内容对齐到信纸网格并标记可画横线', () => {
      const { html, lined } = renderInsightLetterContent(
        ['## 小凡看见', '', '第一段**重点**', '', '---', '', '- 一', '- 二', '', '> 引用'].join('\n')
      );

      expect(lined).toBe(true);
      // 行高全部固定为一行
      const lineHeights = html.match(/line-height:[^;"]+;/g);
      expect(lineHeights.length).toBeGreaterThan(0);
      lineHeights.forEach(item => expect(item).toBe(`line-height:${line};`));
      // 竖向间距只能是 0 或整行
      (html.match(/margin:[^;"]+;/g) || []).forEach(item => {
        expect(item).toMatch(new RegExp(`^margin:0( 0 ${line}( 1\\.4em)?| 0 0 1\\.4em)?;$`));
      });
      // 分隔线换成空行，不再有 1px / 2px 的色块
      expect(html).not.toContain('width:72px');
      expect(html).not.toContain('height:1px');
      expect(html).toContain(`<div style="height:${line};"></div>`);
    });

    test('原样保留的 HTML 和带图片的内容不画横线', () => {
      expect(renderInsightLetterContent('<p style="line-height:2">普通内容</p>')).toEqual({
        html: '<p style="line-height:2">普通内容</p>',
        lined: false
      });
      expect(renderInsightLetterContent('![图](https://example.com/a.png)').lined).toBe(false);
      expect(renderInsightLetterContent('')).toEqual({ html: '', lined: false });
    });

    test('横线周期与详情页样式一致', () => {
      const fs = require('fs');
      const path = require('path');
      const wxss = fs.readFileSync(path.join(__dirname, '../../pages/insight-detail/insight-detail.wxss'), 'utf8');
      const block = wxss.slice(wxss.indexOf('.content-text.letter-lined {'));
      expect(block).toContain(`${line}\n  );`);
      expect(block).toContain(`line-height: ${line};`);
    });
  });
});
