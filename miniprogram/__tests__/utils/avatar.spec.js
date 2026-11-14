const {
  decorateUserAvatar,
  getUserAvatarDisplay,
  isUsableAvatarUrl,
  normalizeAvatarUrl
} = require('../../utils/avatar');

describe('Avatar display contract', () => {
  test('uses avatarUrl as the image source and does not use avatar text as a URL', () => {
    const display = getUserAvatarDisplay({
      _id: 'user-1',
      nickname: '喜娟',
      avatar: '🦁',
      avatarUrl: 'https://example.com/avatar.jpg'
    });

    expect(display.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(display.avatarText).toBe('喜娟');
    expect(display.hasImage).toBe(true);
  });

  test('uses the last two display-name characters for fallback', () => {
    expect(getUserAvatarDisplay({ _id: 'user-2', nickname: '喜娟', avatar: '🦁' }).avatarText).toBe('喜娟');
    expect(getUserAvatarDisplay({ _id: 'user-3', nickname: '喜娟' }).avatarText).toBe('喜娟');
  });

  test('rejects an emoji or text value as an image URL', () => {
    expect(isUsableAvatarUrl('🦁')).toBe(false);
    expect(normalizeAvatarUrl('🦁')).toBe('');
    expect(getUserAvatarDisplay({ nickname: '喜娟', avatarUrl: '🦁', avatar: '🌿' }).avatarText).toBe('喜娟');
  });

  test('accepts uploaded and local image URL forms', () => {
    expect(normalizeAvatarUrl('/uploads/avatars/user.jpg')).toBe('/uploads/avatars/user.jpg');
    expect(normalizeAvatarUrl('wxfile://tmp/avatar.jpg')).toBe('wxfile://tmp/avatar.jpg');
  });

  test('keeps fallback color stable for the same user', () => {
    const first = getUserAvatarDisplay({ _id: 'same-user', nickname: '甲' });
    const second = getUserAvatarDisplay({ _id: 'same-user', nickname: '甲' });
    expect(first.avatarColor).toBe(second.avatarColor);
  });

  test('decorates an existing record without dropping its fields', () => {
    const decorated = decorateUserAvatar({ _id: 'user-4', nickname: '乙', avatar: '🐯', status: 'active' });
    expect(decorated.status).toBe('active');
    expect(decorated.avatarText).toBe('乙');
    expect(decorated.avatarUrl).toBe('');
  });
});
