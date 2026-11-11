const {
  wrapText,
  describeDate,
  computeDailyCardLayout,
  PLACEHOLDER_TEXT
} = require('../../utils/daily-card-layout');

const texts = layout => layout.elements.filter(e => e.type === 'text').map(e => e.text);

describe('daily-card-layout', () => {
  test('wrapText wraps by width and truncates with ellipsis', () => {
    const lines = wrapText('一二三四五六七八九十', 10, 30, 2);
    expect(lines).toEqual(['一二三', '四五…']);
    expect(wrapText('一二三四', 10, 20, 5)).toEqual(['一二', '三四']);
  });

  test('wrapText keeps punctuation off line start', () => {
    expect(wrapText('一二，三', 10, 20, 5)).toEqual(['一二，', '三']);
  });

  test('describeDate gives weekday and term info', () => {
    expect(describeDate('2026-11-07')).toMatchObject({
      dayNumber: '7',
      dateLine: '2026 年 11 月 · 周六',
      termText: '立冬'
    });
    expect(describeDate('2026-11-10').termText).toBe('立冬第 4 天');
  });

  test('all variants render the shared content', () => {
    ['dawn', 'paper', 'blank'].forEach(variant => {
      const layout = computeDailyCardLayout({
        variant,
        quote: '以终为始',
        source: '第 7 天 · 以终为始',
        periodName: '凡人共读第 3 期',
        day: 7,
        note: '今天很安静',
        dateStr: '2026-11-10',
        brandName: '测试营'
      });
      const t = texts(layout);
      expect(t).toContain('10');
      expect(t).toContain('以终为始');
      expect(t).toContain('—— 我想说：今天很安静');
      expect(t).toContain('测试营');
      expect(t).toContain('每天清晨，一起读一页书');
      expect(layout.height).toBeGreaterThanOrEqual(1000);
    });
  });

  test('blank variant hides period line and source; period shown elsewhere', () => {
    const base = { quote: '一句', source: '来源X', periodName: '期次Y', day: 2, dateStr: '2026-11-10' };
    expect(texts(computeDailyCardLayout({ ...base, variant: 'blank' })).join('|')).not.toMatch(/期次Y|来源X/);
    const dawn = texts(computeDailyCardLayout({ ...base, variant: 'dawn' }));
    expect(dawn).toContain('期次Y · 第 2 天');
    expect(dawn).toContain('—— 来源X');
  });

  test('long quote is limited to 6 lines; empty quote uses placeholder only when asked', () => {
    const long = computeDailyCardLayout({ quote: '字'.repeat(120), dateStr: '2026-11-10' });
    expect(long.quoteLines.length).toBe(6);
    expect(long.quoteLines[5].endsWith('…')).toBe(true);
    const preview = computeDailyCardLayout({ dateStr: '2026-11-10', placeholder: true });
    expect(texts(preview)).toContain(PLACEHOLDER_TEXT);
    const exported = computeDailyCardLayout({ dateStr: '2026-11-10' });
    expect(texts(exported)).not.toContain(PLACEHOLDER_TEXT);
  });

  test('omits note and period when absent', () => {
    const t = texts(computeDailyCardLayout({ quote: '一句', dateStr: '2026-11-10' }));
    expect(t.join('|')).not.toMatch(/我想说| · 第/);
  });
});
