## Why
晨读是一个人的事，容易觉得孤单。让读者知道“此刻有人和你一起读”，是看见而不是评比。

## What Changes
- 新增 ReadingPing 模型（30 分钟 TTL，只用于“此刻在读”，不是学习记录）。
- 新增 `/api/v1/presence` 接口：上报阅读、今日同行人数、今日名次、期次来处。
- 新增小程序 `services/presence.service.js`；页面接入留待下一轮。

## Impact
- Affected specs: reading-presence（新增）
- Affected code: backend/src/models/ReadingPing.js、controllers/presence.controller.js、routes/presence.routes.js、miniprogram/services/presence.service.js
- 总控需在 app.js 挂载 `/api/v1/presence`。
