const fs = require('fs');
const path = require('path');

const RUNTIME_ROOTS = [
  'miniprogram/pages',
  'miniprogram/components',
  'miniprogram/services'
];

const RUNTIME_EXTENSIONS = new Set(['.js', '.wxml', '.wxss']);

const LEGACY_BRAND_BLUES = [
  '#2a5bd7',
  '#2563eb',
  '#1a73e8',
  '#4a6cf7',
  '#667eea',
  '#4f46e5',
  '#2581e8',
  '#3675ff',
  '#4268c7',
  '#2f6fb7',
  '#0050b3',
  '#4a90e2'
];

function collectRuntimeFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectRuntimeFiles(fullPath, files);
    } else if (RUNTIME_EXTENSIONS.has(path.extname(fullPath))) {
      files.push(fullPath);
    }
  }

  return files;
}

function isAllowedContext(line) {
  return [
    '&#039',
    '.confetti-',
    '.cel-',
    'legend-dot.blue',
    "key: '",
    'accentColors',
    'bgColors',
    'ctx.fillStyle',
    'ctx.strokeStyle',
    'fallback'
  ].some(token => line.includes(token));
}

function extractRuleBlock(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return '';

  const openBrace = css.indexOf('{', start);
  const closeBrace = css.indexOf('}', openBrace);
  if (openBrace === -1 || closeBrace === -1) return '';

  return css.slice(openBrace + 1, closeBrace);
}

describe('tenant theme color hygiene', () => {
  test('runtime UI does not keep legacy brand-blue emphasis colors', () => {
    const legacyColorPattern = new RegExp(
      LEGACY_BRAND_BLUES.map(color => color.replace('#', '#')).join('|'),
      'i'
    );

    const hits = RUNTIME_ROOTS
      .flatMap(root => collectRuntimeFiles(root))
      .flatMap(file => {
        const rel = path.relative(process.cwd(), file);
        return fs.readFileSync(file, 'utf8')
          .split('\n')
          .map((line, index) => ({ rel, line, index: index + 1 }))
          .filter(({ line }) => legacyColorPattern.test(line) && !isAllowedContext(line));
      });

    expect(hits).toEqual([]);
  });

  test('checkin detail emphasis text uses tenant theme variables', () => {
    const wxss = fs.readFileSync(
      'miniprogram/pages/course-detail/course-detail.wxss',
      'utf8'
    );

    const hashtagRule = extractRuleBlock(wxss, '.dynamic-hashtag');
    const periodChipRule = extractRuleBlock(wxss, '.dynamic-period-chip');

    expect(hashtagRule).toContain('color: var(--theme-primary)');
    expect(periodChipRule).toContain('background: var(--theme-primary-tint)');
    expect(periodChipRule).toContain('color: var(--theme-primary)');
    expect(hashtagRule).not.toMatch(/#[0-9a-f]{6}/i);
    expect(periodChipRule).not.toMatch(/#[0-9a-f]{6}/i);
  });
});
