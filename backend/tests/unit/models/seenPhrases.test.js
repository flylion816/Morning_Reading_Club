const { expect } = require('chai');
const { SEEN_PHRASES, SEEN_PHRASE_KEYS, isValidSeenPhrase } = require('../../../src/constants/seenPhrases');

describe('seenPhrases', () => {
  it('只有四句预设短句', () => {
    expect(SEEN_PHRASE_KEYS).to.deep.equal(['persist', 'touched', 'thanks', 'metoo']);
    expect(SEEN_PHRASES.persist).to.equal('我看见你的坚持');
  });
  it('校验短句键，不接受自由文本或原型键', () => {
    expect(isValidSeenPhrase('persist')).to.equal(true);
    expect(isValidSeenPhrase('我看见你的坚持')).to.equal(false);
    expect(isValidSeenPhrase('toString')).to.equal(false);
    expect(isValidSeenPhrase(undefined)).to.equal(false);
  });
});
