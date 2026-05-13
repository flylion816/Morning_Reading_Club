## ADDED Requirements

### Requirement: 同意申请后订阅通知发起方
系统 SHALL 在小凡看见查看申请被同意后，使用现有小程序订阅消息体系向申请发起方发送通知，并保留现有站内通知。

#### Scenario: 同意具体小凡看见申请
- **WHEN** 被申请人同意一条包含 `insightId` 的小凡看见查看申请
- **THEN** 系统将申请状态更新为 `approved`
- **AND** 系统创建 `request_approved` 站内通知
- **AND** 系统尝试向申请发起方发送 `insight_request_approved` 订阅消息
- **AND** 订阅消息的点击目标指向 `pages/insight-detail/insight-detail?id=<insightId>`。

#### Scenario: 同意期次级查看申请
- **WHEN** 被申请人同意一条没有 `insightId` 但包含 `periodId` 的查看申请
- **THEN** 系统将申请状态更新为 `approved`
- **AND** 系统尝试向申请发起方发送 `insight_request_approved` 订阅消息
- **AND** 订阅消息的点击目标降级指向目标用户的小凡看见列表并携带 `userId` 和 `periodId`。

#### Scenario: 订阅消息不可发送
- **WHEN** 申请发起方没有可用订阅授权或订阅消息配置不可用
- **THEN** 同意申请操作 SHALL 仍然成功
- **AND** 系统 SHALL 通过现有投递日志记录跳过或失败原因
- **AND** 系统 SHALL 保留站内通知。

#### Scenario: 微信接口发送失败
- **WHEN** 订阅消息调用微信接口失败
- **THEN** 同意申请操作 SHALL 仍然成功
- **AND** 系统 SHALL 记录失败状态、错误码或错误信息
- **AND** 系统 SHALL 不重复修改申请审批状态。

### Requirement: 申请通过提醒授权
系统 SHALL 在申请人发起小凡看见查看申请后，通过现有订阅授权补充机制请求申请通过提醒授权。

#### Scenario: 发起申请后请求通过提醒授权
- **WHEN** 申请人成功发起小凡看见查看申请
- **THEN** 小程序 SHALL 尝试请求 `insight_request_approved` 订阅授权
- **AND** 授权失败 SHALL 不影响申请已发送状态。

### Requirement: 通知直达目标一致性
系统 SHALL 使用同一套小凡看见申请通过目标页构建逻辑，确保站内通知和订阅消息跳转目标一致。

#### Scenario: 站内通知与订阅消息指向同一内容
- **WHEN** 系统为申请通过事件创建站内通知并发送订阅消息
- **THEN** 两个通知的目标页均指向同一个小凡看见详情或同一个降级列表目标。

#### Scenario: 目标页参数可追踪来源
- **WHEN** 系统构建申请通过通知目标页
- **THEN** 目标页参数包含可识别来源的 `from=service_notice`
- **AND** 在具备申请 ID 时包含 `requestId` 参数。

### Requirement: 复用现有订阅消息体系
系统 SHALL 复用评论、点赞、开课通知使用的小程序订阅消息体系，不新增公众号服务号 openid 或独立服务号模板消息链路。

#### Scenario: 使用小程序订阅授权库存
- **WHEN** 系统发送 `insight_request_approved` 通知
- **THEN** 系统 SHALL 通过现有 `SubscribeMessageGrant` 授权库存判断是否可发送
- **AND** 系统 SHALL 通过现有 `SubscribeMessageDelivery` 记录投递结果。

#### Scenario: 不要求服务号 openid
- **WHEN** 申请发起方只有小程序 `openid`
- **THEN** 系统 SHALL 仍可按现有订阅消息体系尝试发送
- **AND** 系统 SHALL 不要求用户存在服务号 openid。
