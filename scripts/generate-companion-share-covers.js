/* 生成陪伴手札的两张微信分享封面（5:4）：
 * - day:   某一天的合集封面（日历格子 + 当天篇数）
 * - note:  单篇手札封面（书本 + 标题）
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const outputDir = path.resolve(__dirname, '../miniprogram/assets/images');
const shared = `
  <style>
    .small { font: 600 26px 'PingFang SC', 'Noto Sans CJK SC', sans-serif; letter-spacing: 4px; }
    .headline { font: 600 52px 'Songti SC', 'STSong', 'Noto Serif CJK SC', serif; letter-spacing: 4px; }
    .caption { font: 24px 'PingFang SC', 'Noto Sans CJK SC', sans-serif; letter-spacing: 2px; }
    .seal { font: 600 40px 'Songti SC', 'STSong', serif; }
    .num { font: 600 96px 'Songti SC', 'STSong', serif; }
  </style>`;

const covers = {
  // 某一天的合集：暖纸底 + 大日历格 + 篇数
  day: `<defs><linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fdf3e3"/><stop offset="1" stop-color="#fffaf0"/></linearGradient></defs>
    <rect width="750" height="600" fill="url(#paper)"/>
    <rect x="80" y="64" width="590" height="470" rx="26" fill="#fffdf8" stroke="#e8d9c2" stroke-width="2"/>
    <rect x="80" y="64" width="590" height="86" rx="26" fill="#b8631f"/>
    <rect x="80" y="124" width="590" height="26" fill="#b8631f"/>
    <text x="375" y="120" text-anchor="middle" class="small" fill="#fffdf8">陪伴手札 · 这一天</text>
    <rect x="140" y="180" width="240" height="240" rx="22" fill="#fdf0dc" stroke="#ee9b45" stroke-width="3"/>
    <text x="260" y="290" text-anchor="middle" class="num" fill="#b8631f">{{DAY}}</text>
    <text x="260" y="360" text-anchor="middle" class="small" fill="#8a4b12">第 {{DAY}} 天</text>
    <line x1="430" y1="200" x2="610" y2="200" stroke="#e8d9c2" stroke-width="2"/>
    <text x="430" y="262" class="headline" fill="#2b2622">{{COUNT}} 篇</text>
    <text x="430" y="316" class="caption" fill="#6b5d4d">这一天写下的手札</text>
    <text x="430" y="356" class="caption" fill="#6b5d4d">都在这里，等你翻开</text>
    <text x="80" y="586" class="caption" fill="#9a8d7b">登录的书友点开即可阅读</text>`,

  // 单篇：书本 + 标题
  note: `<defs><linearGradient id="dawnpaper" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fbe3c3"/><stop offset="0.5" stop-color="#fdf0dc"/><stop offset="1" stop-color="#fffaf0"/></linearGradient></defs>
    <rect width="750" height="600" fill="url(#dawnpaper)"/>
    <circle cx="620" cy="500" r="150" fill="#ee9b45" opacity=".16"/>
    <rect x="96" y="86" width="70" height="70" rx="18" fill="none" stroke="#b8631f" stroke-width="3"/>
    <text x="131" y="136" text-anchor="middle" class="seal" fill="#b8631f">伴</text>
    <text x="192" y="112" class="small" fill="#b8631f">陪伴手札</text>
    <text x="192" y="144" class="caption" fill="#8a4b12">写给某位书友的一页</text>
    <path d="M96 226 h558 M96 234 h558" stroke="#e8d9c2" stroke-width="0" />
    <line x1="96" y1="230" x2="654" y2="230" stroke="#e8d9c2" stroke-width="2"/>
    <text x="96" y="320" class="headline" fill="#2b2622">翻开这一篇手札</text>
    <text x="96" y="384" class="headline" fill="#2b2622">看看写给你的话</text>
    <line x1="96" y1="448" x2="240" y2="448" stroke="#ee9b45" stroke-width="4"/>
    <text x="96" y="510" class="caption" fill="#6b5d4d">PDF 手札 · 登录的书友可读</text>
    <text x="96" y="546" class="caption" fill="#9a8d7b">晨读营 · 陪伴手札</text>`
};

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [variant, content] of Object.entries(covers)) {
    const body = content.replace(/\{\{DAY\}\}/g, '1').replace(/\{\{COUNT\}\}/g, '3');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="600" viewBox="0 0 750 600">${shared}${body}</svg>`;
    const file = path.join(outputDir, `companion-share-${variant}.png`);
    await sharp(Buffer.from(svg)).png({ palette: true, quality: 95, colors: 256, effort: 10, dither: 1, compressionLevel: 9 }).toFile(file);
    console.log(path.relative(process.cwd(), file));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
