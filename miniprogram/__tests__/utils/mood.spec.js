const { MOOD_OPTIONS, MOOD_SOURCE, getMoodOption } = require('../../utils/mood');

describe('utils/mood', () => {
  test('六种天气，值与后端枚举一致', () => {
    expect(MOOD_OPTIONS.map((i) => i.value)).toEqual(['happy', 'calm', 'thoughtful', 'inspired', 'low', 'other']);
    MOOD_OPTIONS.forEach((i) => expect(i.name && i.desc).toBeTruthy());
  });
  test('MOOD_SOURCE 为 picker', () => {
    expect(MOOD_SOURCE).toBe('picker');
  });
  test('getMoodOption', () => {
    expect(getMoodOption('low').name).toBe('小雨');
    expect(getMoodOption('x')).toBeNull();
  });
});
