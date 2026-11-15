const {
  REACTION_OPTIONS,
  markBuddyAvatars,
  markBuddyReplies,
  isMyBuddyCheckin,
  canReactToCheckin
} = require('../../pages/course-detail/buddy-marks');

describe('buddy-marks 读伴标记', () => {
  const avatars = [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }];

  test('点赞头像：读伴排第一并带标记，其余顺序不变', () => {
    const result = markBuddyAvatars(avatars, 'c');
    expect(result.map(i => i.userId)).toEqual(['c', 'a', 'b']);
    expect(result.map(i => i.isBuddy)).toEqual([true, false, false]);
  });

  test('没有读伴或读伴没点赞时，保持原样', () => {
    expect(markBuddyAvatars(avatars, '')).toBe(avatars);
    expect(markBuddyAvatars(avatars, 'z').map(i => i.userId)).toEqual(['a', 'b', 'c']);
    expect(markBuddyAvatars(null, 'c')).toEqual([]);
  });

  test('评论：读伴的评论置顶并带标记，多条读伴评论保持相对顺序', () => {
    const replies = [{ userId: 'x', id: 1 }, { userId: 'c', id: 2 }, { userId: 'y', id: 3 }, { userId: 'c', id: 4 }];
    const result = markBuddyReplies(replies, 'c');
    expect(result.map(i => i.id)).toEqual([2, 4, 1, 3]);
    expect(result.filter(i => i.isBuddy)).toHaveLength(2);
  });

  test('用户 ID 是数字或字符串都能对上', () => {
    expect(markBuddyAvatars([{ userId: 5 }, { userId: 6 }], '6').map(i => i.userId)).toEqual([6, 5]);
  });

  test('只有作者的读伴才算「我的读伴的打卡」，作者本人不算', () => {
    expect(isMyBuddyCheckin({ buddyUserId: 'me', authorId: 'ta' }, 'me')).toBe(true);
    expect(isMyBuddyCheckin({ buddyUserId: 'ta', authorId: 'me' }, 'me')).toBe(false);
    expect(isMyBuddyCheckin({ buddyUserId: '', authorId: 'ta' }, 'me')).toBe(false);
    expect(isMyBuddyCheckin({ buddyUserId: 'me', authorId: 'me' }, 'me')).toBe(false);
  });

  test('已经回应过的不能再回应', () => {
    expect(canReactToCheckin({ buddyUserId: 'me', authorId: 'ta' }, 'me')).toBe(true);
    expect(canReactToCheckin({ buddyUserId: 'me', authorId: 'ta', buddyReaction: { text: 'x' } }, 'me')).toBe(false);
    expect(canReactToCheckin({ buddyUserId: 'other', authorId: 'ta' }, 'me')).toBe(false);
  });

  test('回应只有 4 句预设短句', () => {
    expect(REACTION_OPTIONS.map(o => o.key)).toEqual(['moved', 'slow', 'glad', 'thanks']);
  });
});
