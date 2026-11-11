/**
 * 看见卡的预设短句。键值与 backend/src/constants/seenPhrases.js 保持一致。
 * 第一版只有预设短句，不接受自由输入。
 */
const SEEN_PHRASES = [
  { key: 'persist', text: '我看见你的坚持', seal: '持' },
  { key: 'touched', text: '这句话说到我心里了', seal: '动' },
  { key: 'thanks', text: '谢谢你愿意说出来', seal: '谢' },
  { key: 'metoo', text: '我也是这样', seal: '同' }
];

const SEEN_PHRASE_MAP = SEEN_PHRASES.reduce((map, item) => {
  map[item.key] = item;
  return map;
}, {});

function getSeenPhrase(key) {
  return Object.prototype.hasOwnProperty.call(SEEN_PHRASE_MAP, key) ? SEEN_PHRASE_MAP[key] : null;
}

function getSeenPhraseText(key) {
  const item = getSeenPhrase(key);
  return item ? item.text : '';
}

function getSeenPhraseSeal(key) {
  const item = getSeenPhrase(key);
  return item ? item.seal : '';
}

module.exports = { SEEN_PHRASES, getSeenPhrase, getSeenPhraseText, getSeenPhraseSeal };
