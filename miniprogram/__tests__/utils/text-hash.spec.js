const { normalizeText, hashText } = require('../../utils/text-hash');

describe('text-hash（与后端同一组样例）', () => {
  test('规范化', () => {
    expect(normalizeText('  读书  \n使人  充实 ')).toBe('读书 使人 充实');
  });

  test('哈希输出一致', () => {
    expect(hashText('')).toBe('811c9dc5');
    expect(hashText('a')).toBe('e40c292c');
    expect(hashText('晨读营')).toBe('296aea33');
    expect(hashText('Hello, World')).toBe('66d37c5d');
    expect(hashText('读书使人充实')).toBe('65eb0aa6');
    expect(hashText('读书使人充实😀')).toBe('d6f83d93');
    expect(hashText('  读书  \n使人  充实 ')).toBe('1144902c');
  });
});
