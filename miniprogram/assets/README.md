# 静态资源说明

本目录存放小程序所需的静态资源文件。

## 目录结构

```
assets/
├── images/          # 图片资源
│   ├── share-default.png        # 分享默认图 (建议尺寸: 500x400px)
│   ├── avatar-default.png       # 默认头像 (建议尺寸: 200x200px)
│   ├── empty-course.png         # 课程列表空状态图 (建议尺寸: 300x300px)
│   ├── empty-insight.png        # 反馈列表空状态图 (建议尺寸: 300x300px)
│   ├── empty-comment.png        # 评论空状态图 (建议尺寸: 300x300px)
│   ├── banner-bg.png            # Banner背景图 (建议尺寸: 750x300px)
│   └── logo.png                 # 应用Logo (建议尺寸: 200x200px)
│
└── icons/           # 图标资源
    ├── home.png                 # TabBar首页图标-未选中 (必需, 尺寸: 81x81px)
    ├── home-active.png          # TabBar首页图标-选中 (必需, 尺寸: 81x81px)
    ├── user.png                 # TabBar我的图标-未选中 (必需, 尺寸: 81x81px)
    └── user-active.png          # TabBar我的图标-选中 (必需, 尺寸: 81x81px)
```

## 注意事项

### TabBar 图标

- **尺寸要求**: 建议 81x81px (推荐 3倍图)
- **格式要求**: PNG 格式,支持透明背景
- **大小限制**: 每个图标不超过 40KB
- **必需文件**: home.png, home-active.png, user.png, user-active.png

### 其他图片

- **格式**: 支持 PNG, JPG, GIF, WebP
- **优化**: 建议使用图片压缩工具优化文件大小
- **命名**: 使用小写字母和连字符,如 `banner-bg.png`

### 临时占位方案

在正式图标准备好之前,可以暂时使用以下方案：

1. 使用纯色图标
2. 使用 emoji 表情
3. 使用在线图标生成工具

## 图标生成建议

### 在线工具

- [iconfont](https://www.iconfont.cn/) - 阿里图标库
- [Canva](https://www.canva.com/) - 在线设计工具
- [Figma](https://www.figma.com/) - 设计协作工具

### 设计规范

- 图标风格统一,使用线性或面性图标
- 选中状态使用品牌色填充 (#4a90e2)
- 未选中状态使用灰色 (#999999)
- 保持图标简洁清晰,易于识别

## 更新日志

- 2025-01-12: 创建资源目录结构
