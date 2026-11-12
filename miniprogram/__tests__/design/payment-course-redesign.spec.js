const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('payment and course page redesign', () => {
  test('payment uses a compact receipt hierarchy and typed amount parts', () => {
    const markup = read('miniprogram/pages/payment/payment.wxml');
    const styles = read('miniprogram/pages/payment/payment.wxss');

    expect(markup).toContain('finalAmountParts.integer');
    expect(markup).toContain('finalAmountParts.decimal');
    expect(markup).not.toContain('class="header-icon"');
    expect(markup).not.toContain('ℹ️');
    expect(styles).toContain('font-variant-numeric: tabular-nums');
    expect(styles).toContain('.amount-integer { font-size: 56rpx');
    expect(styles).toContain('.pay-submit {');
  });

  test('course page matches the native thin white back arrow', () => {
    const pageJson = JSON.parse(read('miniprogram/pages/courses/courses.json'));
    const markup = read('miniprogram/pages/courses/courses.wxml');
    const styles = read('miniprogram/pages/courses/courses.wxss');

    expect(pageJson.navigationStyle).toBe('custom');
    expect(markup).toContain('bindtap="handleBack"');
    expect(markup).toContain('style="padding-top: {{statusBarHeight}}px"');
    expect(markup).toContain('class="course-header-title"');
    expect(markup).toContain('class="course-header-date"');
    expect(markup).not.toContain('COURSE PLAN');
    expect(markup).toContain('class="course-back-icon"');
    const backRule = styles.match(/\.course-back\s*\{([\s\S]*?)\}/)?.[1] || '';
    expect(backRule).toContain('background: transparent');
    expect(backRule).toContain('color: #fff');
    expect(backRule).not.toContain('box-shadow');
    expect(styles).toContain('.course-title-group {');
    expect(styles).toContain('text-align: center');
    expect(styles).not.toContain('perspective(20rpx)');
  });

  test('course shortcuts use the shared glyph language instead of emoji', () => {
    const markup = read('miniprogram/pages/courses/courses.wxml');

    ['同行榜', '打卡记录', '同学'].forEach(title => {
      expect(markup).toContain(`>${title}</text>`);
    });
    ['🏆', '📅', '👥'].forEach(emoji => {
      expect(markup).not.toContain(emoji);
    });
    expect(markup).toContain('<view class="quick-icon"><text>榜</text></view>');
    expect(markup).toContain('<view class="quick-icon"><text>记</text></view>');
    expect(markup).toContain('<view class="quick-icon"><text>友</text></view>');
    expect(markup).toContain('bindtap="toggleSearch"');
    expect(markup).toContain('class="course-search-bar" wx:if="{{searchExpanded}}"');
    expect(markup).not.toContain('section-day-number');
  });

  test('empty course list shows only the course empty state', () => {
    const markup = read('miniprogram/pages/courses/courses.wxml');
    const taskEmptyStart = markup.indexOf('wx:if="{{!loading && sections.length === 0}}"');
    const taskEmptyEnd = markup.indexOf('</view>', taskEmptyStart);
    const taskEmpty = markup.slice(taskEmptyStart, taskEmptyEnd);

    expect(taskEmpty).toContain('这一期的课程还在准备中');
    expect(taskEmpty).not.toContain('empty-state-icon');
    expect(markup).toContain('wx:if="{{sections.length > 0 && communityAccessState === \'enabled\'}}"');
    expect(markup).not.toContain('empty-state-icon">📚');
  });
});
