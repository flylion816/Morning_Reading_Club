const ZERO_BASED = 0;
const ONE_BASED = 1;

function getLessonNumberingBase(days = []) {
  const validDays = (Array.isArray(days) ? days : [days])
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value >= 0);
  return validDays.includes(0) || validDays.length === 0
    ? ZERO_BASED
    : ONE_BASED;
}

function getLessonNumber(day, numberingBase = null) {
  const number = Number(day);
  if (!Number.isFinite(number) || number < 0) return 1;

  const base = numberingBase === ZERO_BASED || numberingBase === ONE_BASED
    ? numberingBase
    : (number === 0 ? ZERO_BASED : ONE_BASED);
  return base === ZERO_BASED ? number + 1 : number;
}

function formatLessonLabel(day, numberingBase = null) {
  const lessonNumber = getLessonNumber(day, numberingBase);
  return `第 ${String(lessonNumber).padStart(2, '0')} 课`;
}

function formatShortLessonLabel(day, numberingBase = null) {
  return `第${getLessonNumber(day, numberingBase)}课`;
}

module.exports = {
  ZERO_BASED,
  ONE_BASED,
  getLessonNumberingBase,
  getLessonNumber,
  formatLessonLabel,
  formatShortLessonLabel
};
