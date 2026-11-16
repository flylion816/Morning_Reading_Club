const text = require('../../pages/joy-notes/awareness-text');

describe('觉察文字小工具', () => {
  test('composeText 与服务端拼法一致：看 / 感 / 身 / 问 / 择，缺的不出现', () => {
    expect(
      text.composeText({
        facts: '孩子磨蹭，我提高了声音。',
        feelings: ['着急', '委屈'],
        feelingNote: '有点累',
        bodyAreas: ['胸口'],
        asks: [{ answer: '我只听见了时间。' }, { answer: '他想画完那页。' }],
        choice: '明天提前十分钟叫他'
      })
    ).toBe(['看：孩子磨蹭，我提高了声音。', '感：着急、委屈。有点累', '身：胸口', '问：我只听见了时间。', '问：他想画完那页。', '择：明天提前十分钟叫他'].join('\n'));
    expect(text.composeText({ choice: '只有择' })).toBe('择：只有择');
    expect(text.composeText()).toBe('');
  });

  test('一天里的时段', () => {
    const at = hour => text.daypartLabel(new Date(2026, 10, 16, hour, 0));
    expect([at(3), at(6), at(10), at(13), at(16), at(21)]).toEqual(['深夜', '清晨', '上午', '中午', '下午', '晚上']);
    expect(text.dateWithDaypart(new Date(2026, 10, 16, 7, 30))).toBe('11月16日 清晨');
    expect(text.dateWithDaypart('nope')).toBe('');
    expect(text.monthDay(new Date(2026, 10, 3))).toBe('11月3日');
    expect(text.monthDay('nope')).toBe('');
    expect(text.LEVEL_LABELS).toEqual(['一叩', '再叩', '三叩']);
  });
});
