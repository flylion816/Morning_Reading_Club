const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('core journey design system', () => {
  test('provides shared tokens and interaction primitives', () => {
    const globalStyles = read('miniprogram/app.wxss');

    [
      '--app-radius-md',
      '--app-space-lg',
      '--app-font-display',
      '--app-success',
      '--app-danger',
      '--app-disabled',
      '.app-card',
      '.app-chip',
      '.app-empty',
      '.app-error',
      '.app-btn-primary',
      '.app-skeleton',
      '.app-safe-bottom',
      '@keyframes appSoftEnter'
    ].forEach(token => {
      expect(globalStyles).toContain(token);
    });
  });

  test.each([
    ['index', 'miniprogram/pages/index/index.wxss'],
    ['periods', 'miniprogram/pages/periods/periods.wxss'],
    ['profile', 'miniprogram/pages/profile/profile.wxss'],
    ['course-detail', 'miniprogram/pages/course-detail/course-detail.wxss'],
    ['reading-mode', 'miniprogram/pages/reading-mode/reading-mode.wxss'],
    ['enrollment', 'miniprogram/pages/enrollment/enrollment.wxss'],
    ['payment', 'miniprogram/pages/payment/payment.wxss']
  ])('%s keeps balanced WXSS and core-journey polish', (_name, file) => {
    const styles = read(file);
    let depth = 0;
    for (const char of styles) {
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
    expect(styles).toContain('Version 1 core-journey polish');
    expect(styles).not.toContain('rpxpx');
  });

  test('long forms and payment actions respect the bottom safe area', () => {
    const enrollment = read('miniprogram/pages/enrollment/enrollment.wxss');
    const payment = read('miniprogram/pages/payment/payment.wxss');

    expect(enrollment).toContain('.step-actions');
    expect(enrollment).toContain('position: fixed');
    expect(enrollment).toContain('env(safe-area-inset-bottom)');
    expect(payment).toContain('.payment-actions');
    expect(payment).toContain('position: fixed');
    expect(payment).toContain('env(safe-area-inset-bottom)');
  });

  test('profile uses grouped titles instead of mixed emoji icons', () => {
    const markup = read('miniprogram/pages/profile/profile.wxml');
    const styles = read('miniprogram/pages/profile/profile.wxss');

    ['📱', '📝', '📨', '⏰', '📅', '📔', '📄', '🎫', '🧭', '📈', '🔒', '📜']
      .forEach(emoji => expect(markup).not.toContain(emoji));
    expect(markup).not.toContain('cell-icon');
    ['账号', '消息', '我的内容', '管理', '协议'].forEach(title => {
      expect(markup).toContain(`>${title}</view>`);
    });
    expect(styles).toContain('.group-title');
  });
});
