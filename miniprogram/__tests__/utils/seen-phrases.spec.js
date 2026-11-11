const {
  SEEN_PHRASES,
  getSeenPhraseText,
  getSeenPhraseSeal
} = require('../../utils/seen-phrases');

describe('seen-phrases', () => {
  test('keeps the four preset phrases in the same keys as the backend', () => {
    expect(SEEN_PHRASES.map(p => p.key)).toEqual(['persist', 'touched', 'thanks', 'metoo']);
    expect(SEEN_PHRASES.map(p => p.text)).toEqual([
      '我看见你的坚持',
      '这句话说到我心里了',
      '谢谢你愿意说出来',
      '我也是这样'
    ]);
  });

  test('each phrase has a single-character seal', () => {
    SEEN_PHRASES.forEach(p => expect([...p.seal]).toHaveLength(1));
    expect(getSeenPhraseSeal('persist')).toBe('持');
  });

  test('unknown keys return empty strings', () => {
    expect(getSeenPhraseText('nope')).toBe('');
    expect(getSeenPhraseText('toString')).toBe('');
    expect(getSeenPhraseSeal(undefined)).toBe('');
  });
});
