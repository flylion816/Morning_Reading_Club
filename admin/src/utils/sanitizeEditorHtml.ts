import createDOMPurify from 'dompurify';

function fallbackSanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|\s*javascript:[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}

export function sanitizeEditorHtml(html: string | null | undefined): string {
  const value = html || '';
  const runtimeWindow = typeof globalThis.window !== 'undefined' ? globalThis.window : null;
  if (!runtimeWindow) return fallbackSanitize(value);
  const purifier = createDOMPurify(runtimeWindow);
  const cleaned = purifier.sanitize(value);
  // Keep a small defense-in-depth fallback for DOM shims that report support
  // but do not implement the full parsing hooks used by DOMPurify.
  return fallbackSanitize(cleaned);
}
