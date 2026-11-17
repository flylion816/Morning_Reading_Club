# Change: 读伴「送一句」支持自己写一句，并轮换预设短句

## Why

读伴页「送一句」目前只有固定的四句预设。书友反馈每次打开都觉得没有自己想说的那句，天天都一样也会腻。

之前只开放预设、不开放自由输入，理由是风险更低，而且项目还没有接微信内容安全接口（见 `docs/design/miniprogram-feature-upgrade-2026-11-10.md`）。现在要开放自由输入，必须先把内容安全接上，这是这次变更里最重的一块。

## What Changes

- 送一句弹层：预设短句下面加「自己写一句」输入框，最多 30 字。写了内容就送自己写的话，没写就送选中的预设句。仍然每人每天一句，读伴当天在读伴页看到，并收到站内通知。
- 自己写的话先过微信内容安全检查（`msg_sec_check`）才保存、才通知。没通过，或检查服务暂时不可用，都不保存、不通知、不占当天名额，界面提示换一句或改选预设句；预设短句不受影响。另外拒绝链接和联系方式，防广告引流。
- 预设短句轮换：从 4 句扩到 20 句，仍分四类（在一起、读到你写的、不用赶、明天见），每类 5 种说法。每天每类按日期换一种，所以每天仍是四类各一句，措辞会变，连续两天不会重复。原来的 4 个 key 继续有效，旧版小程序照常能用。
- 数据：`BuddyPair.gifts[]` 新增可选字段 `text`；自己写的话记为 `key: 'custom'`。旧数据不动，无需迁移。
- 接口：`POST /buddies/period/:periodId/gift` 的请求体在 `messageKey` 和 `text` 里二选一；`GET /buddies/period/:periodId` 的状态里新增 `giftOptions`（今天的预设短句）。
- 规格：原先「送一句 MUST NOT 接受自由输入」和「读伴之间 MUST NOT 提供任何自由文字」都要改，见 spec 增量。

## Impact

- Affected specs: `buddy-companion`（MODIFIED：送一句）、`reading-buddies`（MODIFIED：读伴只能看到有限信息）
- Affected code:
  - 后端：`backend/src/services/buddy.service.js`、`backend/src/controllers/buddy.controller.js`、`backend/src/models/BuddyPair.js`，新增 `backend/src/services/content-security.service.js`
  - 小程序：`miniprogram/pages/buddy/`、`miniprogram/services/buddy.service.js`
  - 文档：新增一条更新说明草稿 `docs/release-notes/2026-11-17-读伴送一句更新说明.md`（上线后再发；11-15 那条已经发出，不改）
- 新增对微信 `msg_sec_check` 的依赖（用现有 access_token），必须在后端发布后用真机验证。
- 只新增可选字段，无数据迁移，不动已有数据。
- 不做：聊天或回复、举报入口、查看读伴所送话语的后台页面。

## 风险与取舍

- 读伴不都是自己邀请的，系统也会在同期等待的人里配对。开放自由文字，就有被骚扰、被引流的可能。对策叠加：内容安全检查 + 30 字上限 + 每天一句 + 不能放链接和联系方式 + 对方随时可以结束读伴。
- 检查服务不可用时，宁可送不出自己写的话，也不放过未检查的内容；用户还能选预设短句。
- 微信接口的参数和限制这次没能联网核对，实现第一步要对照官方文档（见 design.md）。
