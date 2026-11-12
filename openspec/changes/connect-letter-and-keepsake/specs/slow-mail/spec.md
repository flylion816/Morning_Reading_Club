## ADDED Requirements

### Requirement: 拆信后翻阅本期纪念册
慢递邮局 SHALL 在用户拆信后提供前往该信所属期次纪念册的入口。

#### Scenario: 拆开本期信
- **WHEN** 用户拆信完成并点击「翻开这一期的纪念册」
- **THEN** 系统 SHALL 打开该信所属期次的纪念册

#### Scenario: 从本期纪念册前往拆信
- **WHEN** 上一页是同一期纪念册
- **THEN** 系统 SHALL 返回并刷新该纪念册，避免重复叠加页面
