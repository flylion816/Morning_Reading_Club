/**
 * 二十四节气：按太阳视黄经（低精度算法，误差约 15 分钟）推算，日期按东八区。
 * 仅支持 2024–2035 年；节气交接刻离东八区零点太近（误差可能跨日）的日子宁可返回空。
 */

const MIN_YEAR = 2024;
const MAX_YEAR = 2035;
const AMBIGUOUS_SECONDS = 20 * 60;
const DAY_MS = 86400000;
const BJT_OFFSET_MS = 8 * 3600000;

// 太阳黄经 -> 节气名
const TERM_BY_LONGITUDE = {
  0: '春分',
  15: '清明',
  30: '谷雨',
  45: '立夏',
  60: '小满',
  75: '芒种',
  90: '夏至',
  105: '小暑',
  120: '大暑',
  135: '立秋',
  150: '处暑',
  165: '白露',
  180: '秋分',
  195: '寒露',
  210: '霜降',
  225: '立冬',
  240: '小雪',
  255: '大雪',
  270: '冬至',
  285: '小寒',
  300: '大寒',
  315: '立春',
  330: '雨水',
  345: '惊蛰'
};

const rad = deg => (deg * Math.PI) / 180;

function sunApparentLongitude(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = rad(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
    0.000289 * Math.sin(3 * M);
  const omega = rad(125.04 - 1934.136 * T);
  const lon = L0 + C - 0.00569 - 0.00478 * Math.sin(omega);
  return ((lon % 360) + 360) % 360;
}

function termJulianDay(year, longitude) {
  // 黄经 >= 285（小寒到惊蛰）落在当年 3 月 20 日之前，以上一年春分为基准
  const baseYear = longitude >= 285 ? year - 1 : year;
  const marchEquinoxJd = Date.UTC(baseYear, 2, 20) / DAY_MS + 2440587.5;
  let jd = marchEquinoxJd + (longitude / 360) * 365.2422;
  for (let i = 0; i < 6; i += 1) {
    const delta = ((longitude - sunApparentLongitude(jd) + 540) % 360) - 180;
    jd += delta / 0.9856;
  }
  return jd;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

const yearCache = {};

/** 返回某年 24 个节气（按时间排序）：{ name, date: 'YYYY-MM-DD', ambiguous } */
function getTermsOfYear(year) {
  if (yearCache[year]) return yearCache[year];
  const terms = Object.keys(TERM_BY_LONGITUDE).map(key => {
    const longitude = Number(key);
    const ms = (termJulianDay(year, longitude) - 2440587.5) * DAY_MS + BJT_OFFSET_MS;
    const d = new Date(ms);
    const secondsOfDay = d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
    return {
      name: TERM_BY_LONGITUDE[key],
      date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
      ambiguous: secondsOfDay < AMBIGUOUS_SECONDS || secondsOfDay > 86400 - AMBIGUOUS_SECONDS
    };
  });
  terms.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  yearCache[year] = terms;
  return terms;
}

function parseDateKey(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) return null;
  return { y, m, d, utc: utc.getTime() };
}

function isSupportedYear(year) {
  return year >= MIN_YEAR && year <= MAX_YEAR;
}

/** 当天若是节气，返回节气名，否则返回空字符串 */
function getSolarTerm(dateStr) {
  const parsed = parseDateKey(dateStr);
  if (!parsed || !isSupportedYear(parsed.y)) return '';
  const hit = getTermsOfYear(parsed.y).find(term => term.date === dateStr);
  return hit && !hit.ambiguous ? hit.name : '';
}

/** 最近一个已过（含当天）的节气：{ name, date, daysSince }，daysSince 当天为 0；无把握返回 null */
function getLatestSolarTerm(dateStr) {
  const parsed = parseDateKey(dateStr);
  if (!parsed || !isSupportedYear(parsed.y)) return null;
  const candidates = getTermsOfYear(parsed.y - 1).concat(getTermsOfYear(parsed.y));
  let latest = null;
  candidates.forEach(term => {
    if (term.date <= dateStr) latest = term;
  });
  if (!latest || latest.ambiguous) return null;
  const termParsed = parseDateKey(latest.date);
  return {
    name: latest.name,
    date: latest.date,
    daysSince: Math.round((parsed.utc - termParsed.utc) / DAY_MS)
  };
}

module.exports = {
  MIN_YEAR,
  MAX_YEAR,
  parseDateKey,
  getSolarTerm,
  getLatestSolarTerm
};
