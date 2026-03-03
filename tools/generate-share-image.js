#!/usr/bin/env node

/**
 * 小凡看见分享图片生成脚本
 * 生成 1080x1080 的正方形分享图片
 */

const fs = require('fs');
const path = require('path');

// 检查是否安装了 canvas 库
let Canvas, createCanvas;
try {
  Canvas = require('canvas');
  createCanvas = Canvas.createCanvas;
} catch (err) {
  console.error('❌ 缺少 canvas 库');
  console.error('请先运行: npm install canvas');
  process.exit(1);
}

function generateShareImage() {
  const width = 1080;
  const height = 1080;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 背景：蓝色渐变（与小程序配色接近）
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#5B9FE3');      // 亮蓝色
  gradient.addColorStop(0.5, '#4A8FD8');    // 中蓝色
  gradient.addColorStop(1, '#3D7BC7');      // 深蓝色
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 添加微妙的网格纹理效果
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let i = 0; i < width; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, height);
    ctx.stroke();
  }
  for (let i = 0; i < height; i += 40) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(width, i);
    ctx.stroke();
  }

  // 左上角：标题文字
  ctx.font = '26px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('凡人共读-小凡看见', 50, 60);

  // 中心：大标题 "小凡看见" - 分两行显示
  ctx.font = 'bold 140px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const centerY = height / 2;
  const lineHeight = 160;

  // 第一行：小凡
  // 阴影效果
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.fillText('小凡', width / 2 + 2, centerY - lineHeight / 2 + 3);

  // 主文字
  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
  ctx.fillText('小凡', width / 2, centerY - lineHeight / 2);

  // 第二行：看见
  // 阴影效果
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.fillText('看见', width / 2 + 2, centerY + lineHeight / 2 + 3);

  // 主文字
  ctx.fillStyle = 'rgba(255, 255, 255, 1)';
  ctx.fillText('看见', width / 2, centerY + lineHeight / 2);

  return canvas;
}

// 主函数
async function main() {
  try {
    console.log('🎨 生成小凡看见分享图片...');

    const canvas = generateShareImage();
    const buffer = canvas.toBuffer('image/png');

    // 确定输出目录
    const assetsDir = path.join(__dirname, 'miniprogram', 'assets', 'images');
    const outputPath = path.join(assetsDir, 'share-insight.png');

    // 创建目录（如果不存在）
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
      console.log(`📁 创建目录: ${assetsDir}`);
    }

    // 保存图片
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ 分享图片已生成: ${outputPath}`);
    console.log(`📐 尺寸: 1080x1080 px`);
    console.log(`💾 文件大小: ${(buffer.length / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('❌ 生成失败:', error.message);
    process.exit(1);
  }
}

main();
