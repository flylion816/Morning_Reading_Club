const AVATAR_COLORS = [
  'var(--admin-primary, #5b7f4a)',
  '#789b86',
  '#bf8b63',
  '#8f87a6',
  '#6f9e9a',
  '#b97870',
  '#b49459',
  '#657f70'
];

export const DEFAULT_AVATAR_TEXT = '用';

export interface AvatarUserLike {
  _id?: string | null;
  id?: string | null;
  userId?: string | null;
  nickname?: string | null;
  name?: string | null;
  userName?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  avatarUrl?: string | null;
}

export interface AvatarDisplay {
  userId: string;
  imageUrl: string;
  text: string;
  color: string;
  hasImage: boolean;
}

export function isUsableAvatarUrl(value?: string | null): boolean {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  return /^(?:https?:\/\/|blob:|data:image\/|\/)/i.test(normalized);
}

export function normalizeAvatarUrl(value?: string | null): string {
  const normalized = String(value || '').trim();
  return isUsableAvatarUrl(normalized) ? normalized : '';
}

export function getAvatarColorByUserId(userId?: string | null): string {
  if (!userId) return AVATAR_COLORS[0] as string;

  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
  }

  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] as string;
}

export function getLastTextChar(value?: string | null, fallback = '用'): string {
  const chars = Array.from(String(value || '').trim());
  return chars.length > 0 ? (chars[chars.length - 1] as string) : fallback;
}

export function getUserAvatarUrl(user?: { avatarUrl?: string | null } | null): string {
  return normalizeAvatarUrl(user?.avatarUrl);
}

export function getUserAvatarDisplay(
  user?: AvatarUserLike | null,
  options: {
    imageUrl?: string | null;
    userId?: string | null;
    name?: string | null;
    fallbackText?: string;
  } = {}
): AvatarDisplay {
  const source = user || {};
  const userId = String(options.userId || source._id || source.id || source.userId || '');
  const name = String(
    options.name || source.nickname || source.name || source.userName || source.displayName || ''
  ).trim();
  const imageUrl = normalizeAvatarUrl(options.imageUrl ?? source.avatarUrl);
  const avatarValue = String(source.avatar || '').trim();
  const fallbackText = options.fallbackText || DEFAULT_AVATAR_TEXT;
  const text = avatarValue && !isUsableAvatarUrl(avatarValue)
    ? avatarValue
    : getLastTextChar(name, fallbackText);

  return {
    userId,
    imageUrl,
    text: text || fallbackText,
    color: getAvatarColorByUserId(userId || name),
    hasImage: Boolean(imageUrl)
  };
}
