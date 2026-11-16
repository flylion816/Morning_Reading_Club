/* 生成晨读日签的三种微信分享封面；好友卡片比例为 5:4。 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const outputDir = path.resolve(__dirname, '../miniprogram/assets/images');
const shared = `
  <style>
    .small { font: 26px 'PingFang SC', 'Noto Sans CJK SC', sans-serif; letter-spacing: 4px; }
    .headline { font: 600 54px 'Songti SC', 'STSong', 'Noto Serif CJK SC', serif; letter-spacing: 4px; }
    .caption { font: 24px 'PingFang SC', 'Noto Sans CJK SC', sans-serif; letter-spacing: 2px; }
  </style>`;
const covers = {
  dawn: `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f8d6a9"/><stop offset="1" stop-color="#fff4e2"/></linearGradient></defs>
    <rect width="750" height="600" fill="url(#sky)"/>
    <circle cx="610" cy="466" r="176" fill="#fbd08f" opacity=".66"/><circle cx="610" cy="466" r="120" fill="#ee9b45"/>
    <rect y="466" width="750" height="134" fill="#fffdf8"/>
    <text x="96" y="88" class="small" fill="#8a4b12">晨读日签 · 晨光</text>
    <text x="96" y="205" class="headline" fill="#2b2622">把今天的晨光</text>
    <text x="96" y="285" class="headline" fill="#2b2622">留给自己</text>
    <text x="96" y="536" class="caption" fill="#8a4b12">每天清晨，一起读一页书</text>`,
  paper: `<rect width="750" height="600" fill="#faf5ea"/>
    <rect x="28" y="28" width="694" height="544" fill="none" stroke="#cbbba7" stroke-width="2"/>
    <rect x="96" y="63" width="62" height="62" rx="8" fill="#b4452c"/>
    <text x="127" y="108" text-anchor="middle" style="font:600 38px 'Songti SC',serif" fill="#fffdf8">晨</text>
    <text x="183" y="105" class="small" fill="#776c5f">晨读日签 · 纸墨</text>
    <text x="96" y="240" class="headline" fill="#2b2622">读一页书</text>
    <text x="96" y="320" class="headline" fill="#2b2622">写一点心意</text>
    <line x1="96" y1="445" x2="654" y2="445" stroke="#ded1bf" stroke-width="2"/>
    <text x="96" y="513" class="caption" fill="#776c5f">把触动，轻轻留在纸上</text>`,
  blank: `<rect width="750" height="600" fill="#fffdf8"/>
    <rect x="96" y="76" width="48" height="5" fill="#3d6fa6"/>
    <text x="96" y="139" class="small" fill="#776c5f">晨读日签 · 留白</text>
    <text x="96" y="270" class="headline" fill="#2b2622">在文字里</text>
    <text x="96" y="350" class="headline" fill="#2b2622">与自己相遇</text>
    <text x="96" y="514" class="caption" fill="#776c5f">给每一天，留一点空白</text>`
};

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [variant, content] of Object.entries(covers)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="600" viewBox="0 0 750 600">${shared}${content}</svg>`;
    const file = path.join(outputDir, `daily-card-cover-${variant}.png`);
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
    console.log(path.relative(process.cwd(), file));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
