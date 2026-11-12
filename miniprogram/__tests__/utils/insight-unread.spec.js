const { isInsightUnread } = require('../../utils/insight-unread');

describe('小凡的信未读判断', () => {
  const base = { targetUserId: 'me', createdAt: '2026-11-13T06:00:00+08:00', readAt: null };

  test('写给我、还没打开过、而且是开始记录已读之后的信，才算未读', () => {
    expect(isInsightUnread(base, 'me')).toBe(true);
    expect(isInsightUnread({ ...base, targetUserId: { _id: 'me' } }, 'me')).toBe(true);
  });

  test('读过的、写给别人的、未登录的都不算未读', () => {
    expect(isInsightUnread({ ...base, readAt: '2026-11-13T07:00:00+08:00' }, 'me')).toBe(false);
    expect(isInsightUnread({ ...base, targetUserId: 'other' }, 'me')).toBe(false);
    expect(isInsightUnread(base, '')).toBe(false);
    expect(isInsightUnread(null, 'me')).toBe(false);
  });

  test('开始记录已读之前的老信一律当作读过', () => {
    expect(isInsightUnread({ ...base, createdAt: '2026-10-11T06:00:00+08:00' }, 'me')).toBe(false);
  });

  test('没有收信人时以创建者为准', () => {
    expect(isInsightUnread({ userId: 'me', createdAt: base.createdAt }, 'me')).toBe(true);
  });
});
