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
    subtitle_y = height - 100 - offset_y - 80  # 再往上挪80px，但保持底部间距
    draw.text((center_x, subtitle_y), subtitle_text,
              fill=(255, 255, 255, 200), font=font_subtitle, anchor="mm")

    # ====== 下方：装饰线 ======（放在"看见"和副标题的中间，长度加倍）
    line_y = (y_line2 + subtitle_y) / 2 + 40  # 在两者之间的中点，略往下
    line_left = width / 2 - 300  # 长度变成原来的两倍
    line_right = width / 2 + 300
    draw.line([(line_left, line_y), (line_right, line_y)],
              fill=(255, 255, 255, 150), width=2)

    return img

def generate_default_image():
    """
    生成首页分享图 - 现代简洁风格
    竖排排列"凡人晨读营"，保持与 share-insight.png 一致的蓝色渐变背景
    """
    width, height = 1080, 1080
    img = Image.new('RGB', (width, height), color='#5B9FE3')
    draw = ImageDraw.Draw(img)

    # 蓝色渐变背景（与 share-insight.png 完全一致）
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
        font_main = ImageFont.truetype(font_path, 180)  # 180px
        font_sub = ImageFont.truetype(font_path, 40)    # 40px
    else:
        font_main = ImageFont.load_default()
        font_sub = ImageFont.load_default()

    # ====== 主标题：「凡人晨读营」竖排 ======
    chars = list('凡人晨读营')
    char_h = 170  # 缩小字间距到 170px（相比 180px 字体）

    # 计算起点：确保所有内容都在画布内
    center_x = width // 2
    start_y = 150  # 从150px开始

    for i, ch in enumerate(chars):
        y = start_y + i * char_h

        # 绘制阴影（黑色投影）
        draw.text((center_x + 3, y + 3), ch,
                  fill=(0, 0, 0, 50), font=font_main, anchor='mm')

        # 绘制主文字（白色）
        draw.text((center_x, y), ch,
                  fill=(255, 255, 255), font=font_main, anchor='mm')

    # ====== 分隔线（轻微） ======
    last_char_y = start_y + (len(chars) - 1) * char_h
    line_y = last_char_y + 60  # 最后一个字下方 60px
    draw.line(
        [(width // 2 - 240, line_y), (width // 2 + 240, line_y)],
        fill=(255, 255, 255),
        width=2
    )

    # ====== 副标题：「每天晨读 · 遇见更好的自己」横排 ======
    subtitle = '每天晨读 · 遇见更好的自己'
    sub_y = line_y + 60  # 分隔线下方 60px

    # 绘制阴影
    draw.text((width // 2 + 2, sub_y + 2), subtitle,
              fill=(0, 0, 0, 50), font=font_sub, anchor='mm')

    # 绘制主文字（白色）
    draw.text((width // 2, sub_y), subtitle,
              fill=(255, 255, 255), font=font_sub, anchor='mm')

    return img

def main():
    try:
        print("🎨 生成分享图片...")

        # 确定输出目录
        base_dir = os.path.dirname(os.path.abspath(__file__))
        assets_dir = os.path.join(base_dir, "miniprogram", "assets", "images")

        # 创建目录
        os.makedirs(assets_dir, exist_ok=True)

        # 生成 share-insight.png（小凡看见 - 蓝色系）
        print("\n📱 生成小凡看见分享图 (share-insight.png)...")
        img1 = generate_share_image()
        path1 = os.path.join(assets_dir, "share-insight.png")
        img1.save(path1, "PNG")
        size1 = os.path.getsize(path1) / 1024
        print(f"✅ 已生成: {path1}")
        print(f"   尺寸: 1080x1080 px | 大小: {size1:.2f} KB")

        # 生成 share-default.png（首页 - 清晨日出主题）
        print("\n🌅 生成首页分享图 (share-default.png)...")
        img2 = generate_default_image()
        path2 = os.path.join(assets_dir, "share-default.png")
        img2.save(path2, "PNG")
        size2 = os.path.getsize(path2) / 1024
        print(f"✅ 已生成: {path2}")
        print(f"   尺寸: 1080x1080 px | 大小: {size2:.2f} KB")

        print("\n" + "="*60)
        print("🎉 所有分享图片生成完成！")
        print("="*60)

    except Exception as e:
        print(f"❌ 生成失败: {str(e)}")
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == "__main__":
    main()
