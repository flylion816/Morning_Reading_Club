## ADDED Requirements

### Requirement: 写信窗口与唯一性
系统 SHALL 允许已报名用户在每个期次写且仅写一封给自己的信，且只能在开营日前 3 天 00:00 到开营后第 7 天 23:59:59（东八区）之间保存草稿或投递。

#### Scenario: 窗口内保存草稿
- **WHEN** 已报名用户在窗口内提交不超过 2000 字的内容和合法邮戳（dawn / leaf / book）
- **THEN** 系统 MUST 保存为草稿并返回草稿内容

#### Scenario: 窗口外写信
- **WHEN** 用户在窗口之外保存草稿或投递
- **THEN** 系统 MUST 拒绝并提示信箱已关

#### Scenario: 投递后不可改
- **WHEN** 信已封存、送达或拆开后用户再次保存草稿
- **THEN** 系统 MUST 拒绝

### Requirement: 封存期间内容不可读
系统 SHALL 在信处于封存或已送达未拆状态时不返回信件内容。

#### Scenario: 查询封存的信
- **WHEN** 用户查询状态为 sealed 的信
- **THEN** 响应 MUST NOT 包含 content，并包含距送达的天数

#### Scenario: 未送达时拆信
- **WHEN** 用户对 draft 或 sealed 的信调用拆信
- **THEN** 系统 MUST 返回 403

### Requirement: 按期次结束日送达
系统 SHALL 以所属期次 endDate 东八区 6:00 为送达时间，每 10 分钟扫描到点的封存信，标记送达并创建标题为“有一封信到了”的 letter_delivered 通知；扫描 MUST 幂等且覆盖所有租户。

#### Scenario: 到点送达
- **WHEN** 当前时间不早于期次送达时间且信为 sealed
- **THEN** 系统 MUST 将其标记为 delivered 并创建一条通知，内容为“{N} 天前你写给今天的自己”

#### Scenario: 重复扫描
- **WHEN** 信已被送达后再次扫描
- **THEN** 系统 MUST NOT 重复创建通知

#### Scenario: 结束日被修改
- **WHEN** 后台修改了期次 endDate
- **THEN** 系统 MUST 以最新的结束日计算送达时间

### Requirement: 拆信与回信
系统 SHALL 允许用户拆开已送达的信（记录 openedAt）并回一句不超过 200 字的话，且只能回一次。

#### Scenario: 拆信
- **WHEN** 用户拆开 delivered 的信
- **THEN** 系统 MUST 标记 opened、记录 openedAt 并返回内容

#### Scenario: 重复回信
- **WHEN** 已回过信的用户再次回信
- **THEN** 系统 MUST 拒绝

### Requirement: 仅操作本人的信
所有慢递接口 SHALL 只能读写当前登录用户本人的信，并要求用户已报名对应期次。

#### Scenario: 他人的信
- **WHEN** 用户对不属于自己的信调用拆信或回信
- **THEN** 系统 MUST 返回 404
