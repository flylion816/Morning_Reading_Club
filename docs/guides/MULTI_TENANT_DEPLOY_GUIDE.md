# 多租户重构上线指南

**版本**: 1.0
**最后更新**: 2026-05-17
**适用分支**: feature/multi-tenant → main

> 本文档基于本地开发环境完整跑通的经验整理，涵盖数据库迁移、后端部署、小程序发布、管理后台发布的完整步骤，以及每个环节的常见坑。

---

## 核心架构变化说明

多租户重构引入了以下关键机制，上线前必须理解：

| 机制 | 说明 |
|------|------|
| `tenantPlugin` | Mongoose 插件，所有 Model 查询自动注入 `tenantId` 过滤 |
| `withSystemContext(tenantId, fn)` | 显式指定租户上下文执行 DB 操作，脚本/迁移专用 |
| `withSystemContext(null, fn)` | bypass 模式，跨租户查询，仅迁移脚本和备份使用 |
| `adminAuthMiddleware` | 管理后台 JWT 验证，解码结果放 `req.admin` |
| `adminTenantContext` | 管理后台租户上下文，从 `req.admin.tenantId` 解析 |
| `userTenantContext` | 小程序用户租户上下文，从 `req.user.tenantId` 解析 |
| `tenantStorage` | 小程序存储工具，key 自动加 `wxAppId:` 前缀隔离 |

**关键约束**：管理后台路由必须用 `adminAuthMiddleware + adminTenantContext`，不能用 `authMiddleware + userTenantContext`，否则返回 401。

---

## 第一步：代码准备

### 1.1 确认本地测试全部通过

```bash
cd backend
npm test
# 期望：1034 passing，0 failing
```

### 1.2 确认小程序环境切回 prod

编辑 `miniprogram/config/env.js`：

```js
const currentEnv = 'prod'; // 确保不是 'dev'
```

确认 prod 配置正确：

```js
prod: {
  apiBaseUrl: 'https://你的域名/api/v1',
  wxAppId: '线上小程序AppID',  // 必须与线上租户记录一致
}
```

### 1.3 提交并合并代码

```bash
git add -p  # 逐块确认，不要提交 .env、.env.config.js
git commit -m "feat: 多租户重构上线"
git checkout main
git merge feature/multi-tenant
git push origin main
```

---

## 第二步：数据库迁移（最重要，不可跳过）

> ⚠️ 线上有真实用户数据，**绝对不能跑 init-mongodb.js**。

### 2.1 备份线上数据库

```bash
ssh ubuntu@118.25.145.179
cd /var/www/morning-reading
bash scripts/backup-db.sh
# 确认备份文件存在后再继续
```

### 2.2 检查 Tenant 记录

```bash
mongosh "mongodb://admin:密码@127.0.0.1:27017/morning_reading?authSource=admin" --quiet
```

```js
// 查看所有租户
db.tenants.find({}, { slug: 1, name: 1, wxAppIds: 1, 'wechatLogin.appId': 1 })
```

确认：
- 租户记录存在
- `wechatLogin.appId` 或 `wxAppIds` 包含线上小程序的 AppID
- 如果缺少 wxAppId，执行：

```js
db.tenants.updateOne(
  { slug: '你的租户slug' },
  { $set: { 'wechatLogin.appId': '线上小程序AppID' } }
)
```

### 2.3 检查并修复 tenantId 为 null 的数据

```js
// 检查各集合中 tenantId 为 null 的数量
db.users.countDocuments({ tenantId: null })
db.periods.countDocuments({ tenantId: null })
db.sections.countDocuments({ tenantId: null })
db.enrollments.countDocuments({ tenantId: null })
db.checkins.countDocuments({ tenantId: null })
db.comments.countDocuments({ tenantId: null })
db.insights.countDocuments({ tenantId: null })
```

如果有 null 数据，找到租户 ID 后批量补填：

```js
const tenantId = ObjectId("线上租户的_id")

db.users.updateMany({ tenantId: null }, { $set: { tenantId } })
db.periods.updateMany({ tenantId: null }, { $set: { tenantId } })
db.sections.updateMany({ tenantId: null }, { $set: { tenantId } })
db.enrollments.updateMany({ tenantId: null }, { $set: { tenantId } })
db.checkins.updateMany({ tenantId: null }, { $set: { tenantId } })
db.comments.updateMany({ tenantId: null }, { $set: { tenantId } })
db.insights.updateMany({ tenantId: null }, { $set: { tenantId } })
```

### 2.4 清理无效头像 URL

```js
// 清除微信临时路径（无法被浏览器访问）
db.users.updateMany(
  { avatarUrl: /^http:\/\/tmp\// },
  { $set: { avatarUrl: null } }
)
```

### 2.5 确认管理员账号角色

```js
db.admins.find({}, { email: 1, role: 1, tenantId: 1 })
```

- `platform_superadmin` 或 `superadmin`：可访问租户管理
- `tenant_admin`：只能访问自己租户的数据，需绑定 `tenantId`

如果管理员没有绑定 tenantId：

```js
db.admins.updateOne(
  { email: 'admin@morningreading.com' },
  { $set: { tenantId: ObjectId("租户ID") } }
)
```

---

## 第三步：后端部署

### 3.1 拉取代码

```bash
ssh ubuntu@118.25.145.179
cd /var/www/morning-reading
git pull origin main
npm install --production
```

### 3.2 确认环境变量

检查 `.env` 文件包含以下关键项：

```bash
NODE_ENV=production
JWT_SECRET=原有值不能改，改了所有用户会被踢出
MONGODB_URI=mongodb://admin:密码@127.0.0.1:27017/morning_reading?authSource=admin
WECHAT_APPID=线上小程序AppID
WECHAT_SECRET=线上小程序Secret

# 兼容老版本小程序客户端（不传 wxAppId 的请求）
ENABLE_LEGACY_DEFAULT_TENANT=true
```

### 3.3 重启服务

```bash
pm2 restart morning-reading-backend
pm2 logs morning-reading-backend --lines 30
```

确认日志无报错，特别关注：
- `TenantContextError` — 说明有接口没有正确设置租户上下文
- `缺少 wxAppId` — 说明小程序没有传 wxAppId，检查 ENABLE_LEGACY_DEFAULT_TENANT

### 3.4 验证后端接口

```bash
# 健康检查
curl https://你的域名/health

# 登录接口（用线上小程序 code 测试）
curl -X POST https://你的域名/api/v1/auth/wechat/login \
  -H "Content-Type: application/json" \
  -d '{"code":"测试code","wxAppId":"线上AppID"}'
```

---

## 第四步：管理后台部署

### 4.1 本地构建

```bash
cd admin
npm run build
```

### 4.2 上传到服务器

```bash
rsync -avz dist/ ubuntu@118.25.145.179:/var/www/morning-reading-admin/
```

### 4.3 重载 Nginx

```bash
ssh ubuntu@118.25.145.179
sudo nginx -t  # 先验证配置
sudo nginx -s reload
```

### 4.4 验证管理后台

访问 `https://管理后台域名`，登录后逐一检查：
- 仪表板数据加载正常（无"加载支付数据失败"）
- 报名管理、用户管理列表正常
- 内容管理能加载课程列表
- 小凡看见页面不会跳出登录页
- 租户管理（superadmin 账号）能看到租户列表

---

## 第五步：小程序发布

### 5.1 在微信开发工具里

1. 确认 `miniprogram/config/env.js` 的 `currentEnv = 'prod'`
2. 取消勾选"不校验合法域名"（生产环境必须走合法域名）
3. 点击"上传"，填写版本号和备注

### 5.2 在微信公众平台

1. 登录 [mp.weixin.qq.com](https://mp.weixin.qq.com)
2. 版本管理 → 提交审核
3. 审核通过后点击发布

### 5.3 灰度验证

发布后先用体验版测试：
- 登录流程（新用户 + 老用户）
- 首页期次和今日任务显示
- 打卡功能
- 小凡看见

---

## 第六步：上线后验收

### 必检项

- [ ] 小程序能正常登录，token 正确存储
- [ ] 首页显示期次、今日任务、打卡记录
- [ ] 打卡提交成功
- [ ] 通知页面正常加载
- [ ] 管理后台登录后各页面无 401/403
- [ ] 管理后台小凡看见页面不跳出
- [ ] 管理后台内容管理能加载课程
- [ ] 支付流程正常（如有）

### 监控

```bash
# 实时查看后端日志
pm2 logs morning-reading-backend --lines 50

# 关注这些关键词
pm2 logs morning-reading-backend | grep -E "TenantContextError|ERROR|500|401"
```

---

## 常见问题排查

### 小程序登录返回 400 "缺少 wxAppId"

- 检查 `miniprogram/config/env.js` 的 prod wxAppId 是否正确
- 检查线上 Tenant 记录的 `wechatLogin.appId` 是否与小程序 AppID 一致
- 临时兜底：后端 `.env` 设置 `ENABLE_LEGACY_DEFAULT_TENANT=true`

### 小程序登录返回 403 "未识别的小程序 appId"

- Tenant 记录里没有这个 wxAppId
- 执行 2.2 步骤补填

### 管理后台某页面跳出登录

- 该页面的后端路由用了 `userTenantContext` 而不是 `adminTenantContext`
- 检查对应路由文件，参考 insight.routes.js 的修复方式

### 数据查询返回空（期次/用户看不到）

- 数据的 `tenantId` 为 null 或与当前租户不匹配
- 执行 2.3 步骤补填 tenantId

### 管理后台租户管理返回 403

- 管理员角色不是 `platform_superadmin` 或 `superadmin`
- 检查 `db.admins` 里的 role 字段

---

## 回滚方案

如果上线后出现严重问题：

```bash
# 回滚代码
ssh ubuntu@118.25.145.179
cd /var/www/morning-reading
git checkout 上一个稳定commit
npm install --production
pm2 restart morning-reading-backend
```

数据库迁移（tenantId 补填）是幂等操作，不需要回滚。

小程序回滚：微信公众平台 → 版本管理 → 回退到上一版本。
