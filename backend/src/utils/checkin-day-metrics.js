/**
 * 打卡天数口径：按东八区自然日去重，纯函数，不依赖服务器时区。
 */
const DEFAULT_TZ_OFFSET_MINUTES = 480;
const DAY_MS = 24 * 60 * 60 * 1000;

function toDayKey(date, tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES) {
  const time = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (Number.isNaN(time)) return null;
  return new Date(time + tzOffsetMinutes * 60 * 1000).toISOString().slice(0, 10);
}

function dayKeyToIndex(dayKey) {
  return Math.round(Date.parse(`${dayKey}T00:00:00Z`) / DAY_MS);
}

function computeDayMetrics(dates, now = new Date(), tzOffsetMinutes = DEFAULT_TZ_OFFSET_MINUTES) {
  const keySet = new Set();
  (dates || []).forEach(date => {
    const key = toDayKey(date, tzOffsetMinutes);
    if (key) keySet.add(key);
  });
  const dayKeys = Array.from(keySet).sort();
  const indexes = dayKeys.map(dayKeyToIndex);

  let maxStreak = 0;
  let run = 0;
  indexes.forEach((index, i) => {
    run = i > 0 && index - indexes[i - 1] === 1 ? run + 1 : 1;
    if (run > maxStreak) maxStreak = run;
  });

  let currentStreak = 0;
  if (indexes.length > 0) {
    const todayIndex = dayKeyToIndex(toDayKey(now, tzOffsetMinutes));
    const last = indexes[indexes.length - 1];
    if (last === todayIndex || last === todayIndex - 1) {
      currentStreak = 1;
      for (let i = indexes.length - 1; i > 0 && indexes[i] - indexes[i - 1] === 1; i--) {
        currentStreak++;
      }
    }
  }

  return { dayKeys, totalDays: dayKeys.length, currentStreak, maxStreak };
}

module.exports = { toDayKey, computeDayMetrics, DEFAULT_TZ_OFFSET_MINUTES };
