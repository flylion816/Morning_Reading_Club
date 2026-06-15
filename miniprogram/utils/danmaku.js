const WECHAT_EMOJI_MAP = {
  '[微笑]': '🙂',
  '[撇嘴]': '😕',
  '[色]': '😍',
  '[发呆]': '😳',
  '[得意]': '😎',
  '[流泪]': '😢',
  '[害羞]': '😊',
  '[闭嘴]': '🤐',
  '[睡]': '😴',
  '[大哭]': '😭',
  '[尴尬]': '😅',
  '[发怒]': '😡',
  '[调皮]': '😜',
  '[呲牙]': '😁',
  '[惊讶]': '😮',
  '[难过]': '😞',
  '[酷]': '😎',
  '[冷汗]': '😓',
  '[抓狂]': '😫',
  '[吐]': '🤮',
  '[偷笑]': '🤭',
  '[可爱]': '😊',
  '[白眼]': '🙄',
  '[傲慢]': '😤',
  '[饥饿]': '😋',
  '[困]': '😪',
  '[惊恐]': '😱',
  '[流汗]': '😅',
  '[憨笑]': '😄',
  '[悠闲]': '😌',
  '[奋斗]': '💪',
  '[咒骂]': '😤',
  '[疑问]': '❓',
  '[嘘]': '🤫',
  '[晕]': '😵',
  '[衰]': '😞',
  '[敲打]': '👊',
  '[再见]': '👋',
  '[擦汗]': '😅',
  '[抠鼻]': '🤨',
  '[鼓掌]': '👏',
  '[糗大了]': '😳',
  '[坏笑]': '😏',
  '[左哼哼]': '😤',
  '[右哼哼]': '😤',
  '[哈欠]': '🥱',
  '[鄙视]': '😒',
  '[委屈]': '🥺',
  '[快哭了]': '😢',
  '[阴险]': '😏',
  '[亲亲]': '😘',
  '[吓]': '😱',
  '[可怜]': '🥺',
  '[菜刀]': '🔪',
  '[西瓜]': '🍉',
  '[啤酒]': '🍺',
  '[篮球]': '🏀',
  '[乒乓]': '🏓',
  '[咖啡]': '☕',
  '[饭]': '🍚',
  '[玫瑰]': '🌹',
  '[凋谢]': '🥀',
  '[爱心]': '❤️',
  '[心碎]': '💔',
  '[蛋糕]': '🎂',
  '[闪电]': '⚡',
  '[炸弹]': '💣',
  '[刀]': '🔪',
  '[足球]': '⚽',
  '[瓢虫]': '🐞',
  '[便便]': '💩',
  '[月亮]': '🌙',
  '[太阳]': '☀️',
  '[礼物]': '🎁',
  '[拥抱]': '🤗',
  '[强]': '👍',
  '[弱]': '👎',
  '[握手]': '🤝',
  '[胜利]': '✌️',
  '[抱拳]': '🙏',
  '[勾引]': '☝️',
  '[拳头]': '✊',
  '[差劲]': '👎',
  '[爱你]': '🤟',
  '[NO]': '🙅',
  '[OK]': '👌',
  '[加油]': '💪',
  '[嘿哈]': '😄',
  '[捂脸]': '🤦',
  '[奸笑]': '😏',
  '[机智]': '😏',
  '[皱眉]': '😟',
  '[耶]': '✌️',
  '[吃瓜]': '🍉',
  '[汗]': '😓',
  '[天啊]': '😱',
  '[Emm]': '😶',
  '[社会社会]': '🤝',
  '[旺柴]': '🐶',
  '[好的]': '👌',
  '[打脸]': '🤦',
  '[哇]': '😮',
  '[翻白眼]': '🙄',
  '[666]': '👍',
  '[让我看看]': '👀',
  '[叹气]': '😮‍💨',
  '[苦涩]': '🥲',
  '[裂开]': '🫠',
  '[嘴唇]': '💋',
  '[加油加油]': '💪',
  '[庆祝]': '🎉',
  '[礼花]': '🎉',
  '[烟花]': '🎆',
  '[爆竹]': '🧨',
  '[福]': '🧧',
  '[红包]': '🧧',
  '[發]': '🧧',
  '[发]': '🧧',
  '[蜡烛]': '🕯️',
  '[跳跳]': '💃',
  '[发抖]': '😖',
  '[转圈]': '😵‍💫'
};

function normalizeDanmakuContent(content) {
  if (typeof content !== 'string') return '';
  return content.replace(/\[[^\[\]\s]{1,8}\]/g, token => WECHAT_EMOJI_MAP[token] || token);
}

function countDanmakuChars(content) {
  if (typeof content !== 'string') return 0;
  return splitDanmakuChars(content).length;
}

function truncateDanmakuContent(content, maxLength = 60) {
  if (typeof content !== 'string') return '';
  return splitDanmakuChars(content).slice(0, maxLength).join('');
}

function splitDanmakuChars(content) {
  if (typeof content !== 'string') return [];
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('zh-Hans', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(content), item => item.segment);
  }
  return Array.from(content);
}

module.exports = {
  WECHAT_EMOJI_MAP,
  normalizeDanmakuContent,
  countDanmakuChars,
  truncateDanmakuContent,
  splitDanmakuChars
};
