# 变更：增加沉浸阅读完成庆祝

## Why
当前沉浸阅读已经支持专注阅读和“分享此刻”，但用户完整、耐心读完后没有被及时看见。增加一个安静、不打扰的完成庆祝，可以在不遮挡最后一段内容的前提下，强化“认真读完很好、今天又前进了一步”的正反馈。

## What Changes
- 在沉浸阅读中识别一次有效完整阅读：用户从开头进入，逐步向下滑到末尾，本次阅读总时长超过 1 分钟，并在最后一段定位停留 5 秒。
- 在最后一段下方展示不阻塞操作的完成提示，包含本次阅读时长和鼓励文案。
- 增加一排克制的底部烟花效果，位置靠下，不遮挡阅读内容和底部工具栏。
- 完成阅读后把该课节的阅读完成状态保存到服务器，并保留本地兜底，用于首页“去晨读/已晨读”入口和期次课程列表中的单日完成标记。
- 每次页面会话最多触发一次庆祝；快速跳到底部、从中间恢复阅读、短停留访问不触发。

## Impact
- 影响规格：`immersive-reading`
- 影响代码：`backend/src/models/UserReadingCompletion.js`、`backend/src/controllers/section.controller.js`、`backend/src/routes/section.routes.js`、`miniprogram/services/course.service.js`、`miniprogram/utils/reading-completion.js`、`miniprogram/pages/reading-mode/*`、`miniprogram/pages/profile/*`、`miniprogram/pages/courses/*`、相关测试
