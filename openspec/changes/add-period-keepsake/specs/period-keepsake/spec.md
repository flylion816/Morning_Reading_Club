## ADDED Requirements

### Requirement: 本人期次纪念册接口
系统 SHALL 提供 `GET /keepsakes/period/:periodId`，仅返回当前登录用户在该期的数据，且 MUST 要求该用户已报名该期。

#### Scenario: 未报名
- **WHEN** 用户请求一个没有报名的期次
- **THEN** 系统 MUST 返回 403，且不返回任何数据

#### Scenario: 期次未结束
- **WHEN** 期次未结束且今天未到最后一天
- **THEN** 系统 SHALL 仅返回 period、ready 为 false 与 daysLeft

#### Scenario: 期次已结束
- **WHEN** 期次已结束或今天已到最后一天
- **THEN** 系统 SHALL 返回打卡天数（按东八区自然日去重）、字数、晨读分钟数、最早打卡、心情、最受赞打卡、书友、小凡看见、摘抄、已拆开的信与看见卡数量

### Requirement: 数据缺失容错
系统 MUST NOT 因某一块数据缺失而使整个接口失败。

#### Scenario: 可选模型不存在
- **WHEN** Highlight、Letter 或 SeenCard 模型尚未注册
- **THEN** 系统 SHALL 分别返回空数组、null 与 0

### Requirement: 心情口径
系统 SHALL 仅统计可信心情（早于心情生效时间的打卡视为未记录）。

#### Scenario: 旧打卡
- **WHEN** 打卡时间早于生效时间
- **THEN** 该打卡 MUST NOT 出现在 moods 中

### Requirement: 纪念册页面
小程序 SHALL 提供纵向翻页的纪念册页面，没有数据的页 MUST 自动跳过。

#### Scenario: 未结营
- **WHEN** 接口返回 ready 为 false
- **THEN** 页面 SHALL 显示「还有 N 天结营」的提示

#### Scenario: 分享
- **WHEN** 用户点击封底的邀请按钮
- **THEN** 页面 SHALL 通过 open-type="share" 分享，标题为「我在{品牌名}的 {N} 天」
