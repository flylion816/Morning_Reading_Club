const { MIN_RPX, MAX_RPX, SLACK_RPX, HEADING_EXTRA_RPX, countHeadings, fitEditorHeight } = require('../../utils/editor-height');

describe('editor-height 编辑器高度', () => {
  test('量出来的 px 按屏幕宽度换成 rpx，再加一点底部空白', () => {
    // 屏幕 375px 宽：1px = 2rpx
    expect(fitEditorHeight(600, 375)).toBe(600 * 2 + SLACK_RPX);
    // 屏幕 390px 宽：1px = 750/390 rpx，向上取整
    expect(fitEditorHeight(600, 390)).toBe(Math.ceil((600 * 750) / 390 + SLACK_RPX));
    expect(Number.isInteger(fitEditorHeight(601, 393))).toBe(true);
  });

  test('内容再少也不比最小高度矮', () => {
    expect(MIN_RPX).toBe(360);
    expect(fitEditorHeight(40, 375)).toBe(MIN_RPX);
    expect(fitEditorHeight(100, 375)).toBe(MIN_RPX); // 200 + 48 = 248，不到 360
  });

  test('量不出来（没有数、不是正数、屏幕宽度不对）就用最小高度', () => {
    [undefined, null, 0, -5, NaN, 'x'].forEach(value => expect(fitEditorHeight(value, 375)).toBe(MIN_RPX));
    [undefined, 0, -1, NaN].forEach(width => expect(fitEditorHeight(500, width)).toBe(MIN_RPX));
  });

  test('每个标题多补一点高度；负数、不是数的标题数当作没有', () => {
    expect(fitEditorHeight(600, 375, { headings: 2 })).toBe(600 * 2 + SLACK_RPX + 2 * HEADING_EXTRA_RPX);
    expect(fitEditorHeight(600, 375, { headings: -3 })).toBe(600 * 2 + SLACK_RPX);
    expect(fitEditorHeight(600, 375, { headings: 'a' })).toBe(600 * 2 + SLACK_RPX);
  });

  test('有一道上限，异常数据不会把页面撑得离谱；上下限也可以传进来', () => {
    expect(fitEditorHeight(1e6, 375)).toBe(MAX_RPX);
    expect(fitEditorHeight(600, 375, { max: 900 })).toBe(900);
    expect(fitEditorHeight(10, 375, { min: 500 })).toBe(500);
  });

  test('3000 字的上限（每行最少几个字、每个字一行也只是 3000 行）远到不了安全线以外的正常情况', () => {
    // 正常的长文：约 140 行 × 54rpx ≈ 7600rpx，在安全线之内
    expect(fitEditorHeight(3800, 375)).toBeLessThanOrEqual(MAX_RPX);
  });

  test('数标题：h1–h6 都算，不把 hr、header 这样的标签算进去', () => {
    expect(countHeadings('<h2>一</h2><p>x</p><h3>二</h3><H1>三</H1>')).toBe(3);
    expect(countHeadings('<hr><header>x</header><p>h2</p>')).toBe(0);
    expect(countHeadings('')).toBe(0);
    expect(countHeadings(undefined)).toBe(0);
  });
});
