# TabBar 图标说明

本目录包含微信小程序TabBar所需的图标文件。

## 图标列表

- `home.svg` - 首页图标（未选中状态，灰色 #999999）
- `home-active.svg` - 首页图标（选中状态，蓝色 #4a90e2）
- `user.svg` - 个人中心图标（未选中状态，灰色 #999999）
- `user-active.svg` - 个人中心图标（选中状态，蓝色 #4a90e2）

## ⚠️ 重要提示

微信小程序TabBar**只支持PNG和JPG格式**，不支持SVG格式。

当前提供的是SVG源文件，需要转换为PNG格式才能在小程序中使用。

## 转换方法

### 方法1：使用在线工具转换

1. 访问 [CloudConvert](https://cloudconvert.com/svg-to-png) 或 [SVG转PNG工具](https://svgtopng.com/)
2. 上传SVG文件
3. 设置输出尺寸为 **81x81 像素**
4. 下载转换后的PNG文件

### 方法2：使用命令行工具（推荐）

安装 ImageMagick 或 Inkscape：

```bash
# macOS
brew install imagemagick

# 转换所有SVG为PNG
for file in *.svg; do
  convert -background none -resize 81x81 "$file" "${file%.svg}.png"
done
```

### 方法3：使用设计工具

使用 Figma、Sketch、Adobe Illustrator 等设计工具：

1. 打开SVG文件
2. 导出为PNG格式
3. 设置导出尺寸为 81x81px，3x（243x243px）

## 规格要求

根据[微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html#tabbar)：

- **尺寸**: 建议 81px × 81px
- **格式**: PNG、JPG
- **大小**: 不超过 40KB
- **数量**: 每个tab需要2张图标（普通态和选中态）

## 使用说明

转换完成后，将PNG文件放在本目录下，并确保在 `app.json` 中正确引用：

```json
{
  "tabBar": {
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "首页",
        "iconPath": "assets/icons/home.png",
        "selectedIconPath": "assets/icons/home-active.png"
      },
      {
        "pagePath": "pages/profile/profile",
        "text": "我的",
        "iconPath": "assets/icons/user.png",
        "selectedIconPath": "assets/icons/user-active.png"
      }
    ]
  }
}
```

## 图标设计说明

- **首页图标**：采用房屋造型，符合用户对"首页"的认知
- **个人中心图标**：采用用户头像造型，清晰表达"我的"概念
- **颜色规范**：
  - 未选中：#999999（中性灰）
  - 选中：#4a90e2（品牌蓝色）

## 自定义图标

如需使用自定义图标，请确保：

1. 图标风格统一（线性或面性）
2. 视觉重量一致
3. 符合微信小程序设计规范
4. 在不同设备上清晰可辨
