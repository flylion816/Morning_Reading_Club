# Change: 打卡「心情天气」后端与服务层

## Why
打卡页要让人用一种天气记下当天的心境，并在日历上回看、在课程里看到匿名的“今天大家的天气”。此前小程序把 mood 写死为 `happy`，历史数据不可信，需要在读出时兜住。

## What Changes
- `Checkin.mood` 枚举新增 `low`，可空；展示含义：happy 晴、calm 多云、thoughtful 微风、inspired 朝霞、low 小雨、other 雾。创建/编辑校验取值，非法值返回 400。
- 新增集中常量 `MOOD_VALID_SINCE`（`2026-11-11T00:00:00+08:00`，`backend/src/utils/checkin-mood.js`）；早于该时间的打卡，读出心情一律为 `null`，不改存量数据。
- 新增 `GET /checkins/section/:sectionId/mood-summary`：课程维度匿名心情汇总，不按自然日截断；没有有效样本时 `counts` 为 `null`（2026-11-15 起不再设 3 条下限）。
- `GET /checkins/user/calendar` 增加 `moods`。
- 提交/更新打卡只有带 `moodSource: 'picker'` 才采纳 mood（旧客户端写死的 happy 被忽略）。
- 心情对营里书友公开（2026-11-15 由「仅本人可见」改为公开）：营里可见的列表、搜索与详情返回经生效时间过滤的 `mood`，显示在打卡卡片右上角；管理后台仍不返回。
- 小程序：`checkin.service.js` 新增 `getSectionMoodSummary`；新增 `utils/mood.js` 心情选项常量。

## Impact
- Affected specs: checkin-mood（新增）
- Affected code: backend Checkin 模型/控制器/路由、`utils/checkin-mood.js`、`miniprogram/services/checkin.service.js`、`miniprogram/utils/mood.js`
- 无数据迁移。上线前需确认 `MOOD_VALID_SINCE` 与实际上线日期一致。
