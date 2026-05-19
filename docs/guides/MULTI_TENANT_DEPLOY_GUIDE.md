# 多租户版本上线 Runbook

**版本**: 3.0
**最后更新**: 2026-05-19
**适用分支**: `feature/multi-tenant` → `main`
**线上服务器**: `ubuntu@118.25.145.179`
**线上域名**: `https://wx.shubai01.com`

> **安全红线**：禁止执行 `backend/scripts/init-mongodb.js` 或任何 `init-*.js`。禁止 `DROP DATABASE`、`deleteMany({})`、`db.dropDatabase()`。

---

## 发布策略

分三个阶段，小程序最后发布：

1. **后端上线 + 数据迁移**（服务器操作）
2. **本地连线上验证**（本地开发工具连线上 API 测试）
3. **小程序正式发布**（微信公众平台，已审核通过，手动点发布）

---

## 阶段一：后端上线 + 数据迁移

### 1.1 本地构建验证

```bash
# 管理后台构建检查
cd admin
npm run type-check
npm run build

# 后端语法检查
cd ../backend
node --check src/server.js
node --check scripts/migrate-to-multi-tenant.js
node --check scripts/validate-multi-tenant-deploy.js
```

全部通过后继续。

### 1.2 线上备份

```bash
ssh ubuntu@118.25.145.179

TS=$(date +%Y%m%d-%H%M%S)
BACKUP_ROOT=/home/ubuntu/backups/multi-tenant-release-$TS
mkdir -p "$BACKUP_ROOT"

# 备份代码和上传文件
tar --exclude="morning-reading/backend/node_modules" \
    --exclude="morning-reading/node_modules" \
    --exclude="morning-reading/admin/node_modules" \
    --exclude="morning-reading/backend/logs" \
    -czf "$BACKUP_ROOT/app-files-$TS.tar.gz" \
    /var/www/morning-reading

echo "备份完成: $BACKUP_ROOT"
```

MongoDB 和 MySQL 备份（如果服务器没有 mongodump/mysqldump，用 Node 脚本导出）：

```bash
cd /var/www/morning-reading/backend

# MongoDB 导出
node -e "
require('dotenv').config({ path: '.env.production' });
require('dotenv').config({ path: '.env', override: false });
const { execSync } = require('child_process');
const ts = '$TS';
// 如有 mongodump:
// execSync('mongodump --uri=\"' + process.env.MONGODB_URI + '\" --out /home/ubuntu/backups/multi-tenant-release-' + ts + '/mongo');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '已配置' : '未配置');
"

# MySQL 导出
mysqldump -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
  > "$BACKUP_ROOT/mysql-$TS.sql" 2>/dev/null || \
  echo "mysqldump 不可用，请用 Node 脚本导出"
```

**备份完成后把 tar 包拉回本地**：

```bash
# 本地执行
scp -r ubuntu@118.25.145.179:/home/ubuntu/backups/multi-tenant-release-$TS ./backups/production/
```

### 1.3 上传新代码（不重启）

```bash
# 本地执行
cd "/Users/lion/Nutstore Files/我的坚果云/flylion/AI项目开发/七个习惯晨读营-multi-tenant"

rsync -avz --delete \
  --exclude node_modules \
  --exclude backend/.env \
  --exclude backend/.env.production \
  --exclude backend/uploads \
  --exclude admin/node_modules \
  --exclude admin/dist \
  --exclude .git \
  ./ ubuntu@118.25.145.179:/var/www/morning-reading/
```

### 1.4 线上安装依赖（不重启）

```bash
ssh ubuntu@118.25.145.179
cd /var/www/morning-reading/backend
npm install --omit=dev
```

### 1.5 确认线上环境变量

> `.env.production` 只存在于线上服务器，本地不存在（敏感信息不入库）。此步骤直接在线上服务器操作。

```bash
# 线上服务器执行：检查现有变量
grep -E "MONGODB_URI|MYSQL|WECHAT|JWT|ENABLE_LEGACY" /var/www/morning-reading/backend/.env.production
```

必须存在以下变量：

| 变量 | 是否新增 | 说明 |
|---|---|---|
| `ENABLE_LEGACY_DEFAULT_TENANT=true` | **新增** | 兼容旧小程序客户端未传 `X-Wx-AppId` 的请求，必须为 `true` |
| `MONGODB_URI` | 已有 | 线上 MongoDB 连接串 |
| `MYSQL_HOST` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE` | 已有 | MySQL 连接 |
| `WECHAT_APPID` | 已有 | 线上小程序 AppID，迁移脚本会读取配置 `fanren` 租户 |
| `WECHAT_SECRET` | 已有 | 线上小程序 Secret |
| `WECHAT_MCH_ID` | 已有 | 微信支付商户号 |
| `WECHAT_API_KEY` | 已有 | 微信支付 API Key |
| `WECHAT_NOTIFY_URL` | 已有 | `https://wx.shubai01.com/api/v1/payments/wechat/callback` |
| `JWT_SECRET` | 已有 | JWT 密钥 |

如 `ENABLE_LEGACY_DEFAULT_TENANT` 缺失，在线上服务器补充：

```bash
echo "ENABLE_LEGACY_DEFAULT_TENANT=true" >> /var/www/morning-reading/backend/.env.production
```

> **何时去掉**：新小程序多租户版本发布并稳定覆盖大部分用户后，再删除此行或改为 `false`。上线初期保持 `true`。

### 1.6 停止后端（进入维护窗口）

```bash
pm2 stop morning-reading-backend
pm2 status
```

确认状态为 `stopped` 后继续。

### 1.7 执行 MongoDB 多租户迁移

```bash
cd /var/www/morning-reading/backend
node scripts/migrate-to-multi-tenant.js
```

脚本会做：
- 创建 `slug=fanren` 租户（幂等，已存在则更新配置）
- 所有历史业务集合补 `tenantId`
- 删除旧全局唯一索引，创建带 `tenantId` 的新唯一索引
- `superadmin/platform_superadmin` 保持 `tenantId=null`，其他管理员绑定 `fanren`
- 历史上传文件迁移到 `uploads/tenants/fanren/`，数据库中 URL 同步重写

预期输出末尾：`[migrate] 迁移完成 { tenantId: '...', slug: 'fanren' }`

### 1.8 执行 MySQL 结构迁移

```bash
cd /var/www/morning-reading/backend

# 优先用 mysql CLI
mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
  < database/mysql-tenant-migration.sql

# 如果没有 mysql 命令，用 Node 执行
node - <<'NODE'
require('dotenv').config({ path: '.env.production' });
require('dotenv').config({ path: '.env', override: false });
const fs = require('fs');
const mysql = require('mysql2/promise');
(async () => {
  const sql = fs.readFileSync('database/mysql-tenant-migration.sql', 'utf8');
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'morning_reading',
    multipleStatements: true
  });
  await conn.query(sql);
  await conn.end();
  console.log('MySQL 迁移完成');
})();
NODE
```

### 1.9 迁移后校验

```bash
cd /var/www/morning-reading/backend
node scripts/validate-multi-tenant-deploy.js --phase post-migration
```

**必须全部通过才能继续**。脚本校验：
- `fanren` 租户存在，绑定 `WECHAT_APPID` 和 `wechatPay.mchId`
- 所有业务集合无缺失 `tenantId` 的文档
- `superadmin/platform_superadmin` 的 `tenantId` 为空，其他管理员已绑定租户
- MongoDB 唯一索引已替换为 `tenant_*_unique`
- MySQL 14 张表都有 `tenant_id` 列和 `idx_tenant_id` 索引

如果脚本报错，根据错误信息修复后重跑，不要强行继续。

### 1.10 重启后端

```bash
pm2 restart morning-reading-backend
pm2 logs morning-reading-backend --lines 50
```

观察日志，确认没有以下错误：
- `TenantContextError`
- `Unknown column 'tenant_id'`
- `未识别的小程序 appId`
- `缺少 X-Wx-AppId`
- 支付验签错误

### 1.11 部署管理后台

```bash
# 本地执行
cd "/Users/lion/Nutstore Files/我的坚果云/flylion/AI项目开发/七个习惯晨读营-multi-tenant/admin"
npm run build

rsync -avz --delete dist/ ubuntu@118.25.145.179:/var/www/morning-reading/admin/dist/
```

```bash
# 线上执行
sudo nginx -t && sudo nginx -s reload
```

---

## 1.12 线上小程序验证（阶段一收尾）

> 目标：用线上正式小程序（当前线上版本，非新版）验证老用户核心功能正常。全部通过再进阶段二；有问题立即回滚。

用真实微信账号在线上小程序操作：

- [ ] 老用户登录成功，首页期次和课节正常显示
- [ ] 历史打卡记录可见
- [ ] 打卡提交正常
- [ ] 评论、通知正常

**如果任一项失败**，立即回滚（见文末回滚策略），不要继续阶段二。

---

## 阶段二：本地连线上验证

> 目标：用本地开发工具（小程序开发者工具 + 管理后台）连线上 API，验证核心功能正常，再决定是否发布小程序。

### 2.1 后端接口 smoke test

```bash
# 健康检查
curl -f https://wx.shubai01.com/api/v1/health

# 管理后台登录（获取 token）
curl -s -X POST https://wx.shubai01.com/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<管理员邮箱>","password":"<密码>"}' | python3 -m json.tool

# 用获取到的 token 验证以下接口
TOKEN="<上面获取的token>"
TENANT_ID="<fanren租户ID>"

# 当前租户信息
curl -f https://wx.shubai01.com/api/v1/admin/current-tenant \
  -H "Authorization: Bearer $TOKEN"

# 用户列表（指定租户）
curl -f "https://wx.shubai01.com/api/v1/users?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Active-Tenant: $TENANT_ID"

# 数据库管理页 MongoDB 统计
curl -f "https://wx.shubai01.com/api/v1/backup/mongodb/stats" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Active-Tenant: $TENANT_ID"

# 数据库管理页 MySQL 统计
curl -f "https://wx.shubai01.com/api/v1/backup/mysql/stats" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Active-Tenant: $TENANT_ID"
```

全部返回 200，无 500。

### 2.2 管理后台验收

打开 `https://wx.shubai01.com/admin`（或线上管理后台地址）：

- [ ] 登录成功，右上角显示租户选择器
- [ ] `superadmin/platform_superadmin` 可切换租户，选"所有租户"可见平台级账号
- [ ] 选中 `fanren` 租户后，账号管理页不显示 `superadmin/platform_superadmin`
- [ ] 用户列表、期次列表数据正常
- [ ] 数据库管理页 MongoDB 统计正常加载（无 500）
- [ ] 数据库管理页 MySQL 数据按租户过滤正确
- [ ] 创建管理员表单有租户选择器，默认为当前激活租户

### 2.3 小程序本地连线上测试

微信开发者工具：
- 项目设置 → 不校验合法域名（本地测试用）
- `miniprogram/config/env.js` 的 `currentEnv` 保持 `prod`（已审核版本）
- 确认 prod `wxAppId` 与线上 `fanren` 租户一致

测试路径：
- [ ] 老用户登录，首页期次和课节正常显示
- [ ] 打卡提交正常
- [ ] 评论、通知正常
- [ ] 支付流程正常（可用测试金额验证）

---

## 阶段三：发布小程序

> 前提：阶段二全部验收通过。

微信公众平台 → 小程序管理 → 版本管理 → 找到已审核通过的版本 → **发布**。

发布后：
- [ ] 线上小程序能正常登录
- [ ] 老用户数据完整，历史打卡记录可见
- [ ] 观察后端日志 30 分钟，无异常错误

---

## 回滚策略

### 还没执行数据库迁移（1.6 之前）

直接恢复旧代码，重启后端：

```bash
cd /var/www
tar -xzf /home/ubuntu/backups/multi-tenant-release-<TS>/app-files-<TS>.tar.gz
pm2 restart morning-reading-backend
```

### 已迁移数据库，但还没有第二租户写入

可短期回滚旧代码（旧代码忽略 `tenantId` 字段，不影响读写）。注意：
- 上传文件已迁到 `/uploads/tenants/fanren/`，旧代码路径不兼容时需同时恢复 `backend/uploads`
- MySQL 多出的 `tenant_id` 列旧代码会忽略，无影响

### 已有第二租户写入

不能回滚旧代码。只能：
1. 修复新服务继续运行，或
2. 全量恢复备份（接受备份后所有写入丢失，需停机窗口）

### 小程序回滚

微信公众平台 → 版本管理 → 回退到上一线上版本。
后端保持 `ENABLE_LEGACY_DEFAULT_TENANT=true`，旧小程序未传 `X-Wx-AppId` 也能访问默认租户。

---

## 禁止事项

- 禁止执行 `backend/scripts/init-mongodb.js`
- 禁止先重启新后端再迁移数据库
- 禁止执行 `DROP DATABASE`、`deleteMany({})`、`db.dropDatabase()`
- 禁止在未备份时迁移上传文件
- 禁止未经用户确认执行任何数据库重置操作

---

## 本次上线经验总结（2026-05-19）

### 问题一：老用户 token 缺少 tenantId 导致全量 403

**现象**：后端重启后，线上老小程序所有接口返回 403"令牌缺少租户信息，请重新登录"。

**根因**：`userTenantContext` 中间件检查 `req.user.tenantId`，老 token 是迁移前签发的，JWT payload 里没有 `tenantId` 字段，直接返回 403。本地测试用的是新签发 token，无法复现。

**修复（第一次尝试，有坑）**：`userTenantContext` 在 `ENABLE_LEGACY_DEFAULT_TENANT=true` 时，若 token 无 `tenantId`，用 `withSystemContext(null, () => User.findById(...))` 从数据库查用户补全 `tenantId`。

**修复（最终版）**：上述方案在生产环境仍报 `[tenantPlugin] findOne 缺少 tenantId 上下文`。根因是 `withSystemContext` 通过 `AsyncLocalStorage.run()` 设置 bypass 上下文，但 ALS 上下文在 Express 中间件链的异步边界处传播不稳定，Mongoose pre-hook 执行时拿不到正确的 store。最终改为用原生 MongoDB collection 绕过 tenantPlugin：

```js
const col = mongoose.connection.db.collection('users');
const user = await col.findOne(
  { _id: new mongoose.Types.ObjectId(userId) },
  { projection: { tenantId: 1 } }
);
```

**未来发布脚本注意**：
- 上线后第一批请求必然来自持有老 token 的用户，`ENABLE_LEGACY_DEFAULT_TENANT=true` 不仅用于 `publicTenantContext`，也必须覆盖 `userTenantContext` 的兼容逻辑。
- 在 Express 中间件内部（尚未建立租户上下文时）需要查数据库，不要用 `withSystemContext` + Mongoose Model，改用 `mongoose.connection.db.collection(name).findOne(...)` 直接走原生驱动，完全绕过 tenantPlugin。

---

### 问题二：Mongoose select 路径冲突导致微信登录 401

**现象**：小程序登录接口返回 401，错误信息 `Path collision at wechatLogin.appSecret remaining portion appSecret`。

**根因**：`wechat.service.js` 中查询租户时写了 `.select('+wechatLogin.appSecret wechatLogin')`，同时 select 了父路径 `wechatLogin` 和子路径 `+wechatLogin.appSecret`，Mongoose 报路径冲突。本地开发时 `tenantId` 为空走环境变量兜底，没有执行到这行查询，迁移后租户存在才暴露。

**修复**：改为 `.select('+wechatLogin.appSecret')`，父对象其他字段自动包含。

**未来发布脚本注意**：凡是 `select: false` 的嵌套字段，只需 `+path.to.field`，不要同时 select 父路径。

---

### 问题三：用户头像 URL 未重写导致图片 404

**现象**：小程序首页用户头像全部 404，URL 仍是 `/uploads/xxx.jpg`，文件已迁移到 `/uploads/tenants/fanren/xxx.jpg`。

**根因**：`migrate-to-multi-tenant.js` 的 `rewriteUploadUrls` 函数漏掉了 `users` 集合的 `avatar` 和 `avatarUrl` 字段。其他集合（sections、checkins 等）已覆盖，用户头像未覆盖。

**修复**：在迁移脚本 `targets` 数组中补入 `{ collection: 'users', fields: ['avatar', 'avatarUrl'] }`，线上补跑 URL 重写（幂等，已重写的不会重复处理），修复 11 条记录。

**未来发布脚本注意**：
- 迁移脚本的 `rewriteUploadUrls` 必须覆盖所有含上传文件 URL 的集合和字段，上线前用以下查询验证：
  ```js
  db.users.countDocuments({ avatar: /^\/uploads\/(?!tenants\/)/ })
  db.users.countDocuments({ avatarUrl: /^\/uploads\/(?!tenants\/)/ })
  ```
  结果应为 0，否则需补跑重写。
- 不要用 nginx rewrite 作为多租户场景的长期方案，第二个租户上线后 rewrite 规则无法区分租户。

---

### MySQL 迁移工具问题

**现象**：线上没有 `mysql` CLI，`mysql-tenant-migration.sql` 含 `DELIMITER` 语法，`mysql2` Node 驱动不支持。

**修复**：用 Node 脚本直接执行等效的 `ALTER TABLE` 和 `information_schema` 查询，绕过 `DELIMITER`/`PROCEDURE` 语法。

**未来发布脚本注意**：`mysql-tenant-migration.sql` 应改写为不依赖 `DELIMITER` 的纯 SQL（用 `IF NOT EXISTS` 的 DDL 语法），或提供配套的 Node 执行脚本，避免每次上线都需要临时改写。
