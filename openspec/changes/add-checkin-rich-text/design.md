## Context
小程序课程详情页通过 `rich-text` 展示课程 HTML，打卡详情页也已经有 `contentHtml` 展示分支，但每日打卡编辑页仍使用 `textarea`。微信小程序原生 `editor` 组件可以保留粘贴进来的常见富文本结构，并通过 `EditorContext.getContents()` 输出 `html` 和 `text`。

## Goals / Non-Goals
- Goals: 打卡页支持常用富文本格式；复制带格式内容后尽量保留格式；历史纯文本打卡继续正常展示、搜索、分享和编辑。
- Goals: 富文本内容在服务端清洗后保存，避免脚本和危险链接进入社区展示。
- Non-Goals: 不引入第三方小程序富文本框架；不在本次支持自定义字体族、字号任意值或富文本内图片上传。
- Non-Goals: 不改变图片上传区、可见范围和打卡权限规则。

## Decisions
- Decision: `note` 继续存纯文本，新增 `contentHtml` 存 HTML。
  原因：现有搜索、日记统计、分享文本和长图生成都依赖纯文本，保留 `note` 可以降低兼容风险。
- Decision: 在打卡页直接使用小程序原生 `editor` 和页面内工具栏。
  原因：项目是微信小程序原生框架，已有 `insight-edit` 使用同一组件 API；直接放在页面内可以避免开发者工具因组件路径或缓存导致编辑区空白。
- Decision: 后端采用轻量白名单清洗。
  原因：当前后端没有 HTML sanitizer 依赖；本次只允许小程序 `rich-text` 支持的常见标签和有限样式，足够覆盖加粗、斜体、颜色、列表和段落。

## Risks / Trade-offs
- 风险：不同微信版本对粘贴富文本保留程度不同。
  Mitigation: 编辑器保留原生粘贴结果，并提供工具栏手动补格式；保存时同时落纯文本。
- 风险：HTML 长度和纯文本长度不同，带大量标签时可能超限。
  Mitigation: 纯文本仍限制 3000 字，HTML 单独限制 20000 字。
- 风险：社区列表折叠高度按纯文本估算，富文本实际行数可能略有偏差。
  Mitigation: 仍以 `note` 估算折叠，详情页可展开查看完整富文本。

## Migration Plan
无需数据迁移。历史打卡没有 `contentHtml` 时继续展示 `note`；用户编辑历史纯文本打卡时，编辑器把 `note` 转为基础段落 HTML 后保存。

## Open Questions
- 暂无。本次按原生编辑器 + `note`/`contentHtml` 双字段推进。
