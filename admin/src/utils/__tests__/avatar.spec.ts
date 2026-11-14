import { describe, expect, it } from 'vitest';
import {
  getUserAvatarDisplay,
  getUserAvatarUrl,
  isUsableAvatarUrl,
  normalizeAvatarUrl
} from '../avatar';

describe('avatar display contract', () => {
  it('uses avatarUrl as the user image source', () => {
    const display = getUserAvatarDisplay({
      _id: 'user-1',
      nickname: '喜娟',
      avatar: '🦁',
      avatarUrl: 'https://example.com/avatar.jpg'
    });

    expect(display.imageUrl).toBe('https://example.com/avatar.jpg');
    expect(display.text).toBe('喜娟');
    expect(getUserAvatarUrl({ avatarUrl: 'https://example.com/avatar.jpg' })).toBe(
      'https://example.com/avatar.jpg'
    );
  });

  it('uses the last two display-name characters as fallback', () => {
    expect(getUserAvatarDisplay({ nickname: '喜娟', avatar: '🦁' }).text).toBe('喜娟');
    expect(getUserAvatarDisplay({ nickname: '喜娟' }).text).toBe('喜娟');
  });

  it('does not treat a user avatar emoji as an image URL', () => {
    expect(isUsableAvatarUrl('🦁')).toBe(false);
    expect(normalizeAvatarUrl('🦁')).toBe('');
    expect(getUserAvatarDisplay({ nickname: '喜娟', avatar: '🌿', avatarUrl: '🦁' }).text).toBe('喜娟');
  });

  it('accepts explicit admin image URLs and stable fallback colors', () => {
    const first = getUserAvatarDisplay(
      { name: '管理员' },
      { imageUrl: '/uploads/admin/avatar.png', userId: 'admin-1' }
    );
    const second = getUserAvatarDisplay({ name: '管理员' }, { userId: 'admin-1' });
    expect(first.imageUrl).toBe('/uploads/admin/avatar.png');
    expect(first.color).toBe(second.color);
  });
});
