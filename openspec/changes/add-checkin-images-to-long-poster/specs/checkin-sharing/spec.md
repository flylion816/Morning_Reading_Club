## ADDED Requirements

### Requirement: Check-in long posters include ordered images

小程序 SHALL 在生成打卡长图时，将打卡 `images` 按详情页顺序绘制在正文之后、课节 hash-tag 之前；每张图片 MUST 保留完整内容和原始宽高比，常规图片使用与正文相同的内容宽度。

#### Scenario: Check-in has multiple images

- **WHEN** 用户在打卡详情点击分享并选择长图，且打卡包含多张图片
- **THEN** 长图按图片数组顺序显示所有可加载图片
- **AND** 图片位于正文与 `#第N课 ...` 标签之间
- **AND** 每张图片按原始比例展开，不使用详情页的缩略图裁剪效果

#### Scenario: Check-in has no images

- **WHEN** 用户生成不含图片的打卡长图
- **THEN** 长图继续按原有文字、标签、课程信息和底部二维码布局生成

### Requirement: Image poster generation protects canvas memory

小程序 SHALL 以受控方式准备和导出含图片的长图，避免同时保留多张高分辨率解码图片；图片尺寸异常或图片批次过长时 MUST 在保留完整图片内容的前提下按比例缩小或降低导出清晰度。

#### Scenario: Large image batch

- **WHEN** 打卡包含多张高分辨率或超长比例图片
- **THEN** 小程序按顺序处理图片并控制 canvas 的 DPR、图片源尺寸或导出比例
- **AND** 长图不会因为一次性解码所有原图而主动保留整批图片对象
- **AND** 已绘制的图片不被裁剪或拉伸

#### Scenario: One image cannot be prepared

- **WHEN** 某一张图片无法获取尺寸或无法加载到 canvas
- **THEN** 小程序跳过该图片并继续生成长图
- **AND** 正文、标签和其他可加载图片仍然可用

#### Scenario: Long-poster export needs fallback

- **WHEN** 含图片长图首次导出因 canvas 尺寸或内存失败
- **THEN** 小程序降低导出清晰度重试
- **AND** 必要时只截取超长正文，保留已纳入布局的图片和标签
