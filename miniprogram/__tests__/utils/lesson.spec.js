const {
  ZERO_BASED,
  ONE_BASED,
  getLessonNumberingBase,
  getLessonNumber,
  formatLessonLabel,
  formatShortLessonLabel
} = require('../../utils/lesson');

describe('lesson display numbering', () => {
  test.each([
    [[0, 1, 2], ZERO_BASED],
    [[1, 8, 15], ONE_BASED],
    [[], ZERO_BASED]
  ])('derives numbering base from period days %p', (days, expected) => {
    expect(getLessonNumberingBase(days)).toBe(expected);
  });

  test('increments every lesson in a zero-based period', () => {
    [0, 1, 8, 10].forEach(day => {
      expect(getLessonNumber(day, ZERO_BASED)).toBe(day + 1);
    });
  });

  test('keeps original numbers in a one-based period', () => {
    [1, 2, 8, 22].forEach(day => {
      expect(getLessonNumber(day, ONE_BASED)).toBe(day);
    });
  });

  test('infers standalone numbering safely', () => {
    expect(getLessonNumber(0)).toBe(1);
    expect(getLessonNumber(1)).toBe(1);
    expect(getLessonNumber(8)).toBe(8);
    expect(getLessonNumber(undefined)).toBe(1);
    expect(getLessonNumber(null)).toBe(1);
  });

  test('formats labels with an explicit period numbering base', () => {
    expect(formatLessonLabel(0, ZERO_BASED)).toBe('第 01 课');
    expect(formatLessonLabel(8, ZERO_BASED)).toBe('第 09 课');
    expect(formatLessonLabel(10, ZERO_BASED)).toBe('第 11 课');
    expect(formatLessonLabel(1, ONE_BASED)).toBe('第 01 课');
    expect(formatLessonLabel(22, ONE_BASED)).toBe('第 22 课');
  });

  test('formats compact labels for cards and shares', () => {
    expect(formatShortLessonLabel(0, ZERO_BASED)).toBe('第1课');
    expect(formatShortLessonLabel(8, ZERO_BASED)).toBe('第9课');
    expect(formatShortLessonLabel(8, ONE_BASED)).toBe('第8课');
  });
});
