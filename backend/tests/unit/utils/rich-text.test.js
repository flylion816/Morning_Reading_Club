const { expect } = require('chai');
const richText = require('../../../src/utils/rich-text');

const { sanitizeRichHtml, richTextHtmlToPlainText, hasRichFormatting } = richText;

describe('utils/rich-text（打卡、随喜、觉察共用的富文本清洗）', () => {
  describe('sanitizeRichHtml', () => {
    it('没有内容时返回 null，不是字符串时报错', () => {
      expect(sanitizeRichHtml(undefined)).to.deep.equal({ value: null });
      expect(sanitizeRichHtml(null)).to.deep.equal({ value: null });
      expect(sanitizeRichHtml('   ')).to.deep.equal({ value: null });
      expect(sanitizeRichHtml(42).error).to.equal('富文本内容格式不正确');
    });

    it('超过长度上限时报错，上限可以指定', () => {
      expect(sanitizeRichHtml('x'.repeat(20001)).error).to.contain('20000');
      expect(sanitizeRichHtml('x'.repeat(101), { maxLength: 100 }).error).to.contain('100');
      expect(sanitizeRichHtml('x'.repeat(100), { maxLength: 100 }).value).to.equal('x'.repeat(100));
    });

    it('保留白名单里的标签和颜色、加粗等样式', () => {
      const html = '<p>今天<strong>很重要</strong>，<span style="color: #dc2626">红色重点</span>，<em>斜体</em><u>下划线</u></p><ol><li>一</li></ol>';
      expect(sanitizeRichHtml(html).value).to.equal(
        '<p>今天<strong>很重要</strong>，<span style="color:#dc2626">红色重点</span>，<em>斜体</em><u>下划线</u></p><ol><li>一</li></ol>'
      );
    });

    it('去掉脚本、样式块、注释、事件属性和不在白名单里的标签', () => {
      const html = '<script>alert(1)</script><style>p{}</style><!-- x --><p onclick="evil()">正文<img src=x onerror=alert(1)><iframe src="x"></iframe></p>';
      const out = sanitizeRichHtml(html).value;
      expect(out).to.equal('<p>正文</p>');
    });

    it('样式只放行白名单属性，并拒绝 url()、expression()、javascript:', () => {
      const html = '<span style="color: red; position: fixed; background-image: url(http://x); background-color: expression(1); font-weight: bold">字</span>';
      expect(sanitizeRichHtml(html).value).to.equal('<span style="color:red;font-weight:bold">字</span>');
    });

    it('链接只放行 http(s)、站内路径和锚点', () => {
      expect(sanitizeRichHtml('<a href="https://a.com/x">好</a>').value).to.equal('<a href="https://a.com/x">好</a>');
      expect(sanitizeRichHtml('<a href="javascript:alert(1)">坏</a>').value).to.equal('<a>坏</a>');
    });

    it('br 规整成自闭合', () => {
      expect(sanitizeRichHtml('a<br>b').value).to.equal('a<br />b');
    });
  });

  describe('richTextHtmlToPlainText', () => {
    it('段落、换行、列表变成换行，解码实体，折叠多余空行', () => {
      expect(richTextHtmlToPlainText('<p>第一段</p><p>第二&amp;段<br/>换行</p><ul><li>甲</li><li>乙</li></ul>')).to.equal('第一段\n第二&段\n换行\n甲\n乙');
      expect(richTextHtmlToPlainText('<p>a</p><p></p><p></p><p>b</p>')).to.equal('a\n\nb');
      expect(richTextHtmlToPlainText('')).to.equal('');
    });
  });

  describe('hasRichFormatting', () => {
    it('只有普通段落时没有格式；有颜色、加粗、列表、链接时有格式', () => {
      expect(hasRichFormatting('<p>普通的一段</p><p>另一段</p>')).to.equal(false);
      expect(hasRichFormatting('<p><strong>粗</strong></p>')).to.equal(true);
      expect(hasRichFormatting('<p><span style="color:#dc2626">红</span></p>')).to.equal(true);
      expect(hasRichFormatting('<ol><li>一</li></ol>')).to.equal(true);
      expect(hasRichFormatting('<h2>标题</h2>')).to.equal(true);
      expect(hasRichFormatting('')).to.equal(false);
    });
  });
});
