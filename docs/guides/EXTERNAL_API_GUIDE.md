# 晨读营外部系统 API 调用指南

本文档为外部系统提供 3 个公开 API 接口，用于查询当前期次、获取期次用户，并为指定用户创建“小凡看见”。

---

## 接口概览

| API | 方法 | 端点 | 说明 |
| --- | --- | --- | --- |
| 查询运行中期次 | GET | `/api/v1/enrollments/external/active-periods` | 获取当前正在运行的期次列表，以及每个期次当天课程的 `sessionId` |
| 获取期次用户 | GET | `/api/v1/enrollments/external/users-by-period` | 通过期次 ID 或期次名称获取参与用户列表 |
| 创建小凡看见 | POST | `/api/v1/insights/external/create` | 为指定用户创建“小凡看见” |

示例使用当前最新期次：

| 字段 | 示例值 |
| --- | --- |
| periodName | `秩序之锚` |
| periodId | `69f9bf45cb1c9ac0600ad556` |
| day | `1` |
| sessionId | `69f9bf45cb1c9ac0600ad55b` |

说明：本文档中的 `sessionId` 即课节 ID，对应数据库里的 Section `_id`。

---

## API #1: 查询运行中期次列表

### 接口说明

查询当前正在运行的期次列表。每个期次返回期次名称、期次 ID、当前课程的 `day`，以及当天课程对应的 `sessionId`。

“运行中”的判断规则：期次已发布，且当前时间在期次 `startDate` 和 `endDate` 之间。

`day` 使用系统课节 day 口径，可直接传给“创建小凡看见”接口；如果当天课程没有查到，`sessionId` 会返回 `null`。

### 请求信息

**HTTP 方法**: `GET`

**URL**: `https://wx.shubai01.com/api/v1/enrollments/external/active-periods`

### 请求参数

无。

### 成功响应示例

**HTTP 状态码**: `200 OK`

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "list": [
      {
        "periodId": "69f9bf45cb1c9ac0600ad556",
        "periodName": "秩序之锚",
        "day": 1,
        "sessionId": "69f9bf45cb1c9ac0600ad55b"
      }
    ],
    "total": 1
  },
  "timestamp": 1778077219250
}
```

如果当前没有运行中的期次，返回空列表：

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "list": [],
    "total": 0
  },
  "timestamp": 1778077219250
}
```

### 使用示例

```bash
curl -X GET "https://wx.shubai01.com/api/v1/enrollments/external/active-periods"
```

---

## API #2: 获取期次用户列表

### 接口说明

通过期次 ID 或期次名称获取该期次中所有已报名的用户列表。推荐优先使用 `periodId`，期次名称用于兼容旧调用方式。

### 请求信息

**HTTP 方法**: `GET`

**URL**: `https://wx.shubai01.com/api/v1/enrollments/external/users-by-period`

### 请求参数

| 参数 | 类型 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| periodId | string | 二选一 | 期次 ID，推荐优先传；和 `periodName` 同时传时优先使用 | `69f9bf45cb1c9ac0600ad556` |
| periodName | string | 二选一 | 期次名称，需要 URL 编码 | `秩序之锚` |

### 成功响应示例

**HTTP 状态码**: `200 OK`

```json
{
  "code": 0,
  "message": "获取成功",
  "data": {
    "periodId": "69f9bf45cb1c9ac0600ad556",
    "periodName": "秩序之锚",
    "userCount": 2,
    "users": [
      {
        "userId": "692fe16a962d558224f4133f",
        "nickname": "狮子"
      },
      {
        "userId": "692fe16a962d558224f41340",
        "nickname": "阿泰"
      }
    ]
  },
  "timestamp": 1778077219250
}
```

### 错误响应示例

缺少期次参数：

```json
{
  "code": 400,
  "message": "缺少必填字段：periodId 或 periodName",
  "timestamp": 1778077219250
}
```

期次不存在：

```json
{
  "code": 404,
  "message": "期次不存在：不存在的期次",
  "timestamp": 1778077219250
}
```

### 使用示例

```bash
# 推荐：通过 periodId 查询
curl -X GET "https://wx.shubai01.com/api/v1/enrollments/external/users-by-period?periodId=69f9bf45cb1c9ac0600ad556"

# 兼容：通过 periodName 查询，curl 自动 URL 编码
curl -X GET --get "https://wx.shubai01.com/api/v1/enrollments/external/users-by-period" \
  --data-urlencode "periodName=秩序之锚"
```

---

## API #3: 创建小凡看见

### 接口说明

为指定用户在某个期次、某一天课程下创建一条“小凡看见”记录。

### 请求信息

**HTTP 方法**: `POST`

**URL**: `https://wx.shubai01.com/api/v1/insights/external/create`

**Content-Type**: `application/json`

### 请求参数

| 参数 | 类型 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- | --- |
| periodId | string | 二选一 | 期次 ID，推荐优先传 | `69f9bf45cb1c9ac0600ad556` |
| periodName | string | 二选一 | 期次名称，兼容旧调用方式 | `秩序之锚` |
| sessionId | string | 二选一 | 课节 ID，推荐优先传 | `69f9bf45cb1c9ac0600ad55b` |
| day | number | 二选一 | 第几天课程；仅在未传 `sessionId` 时使用 | `1` |
| targetUserId | string | 必填 | 被看见人的用户 ID | `692fe16a962d558224f4133f` |
| content | string | 二选一 | 小凡看见文字内容 | `我看见你今天很认真地完成了晨读。` |
| imageUrl | string | 二选一 | 小凡看见图片地址 | `https://example.com/image.jpg` |

规则：

- `periodId` 和 `periodName` 只需要传一个，推荐传 `periodId`
- `sessionId` 和 `day` 只需要传一个，推荐传 `sessionId`
- `content` 和 `imageUrl` 至少填写一个
- 若同时传 `sessionId` 和 `day`，以 `sessionId` 为准
- 历史调用里若仍传 `sectionId`，服务端当前仍兼容，但新接入建议统一使用 `sessionId`

### 成功响应示例

**HTTP 状态码**: `201 Created`

```json
{
  "code": 0,
  "message": "小凡看见创建成功",
  "data": {
    "_id": "6934e59a21146457e60d54ca",
    "targetUserId": "692fe16a962d558224f4133f",
    "periodId": "69f9bf45cb1c9ac0600ad556",
    "periodName": "秩序之锚",
    "sectionId": "69f9bf45cb1c9ac0600ad55b",
    "day": 1,
    "type": "insight",
    "mediaType": "text",
    "content": "我看见你今天很认真地完成了晨读。",
    "imageUrl": null,
    "source": "manual",
    "status": "completed",
    "isPublished": true,
    "createdAt": "2026-05-06T02:25:30.100Z",
    "updatedAt": "2026-05-06T02:25:30.100Z"
  },
  "timestamp": 1778077219250
}
```

### 错误响应示例

缺少期次参数：

```json
{
  "code": 400,
  "message": "缺少必填字段：periodId 或 periodName",
  "timestamp": 1778077219250
}
```

缺少课节参数：

```json
{
  "code": 400,
  "message": "缺少必填字段：sessionId 或 day",
  "timestamp": 1778077219250
}
```

用户未报名期次：

```json
{
  "code": 403,
  "message": "用户 狮子 未报名期次 秩序之锚",
  "timestamp": 1778077219250
}
```

### 使用示例

```bash
curl -X POST https://wx.shubai01.com/api/v1/insights/external/create \
  -H "Content-Type: application/json" \
  -d '{
    "periodId": "69f9bf45cb1c9ac0600ad556",
    "sessionId": "69f9bf45cb1c9ac0600ad55b",
    "targetUserId": "692fe16a962d558224f4133f",
    "content": "我看见你今天很认真地完成了晨读。"
  }'
```

---

## 安全建议

1. 这些接口当前为公开接口，不要在请求中传递敏感信息。
2. 外部系统应优先保存并使用 `periodId` 和 `sessionId`，避免中文名称变化导致匹配失败。
3. 期次名称作为查询条件时需要 URL 编码。
4. 调用方应始终检查响应中的 `code` 和 `message`。
5. 建议设置 5 秒左右的请求超时。

---

## 常见问题

### Q1: 如何知道当前应该传哪个 periodId 和 sessionId？

先调用“查询运行中期次列表”接口，读取返回列表里的 `periodId`、`day` 和 `sessionId`。

### Q2: 获取用户列表时 periodId 和 periodName 同时传了怎么办？

系统优先使用 `periodId`。

### Q3: 创建小凡看见时只有 day，没有 sessionId 可以吗？

可以。系统会根据 `periodId/periodName + day` 查找对应课节，并自动绑定到该课节。

### Q4: 为什么创建小凡看见时提示“用户未报名期次”？

说明 `targetUserId` 对应用户没有报名该期次。请先调用“获取期次用户列表”确认用户在该期次中。

---

## 更新日志

| 日期 | 版本 | 更新内容 |
| --- | --- | --- |
| 2026-05-06 | v1.3 | 新增运行中期次查询接口；期次用户接口支持 `periodId` 或 `periodName`；示例更新为最新期次和第 1 天 `sessionId` |
| 2026-03-31 | v1.2 | 收紧外部创建参数：`periodId/periodName` 二选一、`sessionId/day` 二选一；移除 `title` 请求字段；文档统一仅保留 `sessionId` 写法 |
| 2026-03-27 | v1.1 | 新增 `periodName` 和 `title` 字段 |
| 2025-12-07 | v1.0 | 初始版本 |

---

**最后更新**: 2026-05-06
