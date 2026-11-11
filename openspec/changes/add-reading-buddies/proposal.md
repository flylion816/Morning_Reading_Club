## Why
晨读营里的人常常一个人读。功能方案第五节第 10 项提出“读伴”：自愿结成一对，只互相看见今天读了没、记了没，再加一次轻轻的“轻拍”。它不做聊天、不做排名，保持克制。

## What Changes
- 新增集合 BuddyRequest（等待）与 BuddyPair（配对），均带 tenantId；配对用唯一索引防并发重复。
- 新增接口（前缀 /api/v1/buddies）：GET /period/:periodId、POST /period/:periodId/join、/cancel、/nudge、/leave。
- 轻拍给对方发一条 buddy_nudge 站内通知；不发订阅消息。
- 新增小程序服务 services/buddy.service.js 与页面 pages/buddy/buddy（参数 periodId）。
- 不改已有页面；首页入口由后续变更接入。

## Impact
- Affected specs: reading-buddies（新增 capability）
- Affected code: backend/src/models/BuddyPair.js、BuddyRequest.js；backend/src/services/buddy.service.js；backend/src/controllers/buddy.controller.js；backend/src/routes/buddy.routes.js；miniprogram/services/buddy.service.js；miniprogram/pages/buddy/
- 只新增集合与接口，无数据迁移。上线前需由总控在 app.js 挂载路由并在 app.json 注册页面。
