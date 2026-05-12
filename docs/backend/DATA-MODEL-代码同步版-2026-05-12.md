# 数据模型索引（代码同步版）

> 同步日期：2026-05-12  
> 来源：`backend/src/models/*.js`

## 1. 主数据模型

| 模型 | 主要字段 | 关键索引/约束 |
| --- | --- | --- |
| User | `openid`、`nickname`、`avatar`、`avatarUrl`、`gender`、`role`、`status`、学习统计字段 | `openid` unique；`nickname`、`createdAt`、`phone` sparse |
| Admin | `username`、`email`、`password`、`role`、`permissions`、`status` | `email` unique；`status`、`createdAt` |
| Period | `title`、`description`、`startDate`、`endDate`、`price`、`status`、`isPublished`、统计字段 | `startDate/endDate`、`status`、`isPublished/sortOrder` |
| Section | `periodId`、`day`、`title`、富文本学习内容字段、`isPublished`、`sortOrder` | `periodId/sortOrder`；`periodId/day` unique |
| Enrollment | `userId`、`periodId`、`status`、`paymentStatus`、报名表扩展字段 | `userId/periodId` unique；`paymentStatus`、`status`、`createdAt` |
| Payment | `enrollmentId`、`userId`、`periodId`、`amount`、`method`、`status`、`transactionId` | `transactionId` unique；`status/createdAt`、`userId/createdAt`、`periodId/status` |
| Checkin | `userId`、`periodId`、`sectionId`、`content/note`、`checkinDate`、`likes`、`likeCount`、`isPublic` | `userId/sectionId` unique；`userId/checkinDate`、`periodId/checkinDate`、`periodId/sectionId/isPublic/createdAt` |
| Comment | `checkinId`、`userId`、`content`、`likes`、`replies`、`likeCount` | `checkinId/createdAt`、`userId` |
| Insight | `userId`、`targetUserId`、`checkinId`、`periodId`、`sectionId`、`type`、`contentType`、`title`、`content`、`status`、`source`、`isPublished`、`likes` | `userId/createdAt`、`periodId`、`type/isPublished`、`status` |
| InsightRequest | `fromUserId`、`toUserId`、`status`、`periodId`、`insightId`、`history` | 唯一申请约束；`toUserId/status`、`fromUserId/status`、`updatedAt` |
| Notification | `userId`、`type`、`title`、`content`、`data`、`requestId`、`fromUserId`、`isRead`、`isArchived` | `userId/isArchived/createdAt`、`userId/isRead`、`userId/type/requestId` |
| UserActivity | `userId`、`action`、`targetType`、`targetId`、`periodId`、`sectionId`、`metadata` | `actionDate/action/userId`、`userId/occurredAt`、`periodId/actionDate` |

## 2. 配置与辅助模型

| 模型 | 说明 |
| --- | --- |
| CheckinCelebrationConfig | 打卡成功动画样式和庆祝文案配置 |
| AuditLog | 管理员审计日志，按 `timestamp` TTL 30 天 |
| SubscribeMessageGrant | 用户订阅模板授权余量、调度时间和重试状态 |
| SubscribeMessageDelivery | 订阅消息发送记录 |

## 3. 主要关系

```
User 1 - N Enrollment
User 1 - N Payment
User 1 - N Checkin
User 1 - N Comment
User 1 - N Insight
User 1 - N Notification

Period 1 - N Section
Period 1 - N Enrollment
Period 1 - N Payment
Period 1 - N Checkin
Period 1 - N Insight

Section 1 - N Checkin
Checkin 1 - N Comment
Checkin 1 - N Insight
Insight 1 - N InsightRequest
```

## 4. 当前设计约束

- 用户 ID 以 MongoDB `_id` 为前后端标准字段。
- `Checkin` 使用 `userId + sectionId` 控制同一课节单次打卡。
- `Section` 使用 `periodId + day` 控制同一期次同一天唯一课节。
- `Enrollment` 使用 `userId + periodId` 控制同一期次重复报名。
- `InsightRequest` 通过唯一索引控制同一申请范围的重复请求。
- `Comment` 的回复存储为嵌套数组，适合当前互动规模；若回复量继续增长，应评估拆分为独立集合。

## 5. 数据治理建议

- 为旧文档中的 MySQL 表结构补充“备份表，不是主业务模型”的说明，避免误以为双写同权威。
- 定期审查 `likes` 数组增长风险，必要时拆分点赞集合。
- 审计日志 TTL 为 30 天，合规留存若要求更长，需要调整 TTL 或归档策略。
