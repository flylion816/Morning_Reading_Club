const { getSolarTerm, getLatestSolarTerm } = require('../../utils/solar-terms');

describe('solar-terms', () => {
  test('known term days', () => {
    expect(getSolarTerm('2026-11-07')).toBe('立冬');
    expect(getSolarTerm('2026-12-22')).toBe('冬至');
    expect(getSolarTerm('2027-02-04')).toBe('立春');
    expect(getSolarTerm('2025-02-03')).toBe('立春');
    expect(getSolarTerm('2026-03-20')).toBe('春分');
    expect(getSolarTerm('2026-06-21')).toBe('夏至');
    expect(getSolarTerm('2026-09-23')).toBe('秋分');
  });

  test('non-term days, bad input and unsupported years return empty', () => {
    expect(getSolarTerm('2026-11-08')).toBe('');
    expect(getSolarTerm('2026-02-30')).toBe('');
    expect(getSolarTerm('abc')).toBe('');
    expect(getSolarTerm('2040-11-07')).toBe('');
    expect(getLatestSolarTerm('2040-11-07')).toBeNull();
  });

  test('latest passed term and days since', () => {
    expect(getLatestSolarTerm('2026-11-07')).toEqual({ name: '立冬', date: '2026-11-07', daysSince: 0 });
    expect(getLatestSolarTerm('2026-11-10')).toEqual({ name: '立冬', date: '2026-11-07', daysSince: 3 });
    expect(getLatestSolarTerm('2026-01-02').name).toBe('冬至');
  });
});
