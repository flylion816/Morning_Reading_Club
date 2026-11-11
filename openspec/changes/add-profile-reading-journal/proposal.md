# Change: 小程序「晨光」第三批——手账与信

## Why

「我的」现在只是设置页，23 天的坚持没有地方被看见；小凡看见是整个产品情感最重的内容，却只是带彩色左边框的列表项。同时，「累计打卡 N 天」实际是打卡条数（打卡不限每天一次，一天两次会算成两天），连续天数会被重复累加、断卡后要等到下次打卡才归零，在把这些数字放大展示之前必须先校准口径。第三批把「我的」做成晨读手账，把小凡看见做成一封信，并收尾课程详情、沉浸阅读、「在场」与分包页面。依赖第一、二批。

## What Changes

- 「我的」页头显示头像、昵称与可点击修改的签名（签名从首页移入）；新增三个衬线数字（累计、连续、最长）、当月晨读日历、共读足迹印章墙；原设置项保留分组并加线性图标。
- **后端（只读计算）**：累计天数与连续天数按自然日去重，在读取时计算而不迁移数据；新增按月返回打卡日期的只读接口。
- 小凡看见：列表项改为信封（收信人、期次、日期、未读火漆点），详情页改为信纸（衬线正文、更大行距、落款「小凡」与日期），首页有未读时显示「小凡给你留了一封信」；弹幕、朗读、长图分享等现有功能位置不变。
- 课程详情：顶部加细的「九步」进度（静问学读看想记摘说），滚动联动高亮并支持点击跳转；底部栏去掉大号「返回」，「去打卡」占满并附播客小按钮。
- 沉浸阅读：「Aa」扩成设置面板，支持字号、字体（黑体 / 宋体）、纸色（暖白 / 米黄 / 夜间）。
- 「在场」：日期与地点做成照片角上的邮戳，emoji 换成印章与线性图标，印记标题使用衬线。
- 分包页面收尾：把第一、二批的令牌、图标、文案规则补齐到剩余分包页面。
- 不改租户主色与 logo；不重写业务逻辑；不做全局深色模式。

## Impact

- Affected specs: `miniprogram-reading-journal`（新增）
- Affected code:
  - `miniprogram/pages/profile`
  - `miniprogram/pages/insights`（小凡看见列表与详情）及首页小凡看见板块
  - `miniprogram/pages/course-detail`、`miniprogram/pages/reading-mode`
  - 「在场」相关页面与分包页面样式
  - `miniprogram/services` 与 `miniprogram/utils`（统计与日历数据请求）
  - `backend/src/controllers/user.controller.js`（统计口径，约第 39 行 `Checkin.countDocuments` 一带）
  - `backend/src/controllers/checkin.controller.js`（连续天数相关逻辑，及新增按月日期接口）
  - `backend/src/routes`（新增只读路由并挂载认证中间件）
  - `backend/tests`、`miniprogram/__tests__`
- 依赖：`update-miniprogram-warm-paper-tokens`、`redesign-home-morning-hero`
- 后端仅新增只读接口并调整读取时计算口径，**无数据模型变化、无数据迁移**。
