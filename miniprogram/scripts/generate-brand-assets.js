/**
 * 生成品牌素材：Tab 图标、logo、分享封面。
 *
 * 所有图形都写在这个文件里（SVG），改颜色或形状后重新运行即可：
 *   node miniprogram/scripts/generate-brand-assets.js            # 全部租户
 *   node miniprogram/scripts/generate-brand-assets.js fanren     # 只生成某个租户
 *
 * 产出：
 *   miniprogram/assets/tenants/<slug>/tab-*.png      81×81，Tab 栏图标（未选中 / 选中）
 *   miniprogram/assets/tenants/<slug>/logo.png       162×162，仅 LOGO_TENANTS 里的租户
 *   miniprogram/assets/tenants/<slug>/share-cover.jpg 750×600，仅 COVER_TENANTS 里的租户
 *   docs/design/brand/<slug>/                         大尺寸 logo、横版标志（上传公众平台用，不进小程序包）
 *
 * 依赖仓库根目录的 sharp；中文标题用系统自带的宋体（Songti SC），在 macOS 上运行。
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');

// 晨光色与中性色，和 app.wxss 的令牌保持一致
const DAWN = '#ee9b45';
const DAWN_LIGHT = '#f8c27c';
const PAPER = '#fffdf8';
const TAB_IDLE = '#857a6c';

// 有自己正式 logo 的租户不在这里（若星用的是自己的字标）
const LOGO_TENANTS = {
  fanren: { title: '凡人共读', tagline: '一起早起、读书、谈心' },
  chaoren: { title: '超人读书会', tagline: '一起早起、读书、谈心' }
};
const COVER_TENANTS = ['fanren'];

function hexToRgb(hex) {
  const n = String(hex).replace('#', '');
  return [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16));
}

function mix(hex, target, weight) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return `#${a.map((c, i) => Math.round(c + (b[i] - c) * weight).toString(16).padStart(2, '0')).join('')}`;
}

/* ---------- Tab 图标：24 格线性图标，选中态是主色线条 + 一处晨光色 ---------- */

const TAB_SHAPES = {
  // 首页：地平线上升起的太阳
  home: ({ active }) => `
    <path d="M7 16.4a5 5 0 0 1 10 0z" ${active ? `fill="${DAWN}"` : ''}/>
    <path d="M2.8 16.4h18.4M12 4.8v2.5M5.2 8.4l1.8 1.8M18.8 8.4l-1.8 1.8M7.6 20h8.8"/>`,
  // 晨读营：摊开的书，选中时多一条晨光色书签
  book: ({ active, primary }) => `
    <path d="M12 7.3c-1.9-1.4-4.5-2-7.7-1.8v12.2c3.2-.2 5.8.4 7.7 1.8 1.9-1.4 4.5-2 7.7-1.8V5.5c-3.2-.2-5.8.4-7.7 1.8z" ${active ? `fill="${primary}" fill-opacity="0.14"` : ''}/>
    <path d="M12 7.3v12.2"/>
    ${active ? `<path d="M14.9 4.6h3v7.2l-1.5-1.3-1.5 1.3z" fill="${DAWN}" stroke="${DAWN}" stroke-width="0.9"/>` : ''}`,
  // 我的：一个人，选中时头是一轮小太阳
  my: ({ active, primary }) => `
    <path d="M4.9 19.7c.6-3.9 3.4-6 7.1-6s6.5 2.1 7.1 6z" ${active ? `fill="${primary}" fill-opacity="0.14"` : ''}/>
    <circle cx="12" cy="8" r="3.7" ${active ? `fill="${DAWN}"` : ''}/>`
};

function tabIconSvg(name, { active, primary }) {
  const stroke = active ? primary : TAB_IDLE;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 24 24"
    fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    ${TAB_SHAPES[name]({ active, primary })}
  </svg>`;
}

/* ---------- logo：破晓的天，太阳从摊开的书里升起 ---------- */

function logoDefs(primary) {
  const deep = mix(primary, '#0d1b2e', 0.42);
  const pale = mix(primary, '#ffffff', 0.42);
  return `
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${deep}"/>
      <stop offset="0.5" stop-color="${primary}"/>
      <stop offset="1" stop-color="${pale}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffe2b0" stop-opacity="0.85"/>
      <stop offset="0.55" stop-color="#ffd596" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#ffd596" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${DAWN_LIGHT}"/>
      <stop offset="1" stop-color="${DAWN}"/>
    </linearGradient>
    <linearGradient id="pageL" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${PAPER}"/>
      <stop offset="1" stop-color="#f1e6d2"/>
    </linearGradient>
    <linearGradient id="pageR" x1="1" y1="0" x2="0" y2="0">
      <stop offset="0" stop-color="${PAPER}"/>
      <stop offset="1" stop-color="#f1e6d2"/>
    </linearGradient>`;
}

// 徽记本体（1024 画板），可叠在任意底上
function logoMark() {
  const rays = [-90, -58, -122, -28, -152]
    .map(deg => {
      const r = (deg * Math.PI) / 180;
      const [x1, y1] = [512 + Math.cos(r) * 232, 590 + Math.sin(r) * 232];
      const [x2, y2] = [512 + Math.cos(r) * 292, 590 + Math.sin(r) * 292];
      return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
    })
    .join('');
  return ` <circle cx="512" cy="590" r="430" fill="url(#glow)"/>
    <g stroke="#ffe7c2" stroke-width="20" stroke-linecap="round" opacity="0.92">${rays}</g>
    <circle cx="512" cy="590" r="168" fill="url(#sun)"/>
    <path d="M512 668C424 606 318 590 196 604v214c122-14 228 2 316 64z" fill="url(#pageL)"/>
    <path d="M512 668c88-62 194-78 316-64v214c-122-14-228 2-316 64z" fill="url(#pageR)"/>
    <path d="M512 668v214" stroke="#d9c7a6" stroke-width="6" stroke-linecap="round"/>`;
}

function logoSvg(primary, { size = 1024, radius = 0 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
    <defs>${logoDefs(primary)}<clipPath id="clip"><rect width="1024" height="1024" rx="${radius}"/></clipPath></defs>
    <g clip-path="url(#clip)">
      <rect width="1024" height="1024" fill="url(#sky)"/>
      ${logoMark()}
    </g>
  </svg>`;
}

// 带字的头像：四个字两行在上，徽记缩小在下。小尺寸头像靠字认人，用这一版
function logoWithNameSvg(primary, { title }) {
  const chars = Array.from(title);
  const half = Math.ceil(chars.length / 2);
  const lines = chars.length <= 4 ? [chars.slice(0, half).join(''), chars.slice(half).join('')] : [title];
  const size = lines.length === 2 ? 250 : Math.floor(820 / chars.length);
  const text = lines
    .map((line, i) => `<text x="512" y="${lines.length === 2 ? 300 + i * 262 : 400}" text-anchor="middle" font-family="Songti SC" font-weight="700" font-size="${size}" fill="#fffdf8" letter-spacing="${lines.length === 2 ? 28 : 8}">${line}</text>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>${logoDefs(primary)}</defs>
    <rect width="1024" height="1024" fill="url(#sky)"/>
    <g transform="translate(246 512) scale(0.52)">${logoMark()}</g>
    ${text}
  </svg>`;
}

// 横版标志：徽记 + 品牌名 + 一句话，纸色底
function lockupSvg(primary, { title, tagline }) {
  const ink = mix(primary, '#0d1b2e', 0.5);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="560" viewBox="0 0 1600 560">
    <defs>${logoDefs(primary)}<clipPath id="clip"><rect width="1024" height="1024" rx="230"/></clipPath></defs>
    <rect width="1600" height="560" fill="${PAPER}"/>
    <g transform="translate(110 90) scale(0.371)">
      <g clip-path="url(#clip)"><rect width="1024" height="1024" fill="url(#sky)"/>${logoMark()}</g>
    </g>
    <text x="580" y="290" font-family="Songti SC" font-weight="700" font-size="${title.length > 4 ? 150 : 190}" fill="${ink}" letter-spacing="10">${title}</text>
    <path d="M586 348h90" stroke="${DAWN}" stroke-width="8" stroke-linecap="round"/>
    <text x="584" y="430" font-family="Songti SC" font-size="58" fill="#62584d" letter-spacing="8">${tagline}</text>
  </svg>`;
}

/* ---------- 分享封面（5:4） ---------- */

function shareCoverSvg(primary, { title, tagline }) {
  const deep = mix(primary, '#0d1b2e', 0.45);
  const hillBack = mix(primary, '#0d1b2e', 0.18);
  const hillFront = mix(primary, '#0d1b2e', 0.4);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="600" viewBox="0 0 750 600">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${deep}"/>
        <stop offset="0.48" stop-color="${primary}"/>
        <stop offset="0.82" stop-color="${mix(primary, '#ffffff', 0.5)}"/>
        <stop offset="1" stop-color="#fbe0b6"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#ffe2b0" stop-opacity="0.95"/>
        <stop offset="0.5" stop-color="#ffd596" stop-opacity="0.35"/>
        <stop offset="1" stop-color="#ffd596" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fbd08f"/><stop offset="1" stop-color="${DAWN}"/>
      </linearGradient>
    </defs>
    <rect width="750" height="470" fill="url(#sky)"/>
    <circle cx="375" cy="462" r="300" fill="url(#glow)"/>
    <circle cx="375" cy="462" r="78" fill="url(#sun)"/>
    <path d="M0 452c90-34 170-40 250-14 60 20 110 30 160 22 90-14 170-52 340-18v158H0z" fill="${hillBack}"/>
    <path d="M0 506c120-42 240-36 340-4 100 32 250 30 410-22v120H0z" fill="${hillFront}"/>
    <text x="375" y="196" text-anchor="middle" font-family="Songti SC" font-weight="700" font-size="${title.length > 4 ? 96 : 124}" fill="#ffffff" letter-spacing="10">${title}</text>
    <path d="M335 248h80" stroke="${DAWN_LIGHT}" stroke-width="5" stroke-linecap="round"/>
    <text x="375" y="316" text-anchor="middle" font-family="Songti SC" font-size="36" fill="#ffffff" fill-opacity="0.94" letter-spacing="6">${tagline}</text>
  </svg>`;
}

/* ---------- 输出 ---------- */

async function writePng(svg, file, size) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let img = sharp(Buffer.from(svg), { density: 300 });
  if (size) img = img.resize(size, size);
  await img.png({ compressionLevel: 9, palette: false }).toFile(file);
}

async function generateTenant(slug) {
  const cfg = require(path.join(ROOT, 'config/tenants', `${slug}.js`));
  const primary = cfg.primaryColor;
  const dir = path.join(ROOT, 'assets/tenants', slug);
  const done = [];

  for (const [name, file] of [['home', 'tab-home'], ['book', 'tab-book'], ['my', 'tab-my']]) {
    await writePng(tabIconSvg(name, { active: false, primary }), path.join(dir, `${file}.png`), 81);
    await writePng(tabIconSvg(name, { active: true, primary }), path.join(dir, `${file}-active.png`), 81);
  }
  done.push('tab 图标 ×6');

  const brand = LOGO_TENANTS[slug];
  if (brand) {
    const out = path.join(REPO, 'docs/design/brand', slug);
    await writePng(logoSvg(primary, { radius: 230 }), path.join(dir, 'logo.png'), 162);
    await writePng(logoSvg(primary), path.join(out, 'logo-1024.png'), 1024);
    await writePng(logoSvg(primary), path.join(out, 'logo-144.png'), 144);
    await writePng(logoWithNameSvg(primary, brand), path.join(out, 'logo-name-1024.png'), 1024);
    await writePng(logoWithNameSvg(primary, brand), path.join(out, 'logo-name-144.png'), 144);
    await writePng(logoSvg(primary, { radius: 230 }), path.join(out, 'logo-rounded-512.png'), 512);
    fs.writeFileSync(path.join(out, 'logo.svg'), logoSvg(primary));
    await sharp(Buffer.from(lockupSvg(primary, brand))).png().toFile(path.join(out, 'lockup.png'));
    done.push('logo');
  }

  if (brand && COVER_TENANTS.includes(slug)) {
    await sharp(Buffer.from(shareCoverSvg(primary, brand)))
      .jpeg({ quality: 84, mozjpeg: true })
      .toFile(path.join(dir, 'share-cover.jpg'));
    done.push('分享封面');
  }

  console.log(`✓ ${slug}（${primary}）：${done.join('、')}`);
}

async function main() {
  const only = process.argv[2];
  const slugs = fs
    .readdirSync(path.join(ROOT, 'config/tenants'))
    .filter(f => f.endsWith('.js') && !f.startsWith('_'))
    .map(f => f.replace(/\.js$/, ''))
    .filter(slug => !only || slug === only);
  if (!slugs.length) throw new Error(`没有找到租户：${only}`);
  for (const slug of slugs) await generateTenant(slug);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { tabIconSvg, logoSvg, logoWithNameSvg, lockupSvg, shareCoverSvg, mix };
