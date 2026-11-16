/**
 * 觉察静室页和觉察详情页共用的文字小工具（同在 joy-notes 分包里）。
 */

const LEVEL_LABELS = ['一叩', '再叩', '三叩'];

// 与服务端 content 的拼法一致：看 / 感 / 身 / 问 / 择。用来复制全文、写进打卡草稿
function composeText(awareness = {}) {
  const lines = [];
  const feelings = awareness.feelings || [];
  const bodyAreas = awareness.bodyAreas || [];
  const asks = awareness.asks || [];
  if (awareness.facts) lines.push(`看：${awareness.facts}`);
  const feeling = [feelings.join('、'), awareness.feelingNote].filter(Boolean).join('。');
  if (feeling) lines.push(`感：${feeling}`);
  if (bodyAreas.length) lines.push(`身：${bodyAreas.join('、')}`);
  asks.forEach(ask => lines.push(`问：${ask.answer}`));
  if (awareness.choice) lines.push(`择：${awareness.choice}`);
  return lines.join('\n');
}

function daypartLabel(date) {
  const hour = date.getHours();
  if (hour < 5) return '深夜';
  if (hour < 9) return '清晨';
  if (hour < 12) return '上午';
  if (hour < 14) return '中午';
  if (hour < 18) return '下午';
  return '晚上';
}

// 11月16日 清晨
function dateWithDaypart(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}月${date.getDate()}日 ${daypartLabel(date)}`;
}

function monthDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

// 分享时署名用：当前用户的昵称，没有或是默认的「微信用户」就叫「书友」
function authorName() {
  try {
    const app = typeof getApp === 'function' ? getApp() : null;
    const user = (app && app.globalData && app.globalData.userInfo) || {};
    const name = String(user.nickname || user.nickName || '').trim();
    return name && name !== '微信用户' ? name : '书友';
  } catch (error) {
    return '书友';
  }
}

module.exports = { LEVEL_LABELS, composeText, daypartLabel, dateWithDaypart, monthDay, authorName };
