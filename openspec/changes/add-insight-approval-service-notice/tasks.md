## 1. 规格
- [x] 1.1 确认 proposal 已获得批准后再开始实现。

## 2. 订阅通知基础设施
- [x] 2.1 在后端订阅消息配置中新增 `insight_request_approved` scene。
- [x] 2.2 在前端自动补充授权策略中新增 `insight_request_approved` scene。
- [x] 2.3 发起小凡看见申请成功后，请求申请通过提醒的订阅授权。
- [x] 2.4 复用现有 `SubscribeMessageGrant` 和 `SubscribeMessageDelivery` 记录授权与投递状态。
- [x] 2.5 确认没有新增公众号服务号 openid 字段或独立服务号发送链路。

## 3. 同意申请链路
- [x] 3.1 在 `approveInsightRequest` 中解析直达目标：优先 `insight-detail`，无 `insightId` 时降级到他人小凡看见列表。
- [x] 3.2 保留现有站内 `request_approved` 通知，并将 `targetPage` 调整为直达目标。
- [x] 3.3 审批成功后向发起方发送 `insight_request_approved` 订阅通知。
- [x] 3.4 订阅消息无授权、缺配置或发送失败时，不影响审批成功响应。

## 4. 测试与验证
- [x] 4.1 增加订阅通知 scene 和审批通知参数验证。
- [x] 4.2 增加审批通过流程测试：有 `insightId` 时直达详情；无 `insightId` 时降级列表。
- [x] 4.3 运行相关后端测试或定向 lint。
- [x] 4.4 确认没有执行数据库重置或初始化脚本。
