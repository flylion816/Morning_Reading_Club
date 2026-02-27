#!/usr/bin/env python3
"""
小凡看见分享图片生成脚本
生成 1080x1080 的正方形分享图片
"""

import os
from PIL import Image, ImageDraw, ImageFont

def find_font():
    """
    查找系统中的中文字体，优先使用微软雅黑
    """
    font_paths = [
        # 微软雅黑（Windows 字体，macOS 上如果安装了 Office 会有）
        "/Library/Fonts/Microsoft YaHei.ttf",
        "/Library/Fonts/微软雅黑.ttf",
        # macOS 系统字体
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/Library/Fonts/SimHei.ttf",
    ]

    for font_path in font_paths:
        if os.path.exists(font_path):
            print(f"📝 使用字体: {font_path}")
            return font_path

    print("⚠️  未找到合适的字体")
    return None

def generate_share_image():
    # 图片尺寸
    width = 1080
    height = 1080

    # 创建图片 - 蓝色渐变背景
    img = Image.new('RGB', (width, height), color='#5B9FE3')
    draw = ImageDraw.Draw(img)

    # 创建蓝色渐变背景
    for y in range(height):
        ratio = y / height
        r = int(91 - (91 - 61) * ratio)
        g = int(159 - (159 - 123) * ratio)
        b = int(227 - (227 - 199) * ratio)
        color = (r, g, b)
        draw.line([(0, y), (width, y)], fill=color)

    # 加载字体
    font_path = find_font()

    if font_path and os.path.exists(font_path):
        # 使用粗体字体，字体大小增加到 250
        # 尝试加载粗体版本
        bold_font_path = font_path.replace("Light", "Medium").replace("Light", "Bold")
        if not os.path.exists(bold_font_path):
            bold_font_path = font_path

        font_main = ImageFont.truetype(bold_font_path, 290)
        font_subtitle = ImageFont.truetype(font_path, 38)
    else:
        print("⚠️  使用默认字体")
        font_main = ImageFont.load_default()
        font_subtitle = ImageFont.load_default()

    # ====== 中央：主标题"小凡"和"看见" - 分两行，大间距 ======
    center_x = width / 2
    offset_y = 100  # 所有内容往上挪的距离

    # 第一行：小凡（每个字单独绘制，增加字间距）
    text1_1 = "小"
    text1_2 = "凡"
    char_spacing = 360  # 字间距（290px字体需要更大的间距）

    # 小凡 - 第一行（往上挪）
    y_line1 = height / 2 - 240 - offset_y

    x_char1 = center_x - char_spacing / 2
    x_char2 = center_x + char_spacing / 2

    # 绘制阴影
    draw.text((x_char1 + 3, y_line1 + 4), text1_1,
              fill=(0, 0, 0, 100), font=font_main, anchor="mm")
    draw.text((x_char2 + 3, y_line1 + 4), text1_2,
              fill=(0, 0, 0, 100), font=font_main, anchor="mm")

    # 绘制主文字
    draw.text((x_char1, y_line1), text1_1,
              fill=(255, 255, 255), font=font_main, anchor="mm")
    draw.text((x_char2, y_line1), text1_2,
              fill=(255, 255, 255), font=font_main, anchor="mm")

    # 第二行：看见（每个字单独绘制，增加字间距）
    text2_1 = "看"
    text2_2 = "见"
    y_line2 = height / 2 + 80 - offset_y  # 增加行间距（从 center_y + 120 改为 + 80，距离更大）

    # 绘制阴影
    draw.text((x_char1 + 3, y_line2 + 4), text2_1,
              fill=(0, 0, 0, 100), font=font_main, anchor="mm")
    draw.text((x_char2 + 3, y_line2 + 4), text2_2,
              fill=(0, 0, 0, 100), font=font_main, anchor="mm")

    # 绘制主文字
    draw.text((x_char1, y_line2), text2_1,
              fill=(255, 255, 255), font=font_main, anchor="mm")
    draw.text((x_char2, y_line2), text2_2,
              fill=(255, 255, 255), font=font_main, anchor="mm")

    # ====== 最下方：副标题 - 往上挪一些 ======
    subtitle_text = "在晨光中，遇见更好的自己"
    subtitle_y = height - 100 - offset_y - 50  # 再往上挪50px，但保持底部间距
    draw.text((center_x, subtitle_y), subtitle_text,
              fill=(255, 255, 255, 200), font=font_subtitle, anchor="mm")

    # ====== 下方：装饰线 ======（放在"看见"和副标题的中间）
    line_y = (y_line2 + subtitle_y) / 2  # 在两者之间的中点
    line_left = width / 2 - 150
    line_right = width / 2 + 150
    draw.line([(line_left, line_y), (line_right, line_y)],
              fill=(255, 255, 255, 150), width=2)

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
        print(f"📝 排版优化: 字间距60px + 行间距大 + 副标题底部")

    except Exception as e:
        print(f"❌ 生成失败: {str(e)}")
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == "__main__":
    main()
