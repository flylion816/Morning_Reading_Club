const { richTextHtmlToPlainText } = require('./rich-text');
const { truncateText } = require('./notification-links');

const clean = value => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
const genericTitle = title => !title || /^(小凡看见|学习反馈|看见)$/.test(title);

// 提供能区分不同篇目的期次、课次和标题。正文摘要只用于读取旧通知时临时展示。
function formatInsightNotificationLabel(insight, { includePreview = false } = {}) {
  if (!insight) return '';

  const section = insight.sectionId && typeof insight.sectionId === 'object' ? insight.sectionId : {};
  const period = insight.periodId && typeof insight.periodId === 'object' ? insight.periodId : {};
  const periodName = clean(insight.periodName) || clean(period.name) || clean(period.title);
  const ownTitle = clean(insight.title);
  const title = genericTitle(ownTitle) ? clean(section.title) : ownTitle;
  const specificTitle = genericTitle(title) ? '' : title;
  const day = section.day ?? insight.day;
  const number = Number(day);
  const hasDay = /第\s*[零〇一二两三四五六七八九十百\d]+\s*[天课日]|day\s*\d+/i.test(specificTitle);
  const dayLabel = day !== null && day !== undefined && day !== '' && Number.isInteger(number) && number >= 0 && !hasDay
    ? `第${number === 0 ? 1 : number}课`
    : '';
  const parts = [periodName, dayLabel, specificTitle].filter(Boolean);

  if (includePreview && !specificTitle && !dayLabel) {
    const preview = truncateText(richTextHtmlToPlainText(insight.summary || insight.content || ''), 32);
    if (preview) parts.push(preview);
  }

  return truncateText(parts.join(' · '), 100);
}

module.exports = { formatInsightNotificationLabel };
