## ADDED Requirements

### Requirement: 每期一位读伴
系统 SHALL 保证同一用户在同一期同时只在一对读伴里；双方看到的是同一对。

#### Scenario: 同时在两期
- **WHEN** 用户同时报名了两期并各有一位读伴
- **THEN** 每一期的读伴页和通知 SHALL 标明期次名

### Requirement: 击掌
系统 SHALL 允许两人今天都读完（或已打卡）后互相击掌，每人每天一次；MUST 在对方未读完时拒绝。

#### Scenario: 对方还没读
- **WHEN** 读伴还没读完时请求击掌
- **THEN** 系统 SHALL 返回 400

#### Scenario: 当天重复击掌
- **WHEN** 同一人同一天第二次击掌
- **THEN** 系统 SHALL 返回 400，且不重复通知

### Requirement: 送一句
系统 SHALL 只接受预设短句的 key，MUST NOT 接受自由输入；每人每天一句；对方当天可在读伴页看到。

#### Scenario: 非预设内容
- **WHEN** 请求带有不在预设里的 messageKey
- **THEN** 系统 SHALL 返回 400

### Requirement: 同行足迹
概览 SHALL 返回期次每天一格的状态与时间线；`sharedDays` MUST 只统计结伴之后。

#### Scenario: 结伴前的阅读
- **WHEN** 两位书友在结伴之前的同一天都读完过
- **THEN** 系统 MUST NOT 将该天计入结伴后的 `sharedDays`

### Requirement: 结营纪念与续伴
系统 SHALL 返回结伴天数、一起读完的天数、击掌次数、对方送的第一句；续伴意愿 MUST 只在双方都点过时才对外可见；双方都点过时，下一期任意一方申请读伴，系统 SHALL 优先把 TA 们配成一对（对方已报名该期且尚无读伴）。

#### Scenario: 只有一方点了续伴
- **WHEN** 只有一方点了「下一期还做读伴」
- **THEN** 另一方的响应 MUST NOT 暴露对方已点过
