# 设计：订阅通知直达小凡看见详情

## 背景
现有评论、点赞、开课通知已经通过 `subscribe-message.service`、`SubscribeMessageGrant`、`SubscribeMessageDelivery` 和前端 `subscribe-auto-topup` 形成统一的小程序订阅消息链路。本变更保持一致，不新增公众号服务号 openid、独立 access token 或独立模板消息服务。

同意小凡看见申请后，当前已有 `request_approved` 站内通知。本次只扩展为：同一事件同时尝试发送 `insight_request_approved` 小程序订阅消息，并让站内通知和订阅消息使用同一个直达目标页。

## 目标
- 接收方同意小凡看见查看申请后，向发起方发送项目现有体系内的微信订阅消息。
- 发起方点击通知后进入对应的小凡看见详情，减少二次查找。
- 无订阅授权、微信接口失败或配置缺失不影响审批成功。
- 保持和评论、开课通知一致的授权、投递日志和排查方式。

## 非目标
- 不新增公众号服务号模板消息链路。
- 不新增服务号 openid 字段或服务号绑定流程。
- 不改变申请同意/拒绝的鉴权规则。
- 不移除现有站内通知。

## 数据和配置
- 新增订阅消息 scene：`insight_request_approved`。
- 复用现有模型：
  - `SubscribeMessageGrant`：记录用户对该 scene 的授权库存。
  - `SubscribeMessageDelivery`：记录发送、跳过和失败状态。
- 复用现有环境变量：
  - `WECHAT_APPID`
  - `WECHAT_SECRET`
- 新 scene 当前复用“小凡看见申请”模板 ID 和字段结构：
  - `approverName` -> `name2`
  - `remark` -> `thing3`
  - `approvedTime` -> `date1`
- 如果微信后台后续提供更贴合的“申请通过”模板，可只调整 `backend/src/config/subscribe-message.config.js` 和前端 `AUTO_TOP_UP_POLICIES` 的模板 ID。

## 授权时机
- 申请人发起查看申请成功后，前端调用 `maybeAutoTopUpSubscriptions` 请求 `insight_request_approved` 授权。
- 该授权由用户主动操作触发，符合微信订阅消息要求。

## 跳转策略
- 如果 `InsightRequest.insightId` 存在：
  - 订阅消息 page 使用 `pages/insight-detail/insight-detail?id=<insightId>&from=service_notice&requestId=<requestId>`。
- 如果申请没有具体 `insightId`，只有 `periodId`：
  - 降级为 `pages/insights/insights?userId=<toUserId>&periodId=<periodId>&from=service_notice&requestId=<requestId>`。
- 站内通知 `targetPage` 使用同一目标，避免站内和微信通知体验不一致。

## 发送时机
- 在 `approveInsightRequest` 成功保存 `approved` 状态并发布同步事件后发送。
- 使用 `dispatchNotificationWithSubscribe` 同时创建站内通知和触发订阅消息。
- 订阅消息发送失败、无授权或配置缺失时，由现有 `subscribe-message.service` 记录投递日志，不回滚审批。

## 测试策略
- 控制器测试覆盖：
  - 有 `insightId` 时直达详情。
  - 无 `insightId` 时降级到他人小凡看见列表。
  - 同意申请时使用 `insight_request_approved` scene。
- 配置测试或语法检查覆盖新增 scene。
- 保留现有同意申请站内通知行为。
