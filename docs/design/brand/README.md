# 品牌素材（2026-11-12）

这里放的是不进小程序包的大尺寸素材，以及新旧主色的对照图。小程序里实际用的图标在 `miniprogram/assets/tenants/<租户>/`。

## 凡人共读

| 文件 | 用途 |
| --- | --- |
| `fanren/logo-1024.png` | 方形满版，上传公众平台做小程序头像（微信会自动裁成圆形） |
| `fanren/logo-144.png` | 小尺寸头像 |
| `fanren/logo-rounded-512.png` | 圆角版，用于海报、文档 |
| `fanren/logo.svg` | 矢量源文件 |
| `fanren/lockup.png` | 横版标志：徽记 + 品牌名 + 一句话 |
| `fanren/color-compare.png` | 新旧主色对照（示意图，不是小程序截图） |

- 主色：黛蓝 `#3d6fa6`（原 `#4a90e2`）。白字压在上面的对比度从 3.3:1 提到 5.2:1。
- 晨光色 `#ee9b45` 不变，仍只用于时间、进度和仪式。
- 徽记：破晓的天，太阳从摊开的书里升起，和登录页的线描徽记是同一个意思。

## 怎么改

所有图形都写在 `miniprogram/scripts/generate-brand-assets.js` 里（SVG）。

```bash
node miniprogram/scripts/generate-brand-assets.js
```

- 换主色：改 `miniprogram/config/tenants/<租户>.js` 的 `primaryColor`、`navBar.bgColor`、`tabBar.selectedColor`，运行上面的命令，再运行 `npm run tenant:reset`。
- 换图标形状：改脚本里的 `TAB_SHAPES`。
- 换 logo：改脚本里的 `logoMark()`。
- 脚本用到系统自带的宋体，需要在 macOS 上运行。

## 上线前还要做的

1. 在管理后台的租户管理里，把凡人共读的主色、导航色、Tab 选中色改成 `#3d6fa6`。不改的话，下次从后端同步租户配置会把小程序改回旧蓝色。
2. 在公众平台把小程序头像换成 `fanren/logo-1024.png`。
3. 各期次如果在后台单独选过封面色，会继续显示当时选的颜色；没选过的自动跟随新主色。
