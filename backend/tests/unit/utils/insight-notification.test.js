const { expect } = require('chai');
const { formatInsightNotificationLabel } = require('../../../src/utils/insight-notification');

describe('小凡看见通知篇目', () => {
  it('显示期次、课次与标题，标题已有天数时不重复', () => {
    expect(formatInsightNotificationLabel({ periodName: '连接之力', day: 2, title: '积极主动' }))
      .to.equal('连接之力 · 第2课 · 积极主动');
    expect(formatInsightNotificationLabel({ periodName: '连接之力', day: 2, title: '第二天 积极主动' }))
      .to.equal('连接之力 · 第二天 积极主动');
  });

  it('优先使用关联课节补足旧记录，并沿用第零课显示为第一课的规则', () => {
    expect(formatInsightNotificationLabel({
      periodId: { name: '晨读一期' },
      sectionId: { title: '品德成功论', day: 0 },
      title: '小凡看见'
    })).to.equal('晨读一期 · 第1课 · 品德成功论');
  });

  it('只有读取旧记录时才用正文摘要补足缺失的标题', () => {
    const insight = { periodName: '晨读一期', content: '<p>先停下来，再选择回应。</p>' };
    expect(formatInsightNotificationLabel(insight)).to.equal('晨读一期');
    expect(formatInsightNotificationLabel(insight, { includePreview: true }))
      .to.equal('晨读一期 · 先停下来，再选择回应。');
    expect(formatInsightNotificationLabel(null)).to.equal('');
  });
});
