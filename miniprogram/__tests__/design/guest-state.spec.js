const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

function extractBlock(source, startMark, endMark) {
  const start = source.indexOf(startMark);
  const end = source.indexOf(endMark, start);
  if (start === -1 || end === -1) return '';
  return source.slice(start, end);
}

describe('logged-out state design', () => {
  test('keeps the profile preview focused on personal learning records', () => {
    const markup = read('miniprogram/pages/profile/profile.wxml');
    const guestBlock = extractBlock(
      markup,
      '<!-- 未登录状态 -->',
      '<!-- 加载状态 -->'
    );

    expect(guestBlock).toContain('你的学习记录');
    expect(guestBlock).toContain('学习进度');
    expect(guestBlock).toContain('先看课程');
    expect(guestBlock).not.toMatch(/被看见|小凡|好友|评论|社区|互动|弹幕|同行|分享/);
  });

  test('keeps the home guest pitch compact and course-first', () => {
    const markup = read('miniprogram/pages/index/index.wxml');
    const styles = read('miniprogram/pages/index/index.wxss');
    const guestBlock = extractBlock(
      markup,
      '<!-- 未登录状态 - 应用介绍页 -->',
      '<!-- 编辑个人信息模态框 -->'
    );

    expect(guestBlock).toContain('浏览课程');
    expect(guestBlock).toContain('登录看数据');
    expect(guestBlock).not.toMatch(/被看见|小凡|好友|评论|社区|互动|弹幕|同行|分享/);
    expect(styles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
  });

  test('explains the period path without exposing community features', () => {
    const markup = read('miniprogram/pages/period-detail/period-detail.wxml');
    const guestPathBlock = extractBlock(
      markup,
      'guest-path-card',
      'outline-card'
    );

    expect(guestPathBlock).toContain('先看大纲');
    expect(guestPathBlock).toContain('保存进度');
    expect(guestPathBlock).not.toMatch(/被看见|小凡|好友|评论|社区|互动|弹幕|同行|分享/);
  });
});
