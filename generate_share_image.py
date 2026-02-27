#!/usr/bin/env python3
"""
小凡看见分享图片生成脚本
生成 1080x1080 的正方形分享图片
"""

import os
from PIL import Image, ImageDraw, ImageFont

def generate_share_image():
    # 图片尺寸
    width = 1080
    height = 1080

    # 创建图片，背景颜色为蓝色
    img = Image.new('RGB', (width, height), color='#5B9FE3')
    draw = ImageDraw.Draw(img)

    # 创建蓝色渐变背景
    # 从浅蓝到深蓝
    for y in range(height):
        # 渐变色计算
        ratio = y / height
        r = int(91 - (91 - 61) * ratio)  # 91 -> 61
        g = int(159 - (159 - 123) * ratio)  # 159 -> 123
        b = int(227 - (227 - 199) * ratio)  # 227 -> 199

        color = (r, g, b)
        draw.line([(0, y), (width, y)], fill=color)

    # 添加网格纹理（很淡）
    for x in range(0, width, 40):
        draw.line([(x, 0), (x, height)], fill=(255, 255, 255, 8))
    for y in range(0, height, 40):
        draw.line([(0, y), (width, y)], fill=(255, 255, 255, 8))

    # 尝试加载字体，如果不存在就使用默认
    font_size_title = 26
    font_size_main = 140

    try:
        # 尝试加载系统字体
        font_title = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", font_size_title)
        font_main = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", font_size_main)
    except:
        try:
            # macOS 备选
            font_title = ImageFont.truetype("/Library/Fonts/SimHei.ttf", font_size_title)
            font_main = ImageFont.truetype("/Library/Fonts/SimHei.ttf", font_size_main)
        except:
            # 使用默认字体
            font_title = ImageFont.load_default()
            font_main = ImageFont.load_default()

    # 左上角标题
    title_text = "凡人晨读营-小凡看见"
    draw.text((50, 60), title_text, fill=(255, 255, 255), font=font_title)

    # 中心文字 - 分两行
    center_x = width / 2
    center_y = height / 2
    line_height = 160

    # 第一行：小凡
    text1 = "小凡"
    # 阴影
    draw.text((center_x + 2, center_y - line_height / 2 + 3), text1,
              fill=(0, 0, 0, 38), font=font_main, anchor="mm")
    # 主文字
    draw.text((center_x, center_y - line_height / 2), text1,
              fill=(255, 255, 255), font=font_main, anchor="mm")

    # 第二行：看见
    text2 = "看见"
    # 阴影
    draw.text((center_x + 2, center_y + line_height / 2 + 3), text2,
              fill=(0, 0, 0, 38), font=font_main, anchor="mm")
    # 主文字
    draw.text((center_x, center_y + line_height / 2), text2,
              fill=(255, 255, 255), font=font_main, anchor="mm")

    return img

def main():
    try:
        print("🎨 生成小凡看见分享图片...")

        img = generate_share_image()

        # 确定输出目录
        base_dir = os.path.dirname(os.path.abspath(__file__))
        assets_dir = os.path.join(base_dir, "miniprogram", "assets", "images")
        output_path = os.path.join(assets_dir, "share-insight.png")

        # 创建目录
        os.makedirs(assets_dir, exist_ok=True)

        # 保存图片
        img.save(output_path, "PNG")

        # 获取文件大小
        file_size = os.path.getsize(output_path) / 1024

        print(f"✅ 分享图片已生成: {output_path}")
        print(f"📐 尺寸: 1080x1080 px")
        print(f"💾 文件大小: {file_size:.2f} KB")

    except Exception as e:
        print(f"❌ 生成失败: {str(e)}")
        exit(1)

if __name__ == "__main__":
    main()
