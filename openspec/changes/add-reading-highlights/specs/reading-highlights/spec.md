## ADDED Requirements

### Requirement: 摘下一段原文
系统 SHALL 允许已报名某期的用户把该期课程中的一段原文摘进自己的摘抄本，原文上限 500 字，感想上限 200 字；系统 MUST 存储原文而不是段落序号。

#### Scenario: 首次摘下
- **WHEN** 已报名用户提交课程 ID、原文和感想
- **THEN** 系统 SHALL 创建摘抄并返回，且记录规范化文本的哈希

#### Scenario: 重复摘同一段
- **WHEN** 用户再次摘下同一课中规范化后相同的文本
- **THEN** 系统 MUST 返回已有那条而不是创建新记录

#### Scenario: 未报名或超限
- **WHEN** 用户未报名该期，或原文超过 500 字，或感想超过 200 字
- **THEN** 系统 MUST 拒绝该请求

### Requirement: 管理自己的摘抄
系统 SHALL 只允许用户修改自己摘抄的感想并删除自己的摘抄，且 MUST NOT 允许修改原文。

#### Scenario: 修改感想
- **WHEN** 用户对自己的摘抄提交新的感想
- **THEN** 系统 SHALL 只更新感想

#### Scenario: 操作他人摘抄
- **WHEN** 用户修改或删除不属于自己的摘抄
- **THEN** 系统 MUST 返回不存在

### Requirement: 我的摘抄本
系统 SHALL 按时间倒序分页返回本人摘抄，并附课程标题、第几天、期次名，以及供筛选的期次列表与各期数量。

#### Scenario: 按期次筛选
- **WHEN** 用户带 periodId 请求
- **THEN** 系统 SHALL 只返回该期摘抄，total 为该期数量，periods 仍包含全部期次

### Requirement: 热摘段落
系统 SHALL 返回某课中被不少于 3 位不同用户摘过的段落哈希与人数，以及当前用户自己摘过的哈希；系统 MUST NOT 返回任何用户标识，且 MUST 要求用户已报名该期。

#### Scenario: 达到人数门槛
- **WHEN** 同一段被 3 位不同用户摘过
- **THEN** 该段哈希 SHALL 出现在热摘列表中并带人数

#### Scenario: 未达门槛
- **WHEN** 同一段只被 2 位用户摘过
- **THEN** 热摘列表 MUST NOT 包含该段

### Requirement: 前后端哈希一致
前后端 SHALL 使用同一规范化规则（去首尾空白、合并连续空白）和 FNV-1a 32 位哈希（8 位小写十六进制），使同一文本在两端得到相同结果。

#### Scenario: 同一样例两端一致
- **WHEN** 两端对同一组样例文本计算哈希
- **THEN** 输出 MUST 相同

### Requirement: 摘抄本页面
小程序 SHALL 提供摘抄本页面，展示衬线原文、来源小字与感想，支持按期次筛选、编辑感想、二次确认后删除、分页加载，并提供「做成日签」入口。

#### Scenario: 空摘抄本
- **WHEN** 用户没有任何摘抄
- **THEN** 页面 SHALL 显示空态文案「读到想留下的句子，长按就能摘下来」

#### Scenario: 做成日签
- **WHEN** 用户点「做成日签」
- **THEN** 页面 SHALL 跳转到日签页并带上编码后的 quote 与 source 参数

#### Scenario: 加载失败
- **WHEN** 接口失败
- **THEN** 页面 SHALL 在页内提示并提供重试
