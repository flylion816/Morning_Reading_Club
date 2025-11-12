const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconsDir = path.join(__dirname, '../miniprogram/assets/icons');
const svgFiles = ['home.svg', 'home-active.svg', 'user.svg', 'user-active.svg'];

async function convertSvgToPng() {
  for (const svgFile of svgFiles) {
    const svgPath = path.join(iconsDir, svgFile);
    const pngPath = path.join(iconsDir, svgFile.replace('.svg', '.png'));

    try {
      await sharp(svgPath)
        .resize(81, 81)
        .png()
        .toFile(pngPath);
      console.log(`✓ 转换成功: ${svgFile} -> ${svgFile.replace('.svg', '.png')}`);
    } catch (error) {
      console.error(`✗ 转换失败: ${svgFile}`, error.message);
    }
  }
}

convertSvgToPng()
  .then(() => console.log('\n所有图标转换完成！'))
  .catch(error => console.error('转换过程出错:', error));
