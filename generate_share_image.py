#!/usr/bin/env python3
"""
小凡看见分享图片生成脚本
生成 1080x1080 的正方形分享图片
"""

import os
import subprocess
from PIL import Image, ImageDraw, ImageFont

def find_font():
    """
    查找系统中的中文字体
    """
    # macOS 字体路径列表
    font_paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/Library/Fonts/SimHei.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]

    for font_path in font_paths:
        if os.path.exists(font_path):
            print(f"📝 使用字体: {font_path}")
            return font_path

    # 如果找不到任何字体，尝试用 brew 安装中文字体
    print("⚠️  未找到中文字体，尝试安装...")
    try:
        subprocess.run(["brew", "install", "font-noto-sans-cjk"], check=True)
        return "/usr/local/opt/font-noto-sans-cjk/share/fonts/opentype/noto-cjk/NotoSansCJK-Regular.ttc"
    except:
        print("❌ 字体安装失败，使用默认字体（可能显示不正确）")
        return None

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

    # 添加微妙的网格纹理
    for x in range(0, width, 40):
        draw.line([(x, 0), (x, height)], fill=(255, 255, 255, 8))
    for y in range(0, height, 40):
        draw.line([(0, y), (width, y)], fill=(255, 255, 255, 8))

    # 查找并加载字体
    font_path = find_font()

    if font_path and os.path.exists(font_path):
        font_title = ImageFont.truetype(font_path, 50)
        font_main = ImageFont.truetype(font_path, 200)
    else:
        print("⚠️  使用默认字体，中文可能显示不正确")
        font_title = ImageFont.load_default()
        font_main = ImageFont.load_default()

    # 左上角标题
    title_text = "凡人晨读营-小凡看见"
    draw.text((50, 60), title_text, fill=(255, 255, 255), font=font_title)

    # 中心文字 - 分两行
    center_x = width / 2
    center_y = height / 2
    line_height = 220

    # 第一行：小凡
    text1 = "小凡"
    # 阴影效果
    draw.text((center_x + 3, center_y - line_height / 2 + 4), text1,
              fill=(0, 0, 0, 80), font=font_main, anchor="mm")
    # 主文字
    draw.text((center_x, center_y - line_height / 2), text1,
              fill=(255, 255, 255), font=font_main, anchor="mm")

    # 第二行：看见
    text2 = "看见"
    # 阴影效果
    draw.text((center_x + 3, center_y + line_height / 2 + 4), text2,
              fill=(0, 0, 0, 80), font=font_main, anchor="mm")
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
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == "__main__":
    main()
