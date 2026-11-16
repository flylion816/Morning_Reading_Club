const rich = require('../../utils/rich-note');

describe('随喜 / 觉察的富文本工具', () => {
  describe('纯文本和 HTML 互转（与服务端同一算法）', () => {
    test('htmlToPlainText：段落、换行、列表变成换行，解码实体，折叠多余空行', () => {
      expect(rich.htmlToPlainText('<p>第一段</p><p>第二&amp;段<br/>换行</p><ul><li>甲</li><li>乙</li></ul>')).toBe('第一段\n第二&段\n换行\n甲\n乙');
      expect(rich.htmlToPlainText('<p>a</p><p><br></p><p>b</p>')).toBe('a\n\nb');
      expect(rich.htmlToPlainText('<p>a</p><p></p><p></p><p>b</p>')).toBe('a\n\nb');
      expect(rich.htmlToPlainText('')).toBe('');
    });

    test('plainTextToHtml：一行一个段落，空行是空段落，特殊字符转义；再换回来文字不变', () => {
      const text = '第一行 <b>&\n\n第三行';
      const html = rich.plainTextToHtml(text);
      expect(html).toBe('<p>第一行 &lt;b&gt;&amp;</p><p><br></p><p>第三行</p>');
      expect(rich.htmlToPlainText(html)).toBe(text);
      expect(rich.plainTextToHtml('   ')).toBe('');
      expect(rich.plainTextToHtml('a\r\nb')).toBe('<p>a</p><p>b</p>');
    });
  });

  describe('格式判断和整理', () => {
    test('hasFormatting：只有普通段落没有格式；颜色、加粗、列表、标题、链接有格式', () => {
      expect(rich.hasFormatting('<p>普通</p><p>两段</p>')).toBe(false);
      expect(rich.hasFormatting('<p><strong>粗</strong></p>')).toBe(true);
      expect(rich.hasFormatting('<p><span style="color: rgb(220, 38, 38)">红</span></p>')).toBe(true);
      expect(rich.hasFormatting('<ol><li>一</li></ol>')).toBe(true);
      expect(rich.hasFormatting('<h2>标题</h2>')).toBe(true);
      expect(rich.hasFormatting('')).toBe(false);
    });

    test('normalizeColor：统一成小写 #rrggbb', () => {
      expect(rich.normalizeColor('#DC2626')).toBe('#dc2626');
      expect(rich.normalizeColor('#f00')).toBe('#ff0000');
      expect(rich.normalizeColor('rgb(220, 38, 38)')).toBe('#dc2626');
      expect(rich.normalizeColor('rgba(0,0,0,0.5)')).toBe('#000000');
      expect(rich.normalizeColor('')).toBe('');
      expect(rich.colorFromStyle('font-size: 14px; color: rgb(217, 119, 6)')).toBe('#d97706');
      expect(rich.colorFromStyle('background-color: red')).toBe('');
    });

    test('normalizeHtml：editor 导出空段落时用纯文本补出 HTML；纯文本为空则没有内容', () => {
      expect(rich.normalizeHtml('<p><br></p>', '写了一点')).toBe('<p>写了一点</p>');
      expect(rich.normalizeHtml('', '写了一点')).toBe('<p>写了一点</p>');
      expect(rich.normalizeHtml('<p><strong>粗</strong></p>', '粗')).toBe('<p><strong>粗</strong></p>');
      expect(rich.normalizeHtml('<p><br></p>', '   ')).toBe('');
    });
  });

  describe('toDisplayHtml：给 rich-text 展示用', () => {
    test('清掉 class/id/data-*，给段落、列表、标题补上间距，整体包一层字号和颜色', () => {
      const out = rich.toDisplayHtml('<p class="ql-x" id="a" data-k="1">正文<span style="color:#dc2626">红</span></p><ol><li>一</li></ol><h2>标题</h2>', { fontSize: '16px', lineHeight: '1.75', color: '#111111' });
      expect(out.startsWith('<div style="font-size:16px;line-height:1.75;color:#111111;font-family:inherit">')).toBe(true);
      expect(out).not.toMatch(/ql-x|id="a"|data-k/);
      expect(out).toContain('<p style="margin:0 0 .45em">正文<span style="color:#dc2626">红</span></p>');
      expect(out).toContain('<ol style="margin:0 0 .45em;padding-left:1.4em"><li>一</li></ol>');
      expect(out).toContain('<h2 style="margin:.2em 0 .45em">标题</h2>');
    });

    test('已有 style 时合并而不是覆盖；没有内容时返回空串', () => {
      expect(rich.toDisplayHtml('<p style="text-align: center">居中</p>')).toContain('<p style="margin:0 0 .45em;text-align: center">居中</p>');
      expect(rich.toDisplayHtml('')).toBe('');
      expect(rich.toDisplayHtml('   ')).toBe('');
      // 默认继承外层 rich-text 的样式
      expect(rich.toDisplayHtml('<p>x</p>')).toContain('font-size:inherit;line-height:inherit;color:inherit;font-family:inherit');
    });
  });

  describe('parseRuns：把 HTML 解析成带样式的文字片段（给长图排版）', () => {
    const runsOf = html => rich.parseRuns(html);

    test('段落里的颜色、粗体、斜体、下划线、删除线', () => {
      const [block] = runsOf('<p>普通<strong>粗</strong><em>斜</em><u>下</u><s>删</s><span style="color: #DC2626">红</span></p>');
      expect(block.kind).toBe('p');
      expect(block.runs.map(run => [run.text, run.bold, run.italic, run.underline, run.strike, run.color])).toEqual([
        ['普通', false, false, false, false, ''],
        ['粗', true, false, false, false, ''],
        ['斜', false, true, false, false, ''],
        ['下', false, false, true, false, ''],
        ['删', false, false, false, true, ''],
        ['红', false, false, false, false, '#dc2626']
      ]);
    });

    test('样式可以嵌套叠加：红色的粗体', () => {
      const [block] = runsOf('<p><strong><span style="color:#dc2626">红粗</span></strong>后面</p>');
      expect(block.runs[0]).toMatchObject({ text: '红粗', bold: true, color: '#dc2626' });
      expect(block.runs[1]).toMatchObject({ text: '后面', bold: false, color: '' });
    });

    test('标题整行加粗；列表按有序 / 无序编号；引用单独成块', () => {
      const blocks = runsOf('<h2>标题</h2><ol><li>一</li><li>二</li></ol><ul><li>点</li></ul><blockquote>引</blockquote>');
      expect(blocks.map(block => block.kind)).toEqual(['h', 'li', 'li', 'li', 'quote']);
      expect(blocks[0]).toMatchObject({ level: 2 });
      expect(blocks[0].runs[0].bold).toBe(true);
      expect(blocks[1]).toMatchObject({ ordered: true, index: 1 });
      expect(blocks[2]).toMatchObject({ ordered: true, index: 2 });
      expect(blocks[3]).toMatchObject({ ordered: false, index: 1 });
    });

    test('块里的 <br> 是一个换行片段；空段落（只有 <br>）保留成一行空白', () => {
      const blocks = runsOf('<p>第一行<br/>第二行</p><p><br></p><p>末段</p>');
      expect(blocks).toHaveLength(3);
      expect(blocks[0].runs.map(run => run.text)).toEqual(['第一行', '\n', '第二行']);
      expect(blocks[1].runs.map(run => run.text)).toEqual(['\n']);
    });

    test('实体被解码；没有标签的纯文本也能解析；空内容返回空数组', () => {
      expect(runsOf('<p>a &amp; b &lt;c&gt;</p>')[0].runs[0].text).toBe('a & b <c>');
      expect(runsOf('直接的一段')[0].runs[0].text).toBe('直接的一段');
      expect(runsOf('')).toEqual([]);
      expect(runsOf('<p></p>')).toEqual([]);
    });

    test('rgb 颜色也被统一成 #rrggbb', () => {
      const [block] = runsOf('<p><span style="color: rgb(22, 140, 145)">青</span></p>');
      expect(block.runs[0].color).toBe('#168c91');
    });
  });
});
