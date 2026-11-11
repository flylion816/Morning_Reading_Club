const { getDaypart } = require('../../utils/daypart');

const at = (h, m = 0) => new Date(2026, 10, 10, h, m);

describe('daypart', () => {
  test.each([
    [at(5, 0), 'dawn', '早安', '#fbe3c3', '#000000'],
    [at(7, 59), 'dawn', '早安', '#fbe3c3', '#000000'],
    [at(8, 0), 'day', '上午好', '#fffdf8', '#000000'],
    [at(11, 59), 'day', '上午好', '#fffdf8', '#000000'],
    [at(12, 0), 'day', '下午好', '#fffdf8', '#000000'],
    [at(16, 59), 'day', '下午好', '#fffdf8', '#000000'],
    [at(17, 0), 'dusk', '傍晚好', '#f3c7b2', '#000000'],
    [at(19, 29), 'dusk', '傍晚好', '#f3c7b2', '#000000'],
    [at(19, 30), 'night', '夜深了', '#1f2a44', '#ffffff'],
    [at(23, 59), 'night', '夜深了', '#1f2a44', '#ffffff'],
    [at(0, 0), 'night', '夜深了', '#1f2a44', '#ffffff'],
    [at(4, 59), 'night', '夜深了', '#1f2a44', '#ffffff']
  ])('%s -> %s', (date, key, greeting, navBackground, navFront) => {
    expect(getDaypart(date)).toEqual({ key, greeting, navBackground, navFront });
  });

  test('accepts minutes of the day', () => {
    expect(getDaypart(5 * 60).key).toBe('dawn');
    expect(getDaypart(5 * 60 - 1).key).toBe('night');
    expect(getDaypart(12 * 60).greeting).toBe('下午好');
    expect(getDaypart(19 * 60 + 30).key).toBe('night');
  });

  test('falls back to the current time for invalid input', () => {
    expect(['dawn', 'day', 'dusk', 'night']).toContain(getDaypart(new Date('x')).key);
    expect(['dawn', 'day', 'dusk', 'night']).toContain(getDaypart().key);
  });
});
