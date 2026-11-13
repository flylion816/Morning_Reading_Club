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
  '#4a90e2',
  '#0d4f6c',
  '#2980b9'
];

const SHARE_SURFACE_FILES = [
  'miniprogram/pages/insight-detail/insight-detail.js',
  'miniprogram/pages/insights/insights.js',
  'miniprogram/pages/course-detail/course-detail.js',
  'miniprogram/utils/share-cover.js'
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

  test('share surfaces do not retain legacy fixed cover art or poster palettes', () => {
    const legacySharePattern = /(#0d4f6c|#2980b9|#f97316|#ea580c)/i;
    const hits = SHARE_SURFACE_FILES.flatMap(file => {
      return fs.readFileSync(file, 'utf8')
        .split('\n')
        .map((line, index) => ({ file, line, index: index + 1 }))
        .filter(({ line }) => legacySharePattern.test(line));
    });

    expect(hits).toEqual([]);
  });

  test('keeps fixed share covers distinct for insight and podcast fallbacks', () => {
    const brand = fs.readFileSync('miniprogram/utils/brand.js', 'utf8');
    const insight = fs.readFileSync('miniprogram/pages/insight-detail/insight-detail.js', 'utf8');
    const podcast = fs.readFileSync('miniprogram/pages/course-detail/course-detail.js', 'utf8');
    const insightCover = '/assets/images/share-insight.jpg';
    const podcastCover = '/assets/images/share-podcast.jpg';

    expect(brand).toContain("DEFAULT_SHARE_IMAGE = '/assets/images/share-default.jpg'");
    expect(insight).toContain(`imageUrl: '${insightCover}'`);
    expect(podcast).toContain(`imageUrl: '${podcastCover}'`);
    expect(fs.existsSync('miniprogram/assets/images/share-insight.jpg')).toBe(true);
    expect(fs.existsSync('miniprogram/assets/images/share-podcast.jpg')).toBe(true);
  });
});
