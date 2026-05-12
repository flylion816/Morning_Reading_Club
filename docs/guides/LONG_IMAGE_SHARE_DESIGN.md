# 长图分享设计说明

> 同步日期：2026-05-12  
> 覆盖页面：打卡详情 `course-detail`，小凡看见详情 `insight-detail`

## 1. 打卡详情长图

### 1.1 入口

- 页面：`miniprogram/pages/course-detail/course-detail.wxml`
- 触发：打卡详情模式下点击“长图分享”
- 状态字段：`posterGenerating`、`posterGalleryVisible`、`posterGalleryItems`、`selectedPoster`

### 1.2 模板与生成策略

- 模板定义：`POSTER_STYLE_PRESETS`
- 当前模板：青岚、暮紫、晴空、留白
- 生成策略：
  - 打开模板面板时只生成第一个模板；
  - 未生成模板显示轻量骨架缩略图；
  - 点击模板时按需生成真实长图；
  - 生成成功后替换缩略图并更新选中项。

### 1.3 长文处理

- 默认优先生成完整正文。
- 若完整长图导出失败，使用 `maxHeight` 生成降级截断版。
- 截断版追加“进入小程序查看完整内容”。
- 超长导出使用较低 scale 和 JPG，降低微信 canvas 超时/内存失败概率。

### 1.4 交互能力

- 保存：`wx.saveImageToPhotosAlbum`
- 预览：`wx.previewImage`
- 分享：优先 `wx.showShareImageMenu`

## 2. 小凡看见长图

### 2.1 入口

- 页面：`miniprogram/pages/insight-detail/insight-detail.wxml`
- 按钮：返回、长图分享、微信好友；不再单独暴露“完整长图”入口。
- 画布：`#insightLongImageCanvas`

### 2.2 内容解析

内容来源可能是 Markdown 渲染后的 HTML。长图生成前会进行解析：

- `<p>`：普通段落
- `<li>`：列表项，渲染为 `• ` 前缀
- `<blockquote>` 或含 `border-left` 的块：引用段落
- `<div>`、`h1-h6`：普通块
- `<strong>`、`<b>`：加粗 run

### 2.3 换行规则

- 先按 HTML 块拆成段落。
- 每段内按普通/加粗 run 切分。
- canvas 测量文本宽度。
- 若当前行已接近满宽，下一 styled run 的首字符放不下，则先换行再绘制，避免文字越界。

### 2.4 导出策略

- `hd` 模式按高度选择 DPR，短图更清晰，长图降低倍率。
- `full` 模式使用 1 倍 JPG，优先保证完整导出。
- 导出失败时会降低 scale 重试。

## 3. 测试覆盖

- `miniprogram/__tests__/pages/course-detail.spec.js`
  - 打卡长图快照构建
  - 长文完整/截断策略
  - 模板懒生成
  - 点击模板按需生成
- `miniprogram/__tests__/pages/insight-detail.spec.js`
  - 段落 + 列表不丢失
  - 加粗/普通边界换行不越界

## 4. 后续优化

- 若需要更接近鹅打卡缩略图，可引入低成本 canvas 缩略图生成，但要避免重新引入“打开面板生成全部模板”的性能问题。
- 若长图内容继续变长，建议引入分页式预览或服务端生成图片。
