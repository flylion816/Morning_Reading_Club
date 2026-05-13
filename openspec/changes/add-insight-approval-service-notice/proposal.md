# 变更：同意小凡看见申请后发送订阅通知

## 为什么
用户发起“小凡看见”查看申请后，即使对方同意，目前主要依赖站内通知或用户主动查看状态，反馈链路不够及时。需要在接收方点击同意后，用项目现有微信订阅消息体系通知发起方，并允许发起方点开通知直接进入对应的小凡看见内容。

## 改动内容
- 在现有小程序订阅消息体系中新增 `insight_request_approved` scene。
- 在发起申请成功后，引导申请发起方补充 `insight_request_approved` 订阅授权。
- 在小凡看见申请同意流程中，复用 `dispatchNotificationWithSubscribe` 保留站内通知，并额外尝试发送订阅消息。
- 通知跳转目标指向可直接查看的 `insight-detail` 页面；如果申请只授予期次级权限且没有具体 `insightId`，则降级跳转到对方小凡看见列表并携带目标用户和期次。
- 订阅消息无授权、配置缺失或微信接口失败时，不阻塞“同意”操作；系统记录投递状态，并保留站内通知。
- 不执行数据库重置或初始化脚本。

## 影响范围
- 受影响规格：`insight-requests`
- 受影响代码：
  - `backend/src/config/subscribe-message.config.js`
  - `backend/src/controllers/insight.controller.js`
  - `backend/src/utils/notification-links.js`
  - `miniprogram/utils/subscribe-auto-topup.js`
  - `miniprogram/pages/insights/insights.js`
  - 相关后端单元测试
- 配置影响：
  - 复用现有 `WECHAT_APPID` / `WECHAT_SECRET` / `SubscribeMessageGrant` / `SubscribeMessageDelivery` 链路。
  - 新 scene 当前复用现有“小凡看见申请”订阅模板 ID 和字段映射；如后续微信后台配置了更匹配的“申请通过”模板，只需替换 scene 配置中的 `templateId` 与字段映射。
