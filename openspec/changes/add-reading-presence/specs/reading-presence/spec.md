## ADDED Requirements

### Requirement: 阅读在场上报
系统 SHALL 允许已报名用户上报正在阅读某课，同一用户同一课只保留一条记录，且记录 MUST 在 30 分钟后自动清除。

#### Scenario: 已报名用户上报
- **WHEN** 已报名用户 POST /presence/reading 并带有效 sectionId
- **THEN** 系统 SHALL 更新该用户该课的上报时间并返回 ok。

#### Scenario: 短时间重复上报
- **WHEN** 同一用户同一课 60 秒内再次上报
- **THEN** 系统 SHALL 直接返回成功且 MUST NOT 写库。

#### Scenario: 未报名
- **WHEN** 未报名该期的用户上报
- **THEN** 系统 MUST 拒绝并返回 403。

### Requirement: 今日同行人数
系统 SHALL 返回该期此刻在读、今日读完、今日打卡的不同用户数，按东八区自然日统计；任一项少于 3 时 MUST 返回 null。

#### Scenario: 人数足够
- **WHEN** 已报名用户查询 /presence/today 且各项不少于 3
- **THEN** 系统 SHALL 返回三项具体人数。

#### Scenario: 人数太少
- **WHEN** 某项人数少于 3
- **THEN** 该项 MUST 返回 null。

### Requirement: 今日名次
系统 SHALL 返回当前用户今天在某课读完或打卡的先后名次，按用户去重。

#### Scenario: 已有记录
- **WHEN** 用户今天已读完该课并查询 type=reading
- **THEN** 系统 SHALL 返回其名次。

#### Scenario: 今天还没有记录
- **WHEN** 用户今天没有对应记录
- **THEN** rank MUST 为 null。

### Requirement: 期次来处
系统 SHALL 返回该期有效报名人数与填写的不同省份数，省份数少于 2 时 MUST 返回 null，且 MUST NOT 返回名单或具体省份分布。

#### Scenario: 省份足够
- **WHEN** 已报名用户查询来处且省份数不少于 2
- **THEN** 系统 SHALL 返回 memberCount 与 provinceCount。
