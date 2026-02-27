#!/usr/bin/env python3
"""
小凡看见分享图片生成脚本
生成 1080x1080 的正方形分享图片 - 参考设计风格版
"""

import os
from PIL import Image, ImageDraw, ImageFont

def find_font():
    """
    查找系统中的中文字体
    """
    # macOS 字体路径列表
    font_paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/Library/Fonts/SimHei.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]

    for font_path in font_paths:
        if os.path.exists(font_path):
            print(f"📝 使用字体: {font_path}")
            return font_path

    print("⚠️  未找到合适的字体，使用默认字体")
    return None

def generate_share_image():
    # 图片尺寸
    width = 1080
    height = 1080

    # 创建图片
    img = Image.new('RGB', (width, height), color='#5B9FE3')
    draw = ImageDraw.Draw(img)

    # 创建蓝色渐变背景（平滑渐变，无网格）
    for y in range(height):
        # 渐变色计算 - 从浅蓝到深蓝
        ratio = y / height
        r = int(91 - (91 - 61) * ratio)   # 91 -> 61
        g = int(159 - (159 - 123) * ratio)  # 159 -> 123
        b = int(227 - (227 - 199) * ratio)  # 227 -> 199
        color = (r, g, b)
        draw.line([(0, y), (width, y)], fill=color)

    # 查找并加载字体
    font_path = find_font()

    if font_path and os.path.exists(font_path):
        # 尝试加载粗体字体
        try:
            font_main = ImageFont.truetype(font_path, 300)
        except:
            font_main = ImageFont.truetype(font_path, 300)
        font_subtitle = ImageFont.truetype(font_path, 40)
    else:
        print("⚠️  使用默认字体")
        font_main = ImageFont.load_default()
        font_subtitle = ImageFont.load_default()

    # ====== 中央：主标题"小凡看见" - 分两行 ======
    center_x = width / 2
    center_y = height / 2 - 100

    # 第一行：小凡
    text1 = "小凡"
    # 阴影
    draw.text((center_x + 3, center_y - 120 + 4), text1,
              fill=(0, 0, 0, 100), font=font_main, anchor="mm")
    # 主文字
    draw.text((center_x, center_y - 120), text1,
              fill=(255, 255, 255), font=font_main, anchor="mm")

    # 第二行：看见
    text2 = "看见"
    # 阴影
    draw.text((center_x + 3, center_y + 120 + 4), text2,
              fill=(0, 0, 0, 100), font=font_main, anchor="mm")
    # 主文字
    draw.text((center_x, center_y + 120), text2,
              fill=(255, 255, 255), font=font_main, anchor="mm")

    # ====== 下方：装饰线 ======
    line_y = center_y + 150
    line_left = width / 2 - 150
    line_right = width / 2 + 150
    draw.line([(line_left, line_y), (line_right, line_y)],
              fill=(255, 255, 255, 150), width=2)

    # ====== 最下方：副标题 ======
    subtitle_text = "在晨光中，遇见更好的自己"
    subtitle_y = line_y + 80
    draw.text((center_x, subtitle_y), subtitle_text,
              fill=(255, 255, 255, 200), font=font_subtitle, anchor="mm")

    return img

def main():
    try:
        print("🎨 生成小凡看见分享图片（参考风格版）...")

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
        print(f"🎨 风格: 参考设计版本（单行主标题 + 副标题）")

    except Exception as e:
        print(f"❌ 生成失败: {str(e)}")
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == "__main__":
    main()
