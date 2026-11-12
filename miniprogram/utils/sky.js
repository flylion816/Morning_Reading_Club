// 首页天空：按当前时间算出太阳或月亮在弧线上的位置和样子。纯函数，便于单测。
//
// 05:00 太阳在最左端露半个头 → 12:00 正中 → 18:00 在最右端落下半个；
// 18:00 月亮从最左端升起 → 24:00 走到右侧；00:00–05:00 月亮停在最右端。
//
// 弧线是一段圆弧（弦长 600rpx、拱高 76rpx），所以位置用「绕圆心转多少度」表示，
// 页面上只要给一根摆臂设 rotate 就能让天体沿着弧线走。
const ARC_HALF_ANGLE = 28.43; // asin(300 / 630)，弧线一端到正中的角度
const MOON_REST_PROGRESS = 0.94; // 后半夜月亮停的位置：靠最右，但整个露在地平线上

const SUN_PHASES = [
  { until: 6.5, phase: 'sunrise' }, // 刚露头，橙红
  { until: 10, phase: 'morning' }, // 金色，柔光
  { until: 14, phase: 'noon' }, // 最亮，有光芒
  { until: 17, phase: 'afternoon' }, // 暖金
  { until: 18, phase: 'sunset' } // 落下去，橙红
];

function toHours(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return ((((input % 1440) + 1440) % 1440)) / 60;
  }
  const date = input instanceof Date && !Number.isNaN(input.getTime()) ? input : new Date();
  return date.getHours() + date.getMinutes() / 60;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * @param {Date|number} [input] Date，或一天中的分钟数（0–1439）；缺省为当前时间
 * @returns {{ body: 'sun'|'moon', phase: string, progress: number, angle: number, startAngle: number }}
 */
function getSkyState(input) {
  const hours = toHours(input);
  let body;
  let phase;
  let progress;

  if (hours >= 5 && hours < 18) {
    body = 'sun';
    // 5 点到 12 点走前半程，12 点到 18 点走后半程，保证正午在正中
    progress = hours < 12 ? ((hours - 5) / 7) * 0.5 : 0.5 + ((hours - 12) / 6) * 0.5;
    phase = SUN_PHASES.find(item => hours < item.until).phase;
  } else if (hours >= 18) {
    body = 'moon';
    progress = ((hours - 18) / 6) * MOON_REST_PROGRESS;
    phase = hours < 20.5 ? 'moon-crescent' : 'moon-gibbous';
  } else {
    body = 'moon';
    progress = MOON_REST_PROGRESS;
    phase = 'moon-late';
  }

  return {
    body,
    phase,
    progress: round(progress, 3),
    angle: round(-ARC_HALF_ANGLE + progress * ARC_HALF_ANGLE * 2),
    startAngle: -ARC_HALF_ANGLE
  };
}

module.exports = { getSkyState, ARC_HALF_ANGLE, MOON_REST_PROGRESS };
