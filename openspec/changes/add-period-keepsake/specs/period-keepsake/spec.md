## ADDED Requirements

### Requirement: 本人期次纪念册接口
系统 SHALL 提供 `GET /keepsakes/period/:periodId`，仅返回当前登录用户在该期的数据，且 MUST 要求该用户已报名该期。

#### Scenario: 未报名
- **WHEN** 用户请求一个没有报名的期次
- **THEN** 系统 MUST 返回 403，且不返回任何数据

#### Scenario: 期次未开营
- **WHEN** 今天早于期次开始日
- **THEN** 系统 SHALL 仅返回 period、ready 为 false、notStarted 为 true 与 daysLeft

#### Scenario: 期次已开营
- **WHEN** 期次已开营（进行中或已结束）
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

### Requirement: 营期中可翻阅
纪念册接口 SHALL 在期次开营后即返回内容，并用 `finished` 标明是否已结营；未开营时 MUST 只返回期次信息与 `notStarted`。

#### Scenario: 营期进行中
- **WHEN** 已报名用户在开营后、结营前请求本期纪念册
- **THEN** 返回 `ready: true`、`finished: false` 和距结营的天数，小程序封面显示「还在路上」，末页不显示结营致谢

#### Scenario: 尚未开营
- **WHEN** 今天早于期次开始日
- **THEN** 返回 `ready: false`、`notStarted: true`，小程序提示开营后才有内容

### Requirement: 分章与完整内容
纪念册 SHALL 按「我写下的、每一天、同行的人、写给自己的、小凡的话、分享实录」分章展示，没有内容的章 MUST 不出现。

#### Scenario: 每一天的目录
- **WHEN** 用户在本期写过打卡
- **THEN** 「每一天」按时间从早到晚列出每篇打卡的日期、课程名和一句摘录，点开进入对应课程页

#### Scenario: 读伴不泄露身份标识
- **WHEN** 用户本期有过读伴
- **THEN** 只返回读伴的昵称、头像和同行天数，MUST NOT 返回对方的用户 ID

#### Scenario: 实录报告
- **WHEN** 管理员已为该用户上传本期实录报告
- **THEN** 册子末尾出现「分享实录」一页，点开进入实录报告页；没有报告或请求失败时该页不出现
