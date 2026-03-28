# API接口设计 v4.0 - Postman 测试文档

## 文档信息

- **文档版本**: v4.0
- **基于代码版本**: 实际后端路由实现
- **更新日期**: 2026-03-08
- **用途**: Postman 接口测试

---

## 基础配置

### 环境变量（Postman Environment）

| 变量名 | 线上环境值 | 说明 |
|--------|-----------|------|
| `base_url` | `https://wx.shubai01.com/api/v1` | 线上 API 基础地址 |
| `access_token` | (登录后设置) | 用户 JWT Token |
| `admin_token` | (登录后设置) | 管理员 JWT Token |
| `user_id` | (登录后设置) | 当前用户 ID |
| `period_id` | (测试时设置) | 当前期次 ID |
| `section_id` | (测试时设置) | 当前课节 ID |
| `checkin_id` | (测试时设置) | 当前打卡 ID |

### 通用请求头

```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

### 通用响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": { ... },
  "timestamp": 1705132800000
}
```

---

## ⭐ Postman 测试用户与预置数据（线上环境）

### ⚠️ 线上环境说明

线上环境为 `NODE_ENV=production`，**不支持 Mock 登录**，微信登录需要真实的 `wx.login()` 授权码。
因此 Postman 测试线上接口时，建议：

1. **管理员接口**：使用管理员登录接口获取 Token（无需微信授权）
2. **用户接口**：先通过管理员接口获取已有用户的信息，或通过小程序端登录一次获取 Token

---

### 管理后台登录（线上）

| 字段 | 值 | 说明 |
|------|---|------|
| 邮箱 | `admin@morningreading.com` | 超级管理员邮箱 |
| 密码 | `Km7$Px2Qw9` | 线上环境密码 |

#### 示例请求

```
POST https://wx.shubai01.com/api/v1/auth/admin/login
Content-Type: application/json

{
  "email": "admin@morningreading.com",
  "password": "Km7$Px2Qw9"
}
```

#### Postman Tests 脚本（自动保存 Token）

```javascript
if (pm.response.code === 200) {
  var jsonData = pm.response.json();
  pm.environment.set("admin_token", jsonData.data.token);
  pm.environment.set("admin_id", jsonData.data.admin._id);
  console.log("✅ 管理员登录成功，已保存 admin_token");
}
```

---

### 小程序用户登录（线上）

线上环境必须使用真实微信授权码，无法在 Postman 中直接模拟。
**获取用户 Token 的方法：**

1. **方法一：从小程序获取** - 在小程序端登录后，从开发者工具的 Storage 中复制 `access_token`
2. **方法二：通过管理员接口** - 用管理员 Token 调用 `GET /api/v1/users` 查看已有用户列表

#### 示例：获取已有用户列表

```
GET https://wx.shubai01.com/api/v1/users
Authorization: Bearer {{admin_token}}
```

#### 线上测试用户 Token（有效期 30 天，生成于 2026-03-08）

以下 Token 使用线上 JWT Secret 签发，可直接粘贴到 Postman 的 `access_token` 变量中使用：

**用户1：小狮子** 🦁 （3次打卡，活跃用户）

| 字段 | 值 |
|------|---|
| _id | `69a6739b2f677e0df836c6ed` |
| openid | `osGhL1x8N_kucB2-bDj4eExur7gA` |
| access_token | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWE2NzM5YjJmNjc3ZTBkZjgzNmM2ZWQiLCJvcGVuaWQiOiJvc0doTDF4OE5fa3VjQjItYkRqNGVFeHVyN2dBIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3NzI5NjE4MTUsImV4cCI6MTc3NTU1MzgxNX0.Nj0Vol-5O55mcKf2dLBBWIHFE2iklSGisuPBAAsR4Ak` |
| refresh_token | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWE2NzM5YjJmNjc3ZTBkZjgzNmM2ZWQiLCJvcGVuaWQiOiJvc0doTDF4OE5fa3VjQjItYkRqNGVFeHVyN2dBIiwiaWF0IjoxNzcyOTYxODE1LCJleHAiOjE3ODA3Mzc4MTV9.f2GTU1xCWEbM2Ri3cpmDFcg4P3P-Dj1FdSfkVTTLCfs` |

**用户2：小⭐** ⭐ （6次打卡，最活跃用户）

| 字段 | 值 |
|------|---|
| _id | `69a6a0267003b0432e1d3d37` |
| openid | `osGhL16UOXaOQuqmp6eqgAO3okUI` |
| access_token | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWE2YTAyNjcwMDNiMDQzMmUxZDNkMzciLCJvcGVuaWQiOiJvc0doTDE2VU9YYU9RdXFtcDZlcWdBTzNva1VJIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3NzI5NjE4MTYsImV4cCI6MTc3NTU1MzgxNn0.7eOTZJ4b94eKuZhH8JH4xmzu0ghNeA4Q8kMKFu_v-jE` |
| refresh_token | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWE2YTAyNjcwMDNiMDQzMmUxZDNkMzciLCJvcGVuaWQiOiJvc0doTDE2VU9YYU9RdXFtcDZlcWdBTzNva1VJIiwiaWF0IjoxNzcyOTYxODE2LCJleHAiOjE3ODA3Mzc4MTZ9.6wH4c700AXlzZwXoW-Xjwl6O5HhgP0Wr7LlUsAuxg-Y` |

**用户3：小园园** 🦌 （2次打卡）

| 字段 | 值 |
|------|---|
| _id | `69a6dab97003b0432e1d4421` |
| openid | `osGhL13v8lCwRWXGb7QchtVb9wZg` |
| access_token | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWE2ZGFiOTcwMDNiMDQzMmUxZDQ0MjEiLCJvcGVuaWQiOiJvc0doTDEzdjhsQ3dSV1hHYjdRY2h0VmI5d1pnIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3NzI5NjE4MTYsImV4cCI6MTc3NTU1MzgxNn0.Obyz9I3pM3Rcd6hXslXsM41PSjU3QbSdEesC9mY0wAA` |
| refresh_token | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWE2ZGFiOTcwMDNiMDQzMmUxZDQ0MjEiLCJvcGVuaWQiOiJvc0doTDEzdjhsQ3dSV1hHYjdRY2h0VmI5d1pnIiwiaWF0IjoxNzcyOTYxODE2LCJleHAiOjE3ODA3Mzc4MTZ9.I8ShUHmGZO75Qh1-f9WRgKEhwa28YHj35BiKQNfZffE` |

**用户4：李四** 🐯（种子数据用户，65次打卡）

| 字段 | 值 |
|------|---|
| _id | `69a648bb53a837eb3775d815` |
| openid | `mock_user_002` |
| access_token | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWE2NDhiYjUzYTgzN2ViMzc3NWQ4MTUiLCJvcGVuaWQiOiJtb2NrX3VzZXJfMDAyIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3NzI5NjE4MTYsImV4cCI6MTc3NTU1MzgxNn0.tR-82MFINt7Cyhey2-53vnQqCLOekCrQ4UKOMWl0ReU` |
| refresh_token | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWE2NDhiYjUzYTgzN2ViMzc3NWQ4MTUiLCJvcGVuaWQiOiJtb2NrX3VzZXJfMDAyIiwiaWF0IjoxNzcyOTYxODE2LCJleHAiOjE3ODA3Mzc4MTZ9.ZWO2dfjTjWUHU1GKYIEixu06iTy2uNyeBIAG8bMx4QI` |

**用户5：王五** 🐼（种子数据用户，42次打卡）

| 字段 | 值 |
|------|---|
| _id | `69a648bb53a837eb3775d816` |
| openid | `mock_user_003` |
| access_token | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWE2NDhiYjUzYTgzN2ViMzc3NWQ4MTYiLCJvcGVuaWQiOiJtb2NrX3VzZXJfMDAzIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3NzI5NjE4MTYsImV4cCI6MTc3NTU1MzgxNn0.Vje3rb-2-OZ8-X3RFLFN1z9ZwWhx7LDPaW57OZeCHkY` |
| refresh_token | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWE2NDhiYjUzYTgzN2ViMzc3NWQ4MTYiLCJvcGVuaWQiOiJtb2NrX3VzZXJfMDAzIiwiaWF0IjoxNzcyOTYxODE2LCJleHAiOjE3ODA3Mzc4MTZ9._s6zvD5SxwIdZRnsrhbMEt1SsdQFvNM410ir1mJHNOs` |

> ⏰ Token 有效期至 **2026-04-07**。过期后需重新生成。

---

### 线上期次数据

| period_id | 名称 | 状态 | 天数 |
|-----------|------|------|------|
| `69a648bb53a837eb3775d81e` | 平衡之道 | active | 23 |
| `69a648bb53a837eb3775d81f` | 勇敢的心 | active | 23 |
| `69a648bb53a837eb3775d820` | 能量之泉 | completed | 23 |
| `69a648bb53a837eb3775d821` | 静心之镜 | completed | 23 |

### 线上课节数据（平衡之道 - 前5个）

| section_id | day | 标题 |
|------------|-----|------|
| `69a648bb53a837eb3775d825` | 0 | 开营词 |
| `69a648bb53a837eb3775d826` | 1 | 第一天 品德成功论 |
| `69a648bb53a837eb3775d827` | 2 | 第二天 思维方式的力量 |
| `69a648bb53a837eb3775d828` | 3 | 第三天 以原则为中心的思维方式 |
| `69a648bb53a837eb3775d829` | 4 | 第四天 成长和改变的原则 |

---

### Postman 环境变量完整配置（线上）

以下是线上环境的完整 Postman Environment 配置（可直接导入）：

```json
{
  "name": "晨读营-线上环境",
  "values": [
    { "key": "base_url", "value": "https://wx.shubai01.com/api/v1", "enabled": true },
    { "key": "access_token", "value": "", "enabled": true },
    { "key": "refresh_token", "value": "", "enabled": true },
    { "key": "admin_token", "value": "", "enabled": true },
    { "key": "user_id", "value": "", "enabled": true },
    { "key": "user_openid", "value": "", "enabled": true },
    { "key": "admin_id", "value": "", "enabled": true },
    { "key": "period_id", "value": "", "enabled": true },
    { "key": "section_id", "value": "", "enabled": true },
    { "key": "checkin_id", "value": "", "enabled": true },
    { "key": "enrollment_id", "value": "", "enabled": true },
    { "key": "insight_id", "value": "", "enabled": true },
    { "key": "comment_id", "value": "", "enabled": true },
    { "key": "payment_id", "value": "", "enabled": true }
  ]
}
```

### 推荐测试顺序（线上）

```
1. POST /auth/admin/login         → 管理员登录（保存 admin_token）
2. GET  /api/v1/health             → 验证服务状态
3. GET  /periods                   → 获取线上期次列表（保存 period_id）
4. GET  /periods/:periodId/sections → 获取课节列表（保存 section_id）
5. GET  /users                     → 查看用户列表（管理员权限）
6. GET  /admin/checkins            → 查看打卡列表（管理员权限）
7. GET  /stats/dashboard           → 查看仪表板统计
8. GET  /enrollments               → 查看报名列表（管理员权限）
9. GET  /notifications             → 查看通知
10. GET /audit-logs                 → 查看审计日志
```

### 线上数据库连接信息

| 数据库 | 连接信息 |
|--------|---------|
| MongoDB | `mongodb://admin:ProdMongodbSecure123@127.0.0.1:27017/morning_reading?authSource=admin` |
| MySQL | `host=localhost, port=13306, user=root, password=L55PWzePtXYPNkn7, db=morning_reading` |
| Redis | `localhost:26379, password=Redis@Prod@User0816!` |

### 线上微信小程序配置

| 配置项 | 值 |
|--------|---|
| AppID | `wx2b9a3c1d5e4195f8` |
| API 地址 | `https://wx.shubai01.com/api/v1` |
| 管理后台 URL | `https://wx.shubai01.com` |

---

## 一、认证接口 `/api/v1/auth` (3个)

### 1.1 微信登录

- **POST** `/api/v1/auth/wechat/login`
- **鉴权**: 无
- **请求体**:
```json
{
  "code": "061YaF100dSm2Z1hxS200oSzkC0YaF1Q"
}
```
- **响应**:
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 7200,
    "user": {
      "id": 1,
      "openid": "o6_bmjrPTlm6_2sgVt7hMZOPfL2M",
      "nickname": "微信用户",
      "avatar": "🦁",
      "role": "user",
      "status": "active",
      "isNewUser": true
    }
  }
}
```
- **Postman 提示**: 登录成功后在 Tests 脚本中自动设置 `access_token`:
```javascript
if (pm.response.code === 200) {
  var data = pm.response.json().data;
  pm.environment.set("access_token", data.accessToken);
  pm.environment.set("user_id", data.user.id);
}
```

### 1.2 刷新 Token

- **POST** `/api/v1/auth/refresh`
- **鉴权**: 无
- **请求体**:
```json
{
  "refreshToken": "{{refresh_token}}"
}
```

### 1.3 登出

- **POST** `/api/v1/auth/logout`
- **鉴权**: 需要（Bearer Token）

---

## 二、用户接口 `/api/v1/users` (7个)

### 2.1 获取当前用户信息

- **GET** `/api/v1/users/me`
- **鉴权**: 需要

### 2.2 更新用户资料

- **PUT** `/api/v1/users/profile`
- **鉴权**: 需要
- **请求体**:
```json
{
  "nickname": "阿泰",
  "avatar": "泰",
  "signature": "天天开心",
  "gender": "male"
}
```

> ⚠️ 注意：文档 v3.0 中为 `PATCH /users/me`，实际实现为 `PUT /users/profile`

### 2.3 获取用户详情（他人主页）

- **GET** `/api/v1/users/:userId`
- **鉴权**: 需要
- **路径参数**: `userId` - 目标用户 ID

> 🆕 新增接口，v3.0 文档中未收录

### 2.4 获取用户统计信息

- **GET** `/api/v1/users/:userId/stats`
- **鉴权**: 需要
- **路径参数**: `userId` - 用户 ID

> ⚠️ 注意：文档 v3.0 中为 `GET /users/me/stats`，实际支持任意用户 ID

### 2.5 获取用户列表（管理员）

- **GET** `/api/v1/users`
- **鉴权**: 管理员
- **查询参数**: `page`, `pageSize`, `search`, `role`, `status`

### 2.6 更新用户信息（管理员）

- **PUT** `/api/v1/users/:userId`
- **鉴权**: 管理员

### 2.7 删除用户（管理员）

- **DELETE** `/api/v1/users/:userId`
- **鉴权**: 管理员

> 🆕 2.5-2.7 为新增接口，v3.0 文档中仅在 admin 路由下有部分记录

---

## 三、期次接口 `/api/v1/periods` (6+3个)

### 3.1 获取期次列表

- **GET** `/api/v1/periods`
- **鉴权**: 可选（已登录时返回个人打卡数据）
- **查询参数**: `page`, `pageSize`, `status`

### 3.2 获取用户的期次列表

- **GET** `/api/v1/periods/user`
- **鉴权**: 需要
- **说明**: 包含用户个人的打卡统计

> 🆕 新增接口

### 3.3 获取期次详情

- **GET** `/api/v1/periods/:periodId`
- **鉴权**: 无

### 3.4 创建期次（管理员）

- **POST** `/api/v1/periods`
- **鉴权**: 管理员
- **请求体**:
```json
{
  "name": "勇敢的心",
  "subtitle": "七个习惯晨读营",
  "description": "21天养成阅读习惯",
  "icon": "⛰️",
  "startDate": "2025-10-11",
  "endDate": "2025-11-13",
  "totalDays": 23,
  "price": 99.0,
  "maxEnrollment": 500,
  "isPublished": true
}
```

### 3.5 更新期次（管理员）

- **PUT** `/api/v1/periods/:periodId`
- **鉴权**: 管理员

### 3.6 删除期次（管理员）

- **DELETE** `/api/v1/periods/:periodId`
- **鉴权**: 管理员

### 3.7 获取期次课节列表（用户）

- **GET** `/api/v1/periods/:periodId/sections`
- **鉴权**: 无
- **说明**: 仅返回已发布的课节

### 3.8 获取期次所有课节（管理员）

- **GET** `/api/v1/periods/:periodId/sections/admin/all`
- **鉴权**: 管理员
- **说明**: 包括草稿状态的课节

> 🆕 新增接口

### 3.9 在期次下创建课节（管理员）

- **POST** `/api/v1/periods/:periodId/sections`
- **鉴权**: 管理员

---

## 四、课节接口 `/api/v1/sections` (5个)

### 4.1 获取今日任务

- **GET** `/api/v1/sections/today/task`
- **鉴权**: 需要

> ⚠️ 注意：文档 v3.0 中为 `GET /sections/today`，实际为 `/sections/today/task`

### 4.2 获取期次课节列表

- **GET** `/api/v1/sections/period/:periodId`
- **鉴权**: 无

### 4.3 获取课节详情

- **GET** `/api/v1/sections/:sectionId`
- **鉴权**: 无

### 4.4 创建课节（管理员）

- **POST** `/api/v1/sections`
- **鉴权**: 管理员
- **请求体**:
```json
{
  "periodId": 8,
  "day": 1,
  "title": "第一天 品德成功论",
  "subtitle": "了解品德的重要性",
  "startTime": "2025-10-11T06:59:00.000Z",
  "endTime": "2025-10-13T06:59:59.000Z",
  "meditation": "开始学习之前...",
  "question": "品德成功论和个性成功论有什么区别？",
  "content": "<p>纵观历史...</p>",
  "reflection": "哪一句话触动了我？",
  "action": "把感触记录下来...",
  "isPublished": true
}
```

### 4.5 更新课节（管理员）

- **PUT** `/api/v1/sections/:sectionId`
- **鉴权**: 管理员

### 4.6 删除课节（管理员）

- **DELETE** `/api/v1/sections/:sectionId`
- **鉴权**: 管理员

---

## 五、打卡接口 `/api/v1/checkins` (9个)

### 5.1 创建打卡

- **POST** `/api/v1/checkins`
- **鉴权**: 需要
- **请求体**:
```json
{
  "sectionId": 802,
  "content": "今天学习了品德成功论，深有感触...",
  "images": ["https://..."],
  "videos": [],
  "voices": [],
  "visibility": "all"
}
```

### 5.2 获取打卡列表

- **GET** `/api/v1/checkins`
- **鉴权**: 需要
- **查询参数**: `page`, `pageSize`, `periodId`, `sectionId`, `userId`, `visibility`

### 5.3 获取用户打卡列表

- **GET** `/api/v1/checkins/user/:userId?`
- **鉴权**: 需要
- **路径参数**: `userId` - 可选，不传则为当前用户

> 🆕 新增路由路径

### 5.4 获取期次打卡列表（广场）

- **GET** `/api/v1/checkins/period/:periodId`
- **鉴权**: 需要

> 🆕 新增接口

### 5.5 点赞打卡

- **POST** `/api/v1/checkins/:checkinId/like`
- **鉴权**: 需要

### 5.6 取消点赞打卡

- **DELETE** `/api/v1/checkins/:checkinId/like`
- **鉴权**: 需要

> ⚠️ 注意：v3.0 文档中点赞/取消都是 POST，实际取消用 DELETE

### 5.7 获取打卡详情

- **GET** `/api/v1/checkins/:checkinId`
- **鉴权**: 需要

### 5.8 更新打卡

- **PUT** `/api/v1/checkins/:checkinId`
- **鉴权**: 需要

> ⚠️ 注意：v3.0 文档中为 PATCH，实际为 PUT

### 5.9 删除打卡

- **DELETE** `/api/v1/checkins/:checkinId`
- **鉴权**: 需要

---

## 六、评论接口 `/api/v1/comments` (9个)

### 6.1 创建评论

- **POST** `/api/v1/comments`
- **鉴权**: 需要
- **请求体**:
```json
{
  "checkinId": 1,
  "content": "写得很好！"
}
```

> ⚠️ 注意：v3.0 中为 `POST /checkins/:checkinId/comments`，实际为 `POST /comments`（checkinId 在 body 中传）

### 6.2 获取打卡的评论列表

- **GET** `/api/v1/comments/checkin/:checkinId`
- **鉴权**: 需要

> ⚠️ 注意：v3.0 中为 `GET /checkins/:checkinId/comments`，实际路径不同

### 6.3 删除评论

- **DELETE** `/api/v1/comments/:commentId`
- **鉴权**: 需要

### 6.4 点赞评论

- **POST** `/api/v1/comments/:commentId/like`
- **鉴权**: 需要

### 6.5 取消点赞评论

- **DELETE** `/api/v1/comments/:commentId/like`
- **鉴权**: 需要

### 6.6 回复评论

- **POST** `/api/v1/comments/:commentId/replies`
- **鉴权**: 需要
- **请求体**:
```json
{
  "content": "谢谢你的鼓励！",
  "toUserId": 2
}
```

### 6.7 删除回复

- **DELETE** `/api/v1/comments/:commentId/replies/:replyId`
- **鉴权**: 需要

> ⚠️ 注意：v3.0 中为 `DELETE /replies/:id`，实际路径含 commentId

### 6.8 点赞回复

- **POST** `/api/v1/comments/:commentId/replies/:replyId/like`
- **鉴权**: 需要

### 6.9 取消点赞回复

- **DELETE** `/api/v1/comments/:commentId/replies/:replyId/like`
- **鉴权**: 需要

---

## 七、小凡看见接口 `/api/v1/insights` (18个)

### 用户接口

#### 7.1 创建小凡看见

- **POST** `/api/v1/insights`
- **鉴权**: 需要
- **请求体**:
```json
{
  "checkinId": 1,
  "content": "从你的分享中...",
  "visibility": "private"
}
```

#### 7.2 生成 AI 反馈

- **POST** `/api/v1/insights/generate`
- **鉴权**: 需要
- **请求体**:
```json
{
  "checkinId": 1
}
```

> 🆕 独立的 AI 生成接口

#### 7.3 获取用户反馈列表

- **GET** `/api/v1/insights/user/:userId?`
- **鉴权**: 需要
- **路径参数**: `userId` 可选

> ⚠️ v3.0 中为 `GET /users/me/insights`

#### 7.4 获取反馈详情

- **GET** `/api/v1/insights/:insightId`
- **鉴权**: 需要

#### 7.5 更新反馈

- **PUT** `/api/v1/insights/:insightId`
- **鉴权**: 需要

#### 7.6 删除反馈

- **DELETE** `/api/v1/insights/:insightId`
- **鉴权**: 需要

#### 7.7 点赞小凡看见

- **POST** `/api/v1/insights/:insightId/like`
- **鉴权**: 需要

> 🆕 新增

#### 7.8 取消点赞小凡看见

- **POST** `/api/v1/insights/:insightId/unlike`
- **鉴权**: 需要

> 🆕 新增

### 查看申请接口

#### 7.9 创建查看申请

- **POST** `/api/v1/insights/requests`
- **鉴权**: 需要
- **请求体**:
```json
{
  "insightOwnerId": 1,
  "message": "想看看你的感悟"
}
```

> ⚠️ v3.0 中为 `POST /insights/:id/request`

#### 7.10 检查申请状态

- **GET** `/api/v1/insights/requests/status/:userId`
- **鉴权**: 需要

> 🆕 新增

#### 7.11 获取收到的申请

- **GET** `/api/v1/insights/requests/received`
- **鉴权**: 需要

#### 7.12 获取发起的申请

- **GET** `/api/v1/insights/requests/sent`
- **鉴权**: 需要

> 🆕 新增

#### 7.13 同意查看申请

- **POST** `/api/v1/insights/requests/:requestId/approve`
- **鉴权**: 需要

#### 7.14 拒绝查看申请

- **POST** `/api/v1/insights/requests/:requestId/reject`
- **鉴权**: 需要

#### 7.15 撤销已批准权限

- **PUT** `/api/v1/insights/requests/:requestId/revoke`
- **鉴权**: 需要

> 🆕 新增

### 管理员接口

#### 7.16 获取小凡看见列表（管理后台）

- **GET** `/api/v1/insights`
- **鉴权**: 管理员

#### 7.17 按期次获取小凡看见

- **GET** `/api/v1/insights/period/:periodId`
- **鉴权**: 需要

> 🆕 新增

#### 7.18 手动创建小凡看见（管理员）

- **POST** `/api/v1/insights/manual/create`
- **鉴权**: 管理员

#### 7.19 删除小凡看见（管理员）

- **DELETE** `/api/v1/insights/manual/:insightId`
- **鉴权**: 管理员

### 管理员申请管理

#### 7.20 获取申请列表（管理员）

- **GET** `/api/v1/insights/admin/requests`
- **鉴权**: 管理员

#### 7.21 获取申请统计

- **GET** `/api/v1/insights/admin/requests/stats`
- **鉴权**: 管理员

#### 7.22 管理员同意申请

- **PUT** `/api/v1/insights/admin/requests/:requestId/approve`
- **鉴权**: 管理员

#### 7.23 管理员拒绝申请

- **PUT** `/api/v1/insights/admin/requests/:requestId/reject`
- **鉴权**: 管理员

#### 7.24 管理员删除申请

- **DELETE** `/api/v1/insights/admin/requests/:requestId`
- **鉴权**: 管理员

#### 7.25 批量同意申请

- **POST** `/api/v1/insights/admin/requests/batch-approve`
- **鉴权**: 管理员

### 外部接口

#### 7.26 外部系统创建小凡看见

- **POST** `/api/v1/insights/external/create`
- **鉴权**: 无
- **请求体**:
```json
{
  "targetUserId": "user_id_string",
  "periodName": "勇敢的心",
  "title": "积极主动",
  "day": 1,
  "content": "文字内容",
  "imageUrl": "https://..."
}
```
- **说明**: `content` 和 `imageUrl` 二选一
- **响应**: 返回创建的 insight 对象，包含 `periodName` 课程名称字段

---

## 八、报名接口 `/api/v1/enrollments` (10个) 🆕

> 整个模块在 v3.0 文档中未记录

### 8.1 提交报名表单

- **POST** `/api/v1/enrollments`
- **鉴权**: 需要
- **请求体**:
```json
{
  "periodId": "期次ID",
  "name": "用户姓名",
  "phone": "手机号"
}
```

### 8.2 提交报名（完整表单）

- **POST** `/api/v1/enrollments/submit`
- **鉴权**: 需要

### 8.3 简化报名

- **POST** `/api/v1/enrollments/simple`
- **鉴权**: 需要
- **请求体**:
```json
{
  "periodId": "期次ID"
}
```

### 8.4 检查是否已报名

- **GET** `/api/v1/enrollments/check/:periodId`
- **鉴权**: 需要

### 8.5 获取期次成员列表

- **GET** `/api/v1/enrollments/period/:periodId`
- **鉴权**: 需要

### 8.6 获取用户报名列表

- **GET** `/api/v1/enrollments/user/:userId?`
- **鉴权**: 需要

### 8.7 退出期次

- **DELETE** `/api/v1/enrollments/:enrollmentId`
- **鉴权**: 需要

### 8.8 完成期次（管理员）

- **PUT** `/api/v1/enrollments/:enrollmentId/complete`
- **鉴权**: 管理员

### 8.9 获取报名列表（管理员）

- **GET** `/api/v1/enrollments`
- **鉴权**: 管理员

### 8.10 更新报名记录（管理员）

- **PUT** `/api/v1/enrollments/:id`
- **鉴权**: 管理员

### 8.11 删除报名记录（管理员）

- **DELETE** `/api/v1/enrollments/:id`
- **鉴权**: 管理员

### 外部接口

#### 8.12 根据期次名获取用户列表

- **GET** `/api/v1/enrollments/external/users-by-period?periodName=勇敢的心`
- **鉴权**: 无

---

## 九、支付接口 `/api/v1/payments` (7个) 🆕

> 整个模块在 v3.0 文档中未记录

### 9.1 初始化支付

- **POST** `/api/v1/payments`
- **鉴权**: 需要
- **请求体**:
```json
{
  "enrollmentId": "报名记录ID",
  "amount": 99.0
}
```

### 9.2 获取支付列表（管理员）

- **GET** `/api/v1/payments`
- **鉴权**: 管理员

### 9.3 获取用户支付记录

- **GET** `/api/v1/payments/user/:userId?`
- **鉴权**: 需要

### 9.4 查询支付状态

- **GET** `/api/v1/payments/:paymentId`
- **鉴权**: 需要

### 9.5 确认支付

- **POST** `/api/v1/payments/:paymentId/confirm`
- **鉴权**: 需要

### 9.6 取消支付

- **POST** `/api/v1/payments/:paymentId/cancel`
- **鉴权**: 需要

### 9.7 模拟支付确认（开发测试）

- **POST** `/api/v1/payments/:paymentId/mock-confirm`
- **鉴权**: 需要

### 9.8 微信支付回调

- **POST** `/api/v1/payments/wechat/callback`
- **鉴权**: 无（微信服务器调用）

---

## 十、排行榜接口 `/api/v1/ranking` (1个)

### 10.1 获取期次排行榜

- **GET** `/api/v1/ranking/period/:periodId`
- **鉴权**: 需要

> ⚠️ v3.0 中有 `GET /rankings/checkins` 和 `GET /rankings/points`，实际只有一个按期次查排行榜

---

## 十一、通知接口 `/api/v1/notifications` (10个)

### 11.1 获取通知列表

- **GET** `/api/v1/notifications`
- **鉴权**: 需要
- **查询参数**: `page`, `pageSize`, `type`, `isRead`

### 11.2 获取未读数量

- **GET** `/api/v1/notifications/unread`
- **鉴权**: 需要

> ⚠️ v3.0 中为 `GET /notifications/unread-count`

### 11.3 获取已归档通知

- **GET** `/api/v1/notifications/archived`
- **鉴权**: 需要

> 🆕 新增

### 11.4 标记已读

- **PUT** `/api/v1/notifications/:notificationId/read`
- **鉴权**: 需要

> ⚠️ v3.0 中为 PATCH

### 11.5 全部标记已读

- **PUT** `/api/v1/notifications/read-all`
- **鉴权**: 需要

### 11.6 归档通知

- **PUT** `/api/v1/notifications/:notificationId/archive`
- **鉴权**: 需要

> 🆕 新增

### 11.7 取消归档

- **PUT** `/api/v1/notifications/:notificationId/unarchive`
- **鉴权**: 需要

> 🆕 新增

### 11.8 归档所有通知

- **PUT** `/api/v1/notifications/archive-all`
- **鉴权**: 需要

> 🆕 新增

### 11.9 删除通知

- **DELETE** `/api/v1/notifications/:notificationId`
- **鉴权**: 需要

> 🆕 新增

### 11.10 删除所有通知

- **DELETE** `/api/v1/notifications`
- **鉴权**: 需要

> 🆕 新增

---

## 十二、文件上传接口 `/api/v1/upload` (3个)

### 12.1 上传单个文件

- **POST** `/api/v1/upload`
- **鉴权**: 管理员
- **Content-Type**: `multipart/form-data`
- **请求参数**: `file` - 文件字段
- **支持格式**: jpeg, jpg, png, gif, webp, pdf, doc, docx, xls, xlsx, mp4, webm
- **大小限制**: 50MB

> ⚠️ v3.0 中分为 `/upload/image`、`/upload/video`、`/upload/audio`，实际合并为一个接口

### 12.2 上传多个文件

- **POST** `/api/v1/upload/multiple`
- **鉴权**: 管理员
- **Content-Type**: `multipart/form-data`
- **请求参数**: `files` - 文件字段（最多10个）

> 🆕 新增

### 12.3 删除文件

- **DELETE** `/api/v1/upload/:filename`
- **鉴权**: 管理员

---

## 十三、统计接口 `/api/v1/stats` (4个) 🆕

### 13.1 仪表板统计

- **GET** `/api/v1/stats/dashboard`
- **鉴权**: 管理员

### 13.2 报名统计

- **GET** `/api/v1/stats/enrollments`
- **鉴权**: 管理员

### 13.3 支付统计

- **GET** `/api/v1/stats/payments`
- **鉴权**: 管理员

### 13.4 打卡统计

- **GET** `/api/v1/stats/checkin`
- **鉴权**: 需要（用户可查自己）

---

## 十四、管理后台接口 `/api/v1` (前缀为 admin routes)

### 管理员认证 (6个)

#### 14.1 管理员登录

- **POST** `/api/v1/auth/admin/login`
- **鉴权**: 无
- **请求体**:
```json
{
  "username": "admin",
  "password": "password123"
}
```

> 🆕 整个管理员认证体系为新增

#### 14.2 初始化超级管理员

- **POST** `/api/v1/auth/admin/init`
- **鉴权**: 无

#### 14.3 获取管理员资料

- **GET** `/api/v1/auth/admin/profile`
- **鉴权**: 管理员

#### 14.4 管理员登出

- **POST** `/api/v1/auth/admin/logout`
- **鉴权**: 管理员

#### 14.5 管理员刷新 Token

- **POST** `/api/v1/auth/admin/refresh-token`
- **鉴权**: 管理员

#### 14.6 修改密码

- **POST** `/api/v1/auth/admin/change-password`
- **鉴权**: 管理员

#### 14.7 验证数据库访问

- **POST** `/api/v1/auth/admin/verify-db-access`
- **鉴权**: 管理员

### 超级管理员 (4个)

#### 14.8 获取管理员列表

- **GET** `/api/v1/admins`
- **鉴权**: 超级管理员

#### 14.9 创建管理员

- **POST** `/api/v1/admins`
- **鉴权**: 超级管理员

#### 14.10 更新管理员

- **PUT** `/api/v1/admins/:id`
- **鉴权**: 超级管理员

#### 14.11 删除管理员

- **DELETE** `/api/v1/admins/:id`
- **鉴权**: 超级管理员

### 打卡管理 (3个)

#### 14.12 获取打卡列表（管理员视图）

- **GET** `/api/v1/admin/checkins`
- **鉴权**: 管理员

#### 14.13 获取打卡统计

- **GET** `/api/v1/admin/checkins/stats`
- **鉴权**: 管理员

#### 14.14 删除打卡（管理员）

- **DELETE** `/api/v1/admin/checkins/:checkinId`
- **鉴权**: 管理员

### 期次/课节管理 (6个)

#### 14.15-14.17 期次 CRUD

- **POST** `/api/v1/admin/periods`
- **PUT** `/api/v1/admin/periods/:periodId`
- **DELETE** `/api/v1/admin/periods/:periodId`
- **鉴权**: 管理员

#### 14.18-14.20 课节 CRUD

- **POST** `/api/v1/admin/sections`
- **PUT** `/api/v1/admin/sections/:sectionId`
- **DELETE** `/api/v1/admin/sections/:sectionId`
- **鉴权**: 管理员

---

## 十五、审计日志接口 `/api/v1/audit-logs` (6个) 🆕

### 15.1 获取审计日志

- **GET** `/api/v1/audit-logs`
- **鉴权**: 需要
- **查询参数**: `page`, `pageSize`, `adminId`, `actionType`, `resourceType`, `startDate`, `endDate`, `status`

### 15.2 操作统计

- **GET** `/api/v1/audit-logs/statistics`
- **鉴权**: 需要

### 15.3 管理员操作记录

- **GET** `/api/v1/audit-logs/admin/:adminId`
- **鉴权**: 需要

### 15.4 资源操作记录

- **GET** `/api/v1/audit-logs/resource/:resourceType/:resourceId`
- **鉴权**: 需要

### 15.5 导出 CSV

- **GET** `/api/v1/audit-logs/export`
- **鉴权**: 需要

### 15.6 清理过期日志

- **POST** `/api/v1/audit-logs/cleanup`
- **鉴权**: 管理员

---

## 十六、健康检查接口 (4个) 🆕

> 挂载在 `/` 和 `/api/v1` 两个前缀下

### 16.1 健康检查

- **GET** `/api/v1/health`
- **鉴权**: 无

### 16.2 详细状态

- **GET** `/api/v1/status`
- **鉴权**: 无

### 16.3 就绪检查

- **GET** `/api/v1/ready`
- **鉴权**: 无

### 16.4 活跃性检查

- **GET** `/api/v1/live`
- **鉴权**: 无

---

## 十七、监控接口 `/api/v1/monitoring` (5个) 🆕

### 17.1 实时指标

- **GET** `/api/v1/monitoring/metrics`
- **鉴权**: 需要

### 17.2 健康检查

- **GET** `/api/v1/monitoring/health`
- **鉴权**: 无

### 17.3 告警记录

- **GET** `/api/v1/monitoring/alerts`
- **鉴权**: 需要

### 17.4 清空告警

- **POST** `/api/v1/monitoring/alerts/clear`
- **鉴权**: 需要

### 17.5 监控统计

- **GET** `/api/v1/monitoring/stats`
- **鉴权**: 需要

---

## 十八、备份管理接口 `/api/v1/backup` (9个) 🆕

> 所有接口需管理员权限

### 18.1 MongoDB 统计

- **GET** `/api/v1/backup/mongodb/stats`

### 18.2 MySQL 统计

- **GET** `/api/v1/backup/mysql/stats`

### 18.3 对比 MongoDB 和 MySQL

- **GET** `/api/v1/backup/compare`

### 18.4 字段级详细对比

- **GET** `/api/v1/backup/compare/fields?tableName=users`

### 18.5 MongoDB 数据查询

- **GET** `/api/v1/backup/mongodb/data?table=users&page=1&limit=20`

### 18.6 MySQL 数据查询

- **GET** `/api/v1/backup/mysql/data?table=users&page=1&limit=20`

### 18.7 全量同步

- **POST** `/api/v1/backup/sync/full`

### 18.8 差量同步

- **POST** `/api/v1/backup/sync/delta`

### 18.9 全量恢复

- **POST** `/api/v1/backup/recover/full`

### 18.10 更新 MongoDB 记录

- **PUT** `/api/v1/backup/mongodb/record`

### 18.11 删除 MongoDB 记录

- **DELETE** `/api/v1/backup/mongodb/record`

---

## 附录 A：v3.0 → v4.0 差异总结

### 新增模块（7个）

| 模块 | 路由前缀 | 接口数 |
|------|---------|--------|
| 报名管理 | `/api/v1/enrollments` | 12 |
| 支付管理 | `/api/v1/payments` | 8 |
| 统计数据 | `/api/v1/stats` | 4 |
| 审计日志 | `/api/v1/audit-logs` | 6 |
| 健康检查 | `/api/v1/health` 等 | 4 |
| 监控 | `/api/v1/monitoring` | 5 |
| 备份管理 | `/api/v1/backup` | 11 |

### URL 变更

| v3.0 文档 | 实际实现 |
|-----------|---------|
| `PATCH /users/me` | `PUT /users/profile` |
| `GET /users/me/stats` | `GET /users/:userId/stats` |
| `GET /sections/today` | `GET /sections/today/task` |
| `PATCH /checkins/:id` | `PUT /checkins/:checkinId` |
| `POST /checkins/:id/like` (action=unlike) | `DELETE /checkins/:checkinId/like` |
| `POST /checkins/:checkinId/comments` | `POST /comments` (checkinId in body) |
| `GET /checkins/:checkinId/comments` | `GET /comments/checkin/:checkinId` |
| `DELETE /replies/:id` | `DELETE /comments/:commentId/replies/:replyId` |
| `POST /insights` (AI生成) | `POST /insights/generate` |
| `GET /users/me/insights` | `GET /insights/user/:userId?` |
| `POST /insights/:id/request` | `POST /insights/requests` |
| `GET /rankings/checkins` | `GET /ranking/period/:periodId` |
| `GET /notifications/unread-count` | `GET /notifications/unread` |
| `PATCH /notifications/:id/read` | `PUT /notifications/:notificationId/read` |
| `POST /upload/image` | `POST /upload` (统一上传) |
| `POST /periods/:id/enroll` | `POST /enrollments` (独立模块) |

### HTTP 方法变更

| 接口 | v3.0 方法 | 实际方法 |
|------|----------|---------|
| 更新用户资料 | PATCH | PUT |
| 更新打卡 | PATCH | PUT |
| 标记通知已读 | PATCH | PUT |
| 全部标记已读 | PATCH | PUT |
| 取消点赞打卡 | POST (action=unlike) | DELETE |

---

## 附录 B：接口统计

| 模块 | 接口数 |
|------|--------|
| 认证 | 3 |
| 用户 | 7 |
| 期次 | 9 |
| 课节 | 6 |
| 打卡 | 9 |
| 评论/回复 | 9 |
| 小凡看见 | 26 |
| 报名 | 12 |
| 支付 | 8 |
| 排行榜 | 1 |
| 通知 | 10 |
| 文件上传 | 3 |
| 统计 | 4 |
| 管理后台 | 19 |
| 审计日志 | 6 |
| 健康检查 | 4 |
| 监控 | 5 |
| 备份管理 | 11 |

**总计: ~152 个 API 接口**（含调试接口）

---

**文档版本**: v4.0
**更新日期**: 2026-03-08
**基于**: 后端实际路由代码分析
