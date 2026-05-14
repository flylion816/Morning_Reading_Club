const AVATAR_COLORS = [
  '#4a90e2',
  '#7ed321',
  '#f5a623',
  '#bd10e0',
  '#50e3c2',
  '#d0021b',
  '#f8e71c',
  '#417505'
];

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
  return user?.avatarUrl || '';
}
