const {
  normalizeDanmakuContent,
  countDanmakuChars,
  truncateDanmakuContent
} = require('../../utils/danmaku');

describe('Danmaku Utility', () => {
  test('should convert common WeChat emoji shortcode for display', () => {
    expect(normalizeDanmakuContent('筱筱加油[加油]!')).toBe('筱筱加油💪!');
    expect(normalizeDanmakuContent('收到[爱心]')).toBe('收到❤️');
  });

  test('should keep unknown shortcodes unchanged', () => {
    expect(normalizeDanmakuContent('继续[未知表情]')).toBe('继续[未知表情]');
  });

  test('should count unicode emoji as one character', () => {
    expect(countDanmakuChars('加油💪❤️')).toBe(4);
  });

  test('should truncate by unicode character count', () => {
    expect(truncateDanmakuContent('💪'.repeat(61), 60)).toBe('💪'.repeat(60));
  });
});
