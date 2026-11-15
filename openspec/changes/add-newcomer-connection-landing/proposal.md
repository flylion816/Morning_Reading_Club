# Change: 新人连接落地页与接待跟进

## Why

日签分享出去后，小程序码和转发卡片都落到小程序首页：扫码的人不知道该做什么，分享人也无从知道谁被自己带进来。目标不是“多一个注册”，而是让看到好内容的人被对的书友接住，判断是否同频。界面稿见 `docs/design/landing-page-connect-preview-2026-11-14.html`，已确认定稿。

## What Changes

- 新增落地页 `pages/landing/landing`：日签、分享人、“想了解一下”留言弹层（原因 + 手机号 + 授权）、提交成功页，以及留过言、老书友、打不开等状态。访客不需要先登录，提交时静默登录并完成注册。
- 日签分享路径改为落地页并带分享人；登录用户的海报使用专属小程序码（`scene = i=<分享人id>&s=d`），失败时回退通用码。
- 新增后端 `NewcomerLead`（一人一条线索）与接口：落地页信息（匿名可访问）、提交、我的线索、专属小程序码、接待组列表/详情/认领/改状态、接待人开关。
- 新增接待组页面 `pages/admin-leads`（列表、详情），入口在管理工作台，仅接待组成员可见。
- 接待组身份由管理后台「用户管理」配置（加入/移出接待组、只看接待组），小程序里不能自行开关；只有接待组成员能看线索和完整手机号，其他管理员不能。接待组成员必须是小程序管理员，取消管理员时自动移出。
- 留言通知：给开启了接待开关的管理员发站内通知。
- `requireLogin` 弹窗改为“我是老书友 / 想了解一下”两条路，不再直接跳登录页。
- 原邀请页 `pages/invite` 保留，服务已经想报名的人。
- `User` 新增 `isNewcomerReceptionist`，`Notification` 新增类型 `newcomer_lead`；管理后台用户更新接口接受该字段，用户列表支持 `receptionist=true` 筛选。

## Impact

- Affected specs: newcomer-connection（新增）
- Affected code: backend/src/models/NewcomerLead.js、controllers/newcomerLead.controller.js、routes/newcomerLead.routes.js、models/User.js、models/Notification.js、app.js；miniprogram/pages/landing、pages/admin-leads、pages/daily-card、pages/index、pages/admin-workbench、utils/landing-share.js、utils/silent-login.js、utils/require-login.js、services/newcomer-lead.service.js、app.json
- 数据库：新增集合 `newcomerleads`，不改动、不迁移既有数据，不需要任何初始化脚本。
- 不含（后续）：书友的声音精选与后台管理、试读页、微信订阅消息提醒接待组。
