# Change: Include check-in images in long posters

## Why

打卡详情页已经会按顺序展示正文、图片和课节标签，但“分享 → 长图”当前只绘制文字正文，图片会丢失。带图片的打卡需要在长图中保留完整阅读顺序，方便用户分享完整内容。

## What Changes

- 长图在正文之后、`#第N课 ...` 标签之前绘制打卡图片，图片顺序与详情页一致。
- 图片使用可绘制到 canvas 的完整内容，按原图比例缩放；常规图片使用与正文相同的内容宽度，不裁剪成缩略图。
- 图片按顺序逐张准备和绘制，并对超大图片源、长画布和导出失败做降级，避免一次性保留多张高分辨率图片造成内存压力。
- 图片加载失败时跳过失败图片并继续生成文字长图；不改动打卡接口、数据库字段和详情页展示。

## Impact

- Affected specs: `checkin-sharing`
- Affected code: `miniprogram/pages/course-detail/course-detail.js`
- Affected tests: `miniprogram/__tests__/pages/course-detail.spec.js`
- Database/API: 无变更
