## ADDED Requirements

### Requirement: 打卡心情取值
系统 SHALL 允许打卡携带可选心情 happy、calm、thoughtful、inspired、low、other（依次表示晴、多云、微风、朝霞、小雨、雾）；未选择时 MUST NOT 存储心情。

#### Scenario: 非法心情被拒绝
- **WHEN** 用户创建或编辑打卡时传入不在枚举内的 mood
- **THEN** 系统 SHALL 返回 400 且不保存

#### Scenario: 不选心情
- **WHEN** 用户创建打卡时不传 mood
- **THEN** 打卡 SHALL 创建成功且 mood 为空

### Requirement: 心情来源标记
系统 MUST 仅在创建或更新打卡的请求体同时带 `moodSource: 'picker'` 时才采纳 `mood`；没有该标记时 SHALL 忽略请求里的 mood（创建时不存，更新时不改动已有值）。显式清除心情 SHALL 通过 `moodSource: 'picker'` 且 `mood` 为 null 或空串实现。

#### Scenario: 旧版客户端写死 happy
- **WHEN** 请求体带 `mood: 'happy'` 但没有 `moodSource`
- **THEN** 系统 SHALL 忽略该 mood，不保存也不覆盖已有心情

#### Scenario: 选择器提交
- **WHEN** 请求体带 `moodSource: 'picker'` 和合法 mood
- **THEN** 系统 SHALL 保存该 mood

#### Scenario: 清除心情
- **WHEN** 请求体带 `moodSource: 'picker'` 且 mood 为 null 或空串
- **THEN** 系统 SHALL 清除该打卡的心情

### Requirement: 历史心情不可信
系统 SHALL 在读出心情时，把早于 `MOOD_VALID_SINCE` 的打卡视为未记录（返回 null），且 MUST NOT 修改任何已存数据。

#### Scenario: 旧打卡读出心情
- **WHEN** 本人查看打卡时间早于 `MOOD_VALID_SINCE` 的打卡
- **THEN** 返回的 mood SHALL 为 null

### Requirement: 心情对营里书友公开显示
系统 SHALL 在营里可见的打卡列表、搜索与详情中返回 mood，且 MUST 经过「生效时间」规则过滤（早于 `MOOD_VALID_SINCE` 或非法值返回 null）。选择心情时界面 MUST 明示「营里的书友都能看到」。

> 2026-11-15 变更：原为「仅本人可见」，产品决定改为营里公开，显示在打卡卡片右上角。管理后台出口仍不返回 mood。

#### Scenario: 他人查看打卡详情
- **WHEN** 用户查看他人的打卡详情
- **THEN** 返回的 mood SHALL 为该打卡的可信心情，没选或为旧数据时为 null

#### Scenario: 广场与搜索列表
- **WHEN** 用户查看期次打卡广场或搜索打卡
- **THEN** 每条打卡 SHALL 带可信 mood，旧数据与非法值为 null

#### Scenario: 管理后台
- **WHEN** 管理端读取或更新打卡
- **THEN** 返回的打卡对象 SHALL 不含 mood 字段

### Requirement: 课程心情汇总
系统 SHALL 提供 `GET /checkins/section/:sectionId/mood-summary`，返回该课程全部可信心情的匿名计数，不按自然日截断；调用者 MUST 对该课程所属期次具有社群权限；有效样本为 0 条时 `counts` SHALL 为 null（2026-11-15 起不再设 3 条下限）；响应 MUST NOT 包含任何用户标识。

#### Scenario: 样本足够
- **WHEN** 课程有效心情不少于 1 条
- **THEN** 返回 `{ date, total, counts }`，counts 含六种心情的计数

#### Scenario: 样本不足
- **WHEN** 课程没有任何有效心情
- **THEN** 返回 `counts: null`

#### Scenario: 无社群权限
- **WHEN** 用户未报名该课程所属期次
- **THEN** 系统 SHALL 返回 403

### Requirement: 打卡日历心情
`GET /checkins/user/calendar` SHALL 额外返回 `moods`，仅包含该月有可信心情的自然日，同日多次打卡取最后一次有心情的。

#### Scenario: 同日多次打卡
- **WHEN** 某日有两次带心情的打卡
- **THEN** moods 中该日 SHALL 为较晚一次的心情
