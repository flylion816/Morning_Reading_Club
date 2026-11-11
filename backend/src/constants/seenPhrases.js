// 看见卡的预设短句（第一版不接受自由输入）。小程序端 miniprogram/utils/seen-phrases.js 保持同一份键值。
const SEEN_PHRASES = {
  persist: '我看见你的坚持',
  touched: '这句话说到我心里了',
  thanks: '谢谢你愿意说出来',
  metoo: '我也是这样'
};

const SEEN_PHRASE_KEYS = Object.keys(SEEN_PHRASES);

function isValidSeenPhrase(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(SEEN_PHRASES, key);
}

module.exports = { SEEN_PHRASES, SEEN_PHRASE_KEYS, isValidSeenPhrase };
