const { expect } = require('chai');
const { truncateText } = require('../../../src/utils/notification-links');

describe('notification text truncation', () => {
  it('does not split an emoji at the length limit', () => {
    expect(truncateText('你好😀再见', 3)).to.equal('你好...');
    expect(truncateText('你好😀再见', 4)).to.equal('你好😀...');
  });

  it('preserves short text and normal truncation', () => {
    expect(truncateText('  你好   世界  ', 10)).to.equal('你好 世界');
    expect(truncateText('你好世界', 2)).to.equal('你好...');
  });
});
