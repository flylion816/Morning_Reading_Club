const { getSkyState, ARC_HALF_ANGLE, MOON_REST_PROGRESS } = require('../../utils/sky');

const at = (h, m = 0) => getSkyState(h * 60 + m);

describe('首页天空：太阳和月亮的位置', () => {
  test('5 点太阳在最左端，12 点在正中，快到 18 点在最右端', () => {
    expect(at(5)).toMatchObject({ body: 'sun', phase: 'sunrise', progress: 0, angle: -ARC_HALF_ANGLE });
    expect(at(12)).toMatchObject({ body: 'sun', phase: 'noon', progress: 0.5, angle: 0 });
    const last = at(17, 59);
    expect(last.body).toBe('sun');
    expect(last.phase).toBe('sunset');
    expect(last.progress).toBeGreaterThan(0.99);
  });

  test('太阳一天里依次是日出、上午、正午、下午、日落', () => {
    expect([at(6).phase, at(8).phase, at(11).phase, at(15).phase, at(17, 30).phase])
      .toEqual(['sunrise', 'morning', 'noon', 'afternoon', 'sunset']);
  });

  test('18 点换成月亮，从最左端升起，越晚越靠右', () => {
    expect(at(18)).toMatchObject({ body: 'moon', phase: 'moon-crescent', progress: 0 });
    expect(at(21).phase).toBe('moon-gibbous');
    expect(at(23).progress).toBeGreaterThan(at(20).progress);
  });

  test('0 点到 5 点之前，月亮一直停在最右端', () => {
    [0, 1, 3, 4.98].forEach(h => {
      expect(getSkyState(Math.floor(h * 60))).toMatchObject({ body: 'moon', phase: 'moon-late', progress: MOON_REST_PROGRESS });
    });
  });

  test('进场动画总是从最左端开始', () => {
    expect(at(14).startAngle).toBe(-ARC_HALF_ANGLE);
    expect(at(2).startAngle).toBe(-ARC_HALF_ANGLE);
  });

  test('也接受 Date', () => {
    expect(getSkyState(new Date(2026, 10, 12, 12, 0)).phase).toBe('noon');
  });
});
