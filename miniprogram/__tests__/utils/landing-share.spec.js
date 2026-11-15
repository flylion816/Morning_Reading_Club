const {
  parseLandingOptions,
  buildLandingPath,
  buildLandingQuery,
  describeDate,
  formatContactBy,
  isValidPhone
} = require('../../utils/landing-share');

const INVITER = '507f1f77bcf86cd799439011';

describe('landing-share', () => {
  describe('parseLandingOptions', () => {
    test('读取转发卡片带来的参数', () => {
      const parsed = parseLandingOptions({
        inviterId: INVITER,
        src: 'quote_card',
        date: '2026-11-14',
        quote: encodeURIComponent('先理解，再被理解'),
        source: encodeURIComponent('连接之力'),
        day: '1',
        note: encodeURIComponent('每天读十分钟')
      });
      expect(parsed).toEqual({
        inviterId: INVITER,
        sourceType: 'quote_card',
        dateStr: '2026-11-14',
        quote: '先理解，再被理解',
        lessonName: '连接之力',
        dayNumber: 1,
        note: '每天读十分钟'
      });
    });

    test('读取小程序码 scene：分享人和来源', () => {
      const scene = encodeURIComponent(`i=${INVITER}&s=d`);
      const parsed = parseLandingOptions({ scene });
      expect(parsed.inviterId).toBe(INVITER);
      expect(parsed.sourceType).toBe('daily_card');
    });

    test('不是合法 id 的分享人被丢弃，避免被拿来塞内容', () => {
      expect(parseLandingOptions({ inviterId: '<script>' }).inviterId).toBe('');
      expect(parseLandingOptions({ inviterId: 'abc' }).inviterId).toBe('');
    });

    test('缺省参数不报错，来源回退为 other', () => {
      const parsed = parseLandingOptions();
      expect(parsed.sourceType).toBe('other');
      expect(parsed.quote).toBe('');
      expect(parsed.dayNumber).toBe(0);
    });

    test('不合法的日期忽略，过长的金句和感想被截断', () => {
      const parsed = parseLandingOptions({
        date: '2026/11/14',
        quote: '句'.repeat(200),
        note: '想'.repeat(200)
      });
      expect(parsed.dateStr).toBe('');
      expect(Array.from(parsed.quote)).toHaveLength(60);
      expect(Array.from(parsed.note)).toHaveLength(40);
    });

    test('坏的百分号编码不会抛错', () => {
      expect(() => parseLandingOptions({ quote: '%E0%A4%A' })).not.toThrow();
    });
  });

  describe('buildLandingPath', () => {
    test('生成的路径能被 parseLandingOptions 还原', () => {
      const path = buildLandingPath({
        inviterId: INVITER,
        sourceType: 'daily_card',
        dateStr: '2026-11-14',
        lessonName: '连接之力',
        dayNumber: 3,
        quote: '先理解，再被理解',
        note: '每天读十分钟'
      });
      expect(path.startsWith('/pages/landing/landing?')).toBe(true);

      const options = {};
      path
        .split('?')[1]
        .split('&')
        .forEach(pair => {
          const [k, v] = pair.split('=');
          options[k] = v;
        });
      const parsed = parseLandingOptions(options);
      expect(parsed.inviterId).toBe(INVITER);
      expect(parsed.quote).toBe('先理解，再被理解');
      expect(parsed.note).toBe('每天读十分钟');
      expect(parsed.dayNumber).toBe(3);
    });

    test('太长时先砍感想、再砍金句，路径始终在预算内', () => {
      const path = buildLandingPath({
        inviterId: INVITER,
        sourceType: 'daily_card',
        dateStr: '2026-11-14',
        lessonName: '课'.repeat(30),
        dayNumber: 3,
        quote: '句'.repeat(60),
        note: '想'.repeat(40)
      });
      expect(path.length).toBeLessThanOrEqual(900);
      expect(path).toContain('inviterId=');
    });

    test('没有分享人时不写 inviterId', () => {
      expect(buildLandingPath({ sourceType: 'daily_card' })).not.toContain('inviterId');
    });
  });

  describe('describeDate', () => {
    test('给出日期、星期和节气', () => {
      const info = describeDate('2026-11-14');
      expect(info.dayNumber).toBe('14');
      expect(info.dateLine).toBe('2026 年 11 月 · 周六');
      expect(info.termText).toBeTruthy();
    });

    test('非法日期回退到今天，不抛错', () => {
      expect(() => describeDate('nope')).not.toThrow();
    });
  });

  describe('其他', () => {
    test('formatContactBy 按上海时区取日期', () => {
      // 2026-11-17 18:00 UTC 已经是上海 11-18 02:00
      expect(formatContactBy('2026-11-17T18:00:00Z')).toBe('11 月 18 日');
      expect(formatContactBy('bad')).toBe('');
    });

    test('isValidPhone', () => {
      expect(isValidPhone('13800000000')).toBe(true);
      expect(isValidPhone('1380000000')).toBe(false);
      expect(isValidPhone('23800000000')).toBe(false);
      expect(isValidPhone('')).toBe(false);
    });
  });

  test('朋友圈分享的参数：只取问号后面的部分，和路径里的参数一致', () => {
    const params = { inviterId: '507f1f77bcf86cd799439011', sourceType: 'daily_card', dateStr: '2026-11-14', quote: '由内而外' };
    const path = buildLandingPath(params);
    expect(buildLandingQuery(params)).toBe(path.split('?')[1]);
    expect(buildLandingQuery({})).toBe('src=daily_card');
  });
});
