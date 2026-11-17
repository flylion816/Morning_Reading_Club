/* 生成觉察日记的微信分享封面；好友卡片比例为 5:4。 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const outputDir = path.resolve(__dirname, '../miniprogram/assets/images');
const shared = `
  <style>
    .small { font: 600 28px 'PingFang SC', 'Noto Sans CJK SC', sans-serif; letter-spacing: 5px; }
    .headline { font: 600 58px 'Songti SC', 'STSong', 'Noto Serif CJK SC', serif; letter-spacing: 5px; }
    .caption { font: 24px 'PingFang SC', 'Noto Sans CJK SC', sans-serif; letter-spacing: 2px; }
    .seal { font: 600 42px 'Songti SC', 'STSong', serif; }
  </style>`;

const content = `
  <defs>
    <linearGradient id="night" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#171412"/>
      <stop offset=".62" stop-color="#2c2119"/>
      <stop offset="1" stop-color="#6a4322"/>
    </linearGradient>
    <radialGradient id="glow" cx="82%" cy="76%" r="34%">
      <stop stop-color="#f7b566" stop-opacity=".75"/>
      <stop offset="1" stop-color="#f0a85a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="750" height="600" fill="url(#night)"/>
  <rect width="750" height="600" fill="url(#glow)"/>
  <circle cx="620" cy="455" r="116" fill="#f0a85a" opacity=".9"/>
  <circle cx="620" cy="455" r="152" fill="none" stroke="#f0a85a" stroke-width="2" opacity=".3"/>
  <path d="M0 466 C130 430 238 478 360 452 C490 424 590 454 750 420 L750 600 L0 600 Z" fill="#1f1a16" opacity=".84"/>
  <path d="M0 510 C152 472 274 526 410 494 C540 464 640 500 750 476 L750 600 L0 600 Z" fill="#171412" opacity=".62"/>
  <line x1="80" y1="422" x2="670" y2="422" stroke="#f0a85a" stroke-width="2" opacity=".65"/>
  <rect x="80" y="62" width="70" height="70" rx="18" fill="none" stroke="#f0a85a" stroke-width="3"/>
  <text x="115" y="112" text-anchor="middle" class="seal" fill="#f3e9da">觉</text>
  <text x="176" y="91" class="small" fill="#f0a85a">觉察日记</text>
  <text x="176" y="122" class="caption" fill="#d7c4aa">停一下，看见自己</text>
  <text x="80" y="250" class="headline" fill="#f3e9da">从夜色</text>
  <text x="80" y="330" class="headline" fill="#f3e9da">走到晨光</text>
  <text x="80" y="520" class="caption" fill="#f3e9da">写下发生的，看见在意的</text>
  <text x="80" y="558" class="caption" fill="#f0a85a">晨读营 · 一页觉察</text>`;

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="600" viewBox="0 0 750 600">${shared}${content}</svg>`;
  const file = path.join(outputDir, 'awareness-share-cover.png');
  // 近无损调色板：体积不到原来的一半（开发者工具「代码质量」要求图片和音频合计不超过 200K）
  await sharp(Buffer.from(svg)).png({ palette: true, quality: 95, colors: 256, effort: 10, dither: 1, compressionLevel: 9 }).toFile(file);
  console.log(path.relative(process.cwd(), file));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
