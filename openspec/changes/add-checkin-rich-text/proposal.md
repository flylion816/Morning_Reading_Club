# Change: Add rich text editing for checkins

## Why
每日打卡目前只能输入纯文本，用户从文档或笔记复制带格式内容时会丢失加粗、斜体、颜色和段落结构。课程详情和打卡详情已有富文本展示能力，打卡编辑链路需要补齐富文本输入和存储。

## What Changes
- 小程序每日打卡页使用原生富文本编辑器，支持加粗、斜体、下划线、标题、列表、字体颜色、撤销/重做和带格式粘贴。
- 打卡提交和编辑同时保存纯文本 `note` 与富文本 `contentHtml`，保留现有搜索、分享、统计兼容性。
- 打卡列表、详情和本地兜底展示优先渲染 `contentHtml`，没有富文本时回退 `note`。
- 后端对 `contentHtml` 做白名单清洗和长度限制，禁止脚本、事件属性和危险协议。

## Impact
- Affected specs: checkin
- Affected code: `miniprogram/pages/checkin`, `miniprogram/pages/course-detail`, `backend/src/models/Checkin.js`, `backend/src/controllers/checkin.controller.js`
