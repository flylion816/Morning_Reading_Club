## ADDED Requirements

### Requirement: 每周一条实修
系统 SHALL 允许已报名某期的用户在该期每一周设定一条实修行动，长度不超过 30 字；周按期次开始日起每 7 天计，使用东八区自然日。

#### Scenario: 设定本周实修
- **WHEN** 已报名用户在期次进行中提交非空且不超过 30 字的行动
- **THEN** 系统 SHALL 保存为本周实修，本周再次提交 SHALL 覆盖原内容

#### Scenario: 过去的周不可修改
- **WHEN** 用户请求修改实修
- **THEN** 系统 MUST 只修改当前周的实修，往周接口 SHALL 只读

#### Scenario: 期次未开始或已结束
- **WHEN** 用户查看本周实修而期次未开始或已结束
- **THEN** 系统 SHALL 返回 active 为 false，且不允许设定或记录

### Requirement: 每日记录
系统 SHALL 允许用户每天记录一次「做到了」或「今天没有」，并可补一句不超过 60 字的话；当天可修改，过去的日子 MUST NOT 修改。

#### Scenario: 记录今天
- **WHEN** 用户在本周已设定实修后提交 done 与 note
- **THEN** 系统 SHALL 保存今天的记录，同一天再次提交 SHALL 覆盖

#### Scenario: 本周未设定实修
- **WHEN** 用户在本周没有实修时记录今天
- **THEN** 系统 MUST 返回 400

#### Scenario: 没有做到不被惩罚
- **WHEN** 用户记录「今天没有」
- **THEN** 系统 MUST NOT 计算连续天数、完成率，且接口与页面 MUST NOT 出现“失败”“中断”等词

### Requirement: 建议行动
系统 SHALL 取本周各课程「记一记」内容的第一句（去标签，40 字内）作为建议，去重后最多 3 条；没有则返回空数组。

#### Scenario: 本周尚未设定
- **WHEN** 用户查看本周且尚未设定实修
- **THEN** 系统 SHALL 返回最多 3 条建议，页面点击建议 SHALL 填入输入框

### Requirement: 仅限本人且需已报名
所有实修接口 SHALL 只操作当前登录用户的数据，并要求已报名该期。

#### Scenario: 未报名
- **WHEN** 用户请求未报名期次的实修接口
- **THEN** 系统 MUST 返回 403
