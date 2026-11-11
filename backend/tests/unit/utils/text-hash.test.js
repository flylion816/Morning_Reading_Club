const { expect } = require('chai');
const { normalizeText, hashText } = require('../../../src/utils/text-hash');

describe('text-hash', () => {
  it('规范化：去首尾空白并合并连续空白', () => {
    expect(normalizeText('  读书  \n使人  充实 ')).to.equal('读书 使人 充实');
    expect(normalizeText(null)).to.equal('');
  });

  it('与小程序端使用同一组样例输出', () => {
    expect(hashText('')).to.equal('811c9dc5');
    expect(hashText('a')).to.equal('e40c292c');
    expect(hashText('晨读营')).to.equal('296aea33');
    expect(hashText('Hello, World')).to.equal('66d37c5d');
    expect(hashText('读书使人充实')).to.equal('65eb0aa6');
    expect(hashText('读书使人充实😀')).to.equal('d6f83d93');
    expect(hashText('  读书  \n使人  充实 ')).to.equal('1144902c');
  });
});
