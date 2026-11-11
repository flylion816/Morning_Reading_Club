/**
 * 打卡「心情天气」口径（集中定义，上线时只需调整 MOOD_VALID_SINCE）。
 *
 * 取值与展示含义：
 *   happy 晴 / calm 多云 / thoughtful 微风 / inspired 朝霞 / low 小雨 / other 雾
 */
const CHECKIN_MOODS = ['happy', 'calm', 'thoughtful', 'inspired', 'low', 'other'];

// 小程序此前把 mood 一律写死为 'happy'，早于该时间的打卡心情不可信，读出时视为未记录。
const MOOD_VALID_SINCE = '2026-11-11T00:00:00+08:00';
const MOOD_VALID_SINCE_MS = new Date(MOOD_VALID_SINCE).getTime();

function isValidMood(value) {
  return typeof value === 'string' && CHECKIN_MOODS.includes(value);
}

function isMoodTrusted(checkinDate) {
  const time = checkinDate ? new Date(checkinDate).getTime() : NaN;
  return !Number.isNaN(time) && time >= MOOD_VALID_SINCE_MS;
}

/** 读出某条打卡的可信心情，不可信或未记录返回 null。 */
function readTrustedMood(checkin) {
  if (!checkin || !isValidMood(checkin.mood)) return null;
  return isMoodTrusted(checkin.checkinDate || checkin.createdAt) ? checkin.mood : null;
}

/** 本人可见：返回带可信 mood 的普通对象（不修改入参）。 */
function withTrustedMood(checkin) {
  if (!checkin) return checkin;
  const plain = typeof checkin.toObject === 'function' ? checkin.toObject() : { ...checkin };
  plain.mood = readTrustedMood(plain);
  return plain;
}

module.exports = {
  CHECKIN_MOODS,
  MOOD_VALID_SINCE,
  isValidMood,
  isMoodTrusted,
  readTrustedMood,
  withTrustedMood
};
