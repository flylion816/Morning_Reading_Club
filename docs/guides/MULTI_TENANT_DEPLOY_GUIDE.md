# 多租户重构上线指南

**版本**: 2.1
**最后更新**: 2026-05-19
**适用分支**: `feature/multi-tenant` -> `main`

> 本文档是线上发布 runbook。线上有真实用户数据，禁止执行 `backend/scripts/init-mongodb.js` 或任何初始化/清空/重置数据库脚本。

---

## 1. 本次线上核查结论

核查时间：2026-05-18 12:30 左右（Asia/Shanghai）。只读检查已完成，未在线上执行任何数据库写入迁移。

### 1.1 MongoDB

当前线上 MongoDB 还未完成多租户迁移：

- `tenants` 集合不存在。
- 所有业务集合数据均未带 `tenantId`。
- 现有全局唯一索引仍是单租户结构，例如 `users.openid`、`payments.orderNo`、`sections(periodId, day)`。
- `admins` 共 5 条：1 个 `superadmin`，4 个 `admin`，均未绑定 `tenantId`。

线上 Mongo 关键集合数量：

| 集合 | 数量 |
| --- | ---: |
| users | 110 |
| periods | 6 |
| sections | 69 |
| checkins | 73 |
| enrollments | 42 |
| payments | 35 |
| insights | 158 |
| insight_requests | 252 |
| comments | 42 |
| notifications | 825 |
| useractivities | 6192 |
| subscribe_message_grants | 166 |
| subscribe_message_deliveries | 821 |
| auditlogs | 267 |
| checkincelebrationconfigs | 1 |
| insightdanmakus | 73 |
| userreadingcompletions | 28 |

结论：上线新代码前必须执行 `backend/scripts/migrate-to-multi-tenant.js`，创建初始租户 `fanren`、回填 `tenantId`、重建唯一索引，并迁移历史上传文件路径。

### 1.2 MySQL 备份库

当前线上 MySQL 备份库 `morning_reading` 的 14 张表均未包含 `tenant_id`。多租户代码里的 MySQL 同步服务会写入 `tenant_id`，因此上线前必须执行 `backend/database/mysql-tenant-migration.sql`。

线上 MySQL 表数量：

| 表 | 数量 | tenant_id |
| --- | ---: | --- |
| admins | 5 | 缺失 |
| users | 118 | 缺失 |
| periods | 7 | 缺失 |
| sections | 69 | 缺失 |
| checkins | 97 | 缺失 |
| enrollments | 42 | 缺失 |
| payments | 35 | 缺失 |
| insights | 165 | 缺失 |
| insight_requests | 254 | 缺失 |
| comments | 44 | 缺失 |
| notifications | 831 | 缺失 |
| comment_replies | 0 | 缺失 |
| insight_likes | 0 | 缺失 |
| insight_request_audit_logs | 0 | 缺失 |

---

## 2. 已完成的发布前备份

备份时间戳：`20260518-122822`

线上备份目录：

```bash
/home/ubuntu/backups/multi-tenant-preflight-20260518-122822
```

本地备份目录：

```bash
backups/production/20260518-122822
```

备份文件：

| 文件 | 内容 |
| --- | --- |
| `app-files-20260518-122822.tar.gz` | `/var/www/morning-reading` 代码、配置、上传文件快照，排除了 `node_modules` 和日志 |
| `mongo-ejson.tar.gz` | MongoDB 全集合 EJSON JSONL 导出，含索引元数据 |
| `mysql-json.tar.gz` | MySQL schema + 每表 JSONL 数据导出 |
| `runtime-config.tar.gz` | PM2 和 Nginx 运行配置快照 |

本地已额外导入：

- Mongo：`morning_reading_prod_backup_20260518_122822`
- MySQL：`morning_reading_mysql_prod_backup_20260518_122822`

上线前建议再做一次新的备份，避免备份后产生的新写入丢失。

---

## 3. 发布总原则

### 3.1 最新提交影响

2026-05-19 新提交 `8c21240 feat: 多租户管理后台完善与用户隔离修复` 不改变数据库迁移必须先于后端重启的原则，但新增了三个上线检查点：

- 管理后台用户列表 `/api/v1/users` 必须使用管理后台 JWT 和 `adminTenantContext`，否则后台用户页会 401/403 或跨租户。
- 管理后台租户切换状态会写入 `localStorage.admin_active_tenant`，验收时必须分别验证“所有租户视图”和指定租户视图。
- `miniprogram/config/env.js` 当前开发提交可能是 `superman_dev`，发布小程序前必须改回 `prod`，并确认 prod `wxAppId` 与 `fanren` 租户一致。

### 3.2 顺序

发布顺序必须是：

1. 本地验证代码。
2. 线上再次备份。
3. 上传/拉取新代码，但先不重启服务。
4. 停止后端写入入口或进入维护窗口。
5. 执行 Mongo 多租户迁移。
6. 执行 MySQL `tenant_id` 结构迁移。
7. 执行迁移后只读校验。
8. 重启后端新代码。
9. 部署管理后台。
10. 跑后台和小程序 smoke test。
11. 确认小程序 `currentEnv='prod'` 后再发布小程序。

不要先重启新后端再迁移数据库。否则新代码会在缺少 `tenants/tenantId` 的数据上运行，表现为登录失败、列表为空、MySQL backup 写入失败。

---

## 4. 本地发布前检查

```bash
git status --short
git diff --check

cd backend
node --check scripts/migrate-to-multi-tenant.js
node --check scripts/validate-multi-tenant-deploy.js
node --check src/server.js

cd ../admin
npm run type-check
npm run build
```

发布打包前，把小程序环境切回 prod 后运行：

```bash
cd backend
node scripts/validate-multi-tenant-deploy.js --phase release-config
```

`release-config` 会检查：

- 后端关键环境变量是否存在。
- `ENABLE_LEGACY_DEFAULT_TENANT=true` 是否打开。
- `miniprogram/config/env.js` 的 `currentEnv` 是否为 `prod`。

说明：若本机 Node 版本过新导致后端 `npm test` 在 mocha/yargs 的 CJS/ESM 兼容处失败，可改用与线上一致的 Node 22 环境跑测试。

---

## 5. 线上发布步骤

### 5.1 再次备份线上文件和数据库

```bash
ssh ubuntu@118.25.145.179
TS=$(date +%Y%m%d-%H%M%S)
BACKUP_ROOT=/home/ubuntu/backups/multi-tenant-release-$TS
mkdir -p "$BACKUP_ROOT"

cd /var/www
tar --exclude="morning-reading/backend/node_modules" \
  --exclude="morning-reading/node_modules" \
  --exclude="morning-reading/admin/node_modules" \
  --exclude="morning-reading/backend/logs" \
  -czf "$BACKUP_ROOT/app-files-$TS.tar.gz" morning-reading
```

如果服务器仍没有 `mongodump/mysqldump`，继续使用 Node 导出方式；导出后必须把 tar 包拉回本地 `backups/production/<TS>/`。

备份完成后，先做一次迁移前只读体检：

```bash
cd /var/www/morning-reading/backend
node scripts/validate-multi-tenant-deploy.js --phase pre-migration
```

预期：脚本输出当前 Mongo 缺 `tenantId`、MySQL 缺 `tenant_id`，但整体状态是“迁移前状态可识别”。如果提示“部分多租户状态”或“MySQL tenant_id 迁移状态不完整”，不要继续发布，先人工确认是否上次迁移中断。

### 5.2 上传或拉取新代码

服务器当前 `/var/www/morning-reading` 不是可靠的 Git 工作树，`git log` 可能不可用。推荐用本地构建/同步或先修正部署目录，而不是依赖线上 `git pull`。

如果使用 rsync：

```bash
rsync -avz --delete \
  --exclude node_modules \
  --exclude backend/.env \
  --exclude backend/.env.production \
  --exclude backend/uploads \
  ./ ubuntu@118.25.145.179:/var/www/morning-reading/
```

环境变量必须保持原线上值，并新增或确认：

```bash
ENABLE_LEGACY_DEFAULT_TENANT=true
WECHAT_APPID=线上小程序AppID
WECHAT_SECRET=线上小程序Secret
WECHAT_MCH_ID=线上商户号
WECHAT_API_KEY=线上支付API Key
WECHAT_NOTIFY_URL=https://wx.shubai01.com/api/v1/payments/wechat/callback
```

`ENABLE_LEGACY_DEFAULT_TENANT=true` 用于兼容旧小程序客户端未传 `X-Wx-AppId` 的请求。等新小程序版本稳定覆盖后再关闭。

### 5.3 进入维护窗口

```bash
pm2 stop morning-reading-backend
```

如果不停止服务，迁移期间可能有新用户登录、支付回调或打卡写入，导致迁移快照和新写入混杂。

### 5.4 执行 Mongo 多租户迁移

```bash
cd /var/www/morning-reading/backend
npm install --omit=dev
node scripts/migrate-to-multi-tenant.js
```

迁移脚本行为：

- 创建或复用 `slug=fanren` 的初始租户。
- 租户配置来自线上 `.env`：`WECHAT_APPID`、`WECHAT_SECRET`、`WECHAT_MCH_ID`、`WECHAT_API_KEY`、`WECHAT_NOTIFY_URL`。
- 所有历史业务集合补 `tenantId`。
- 删除旧单租户唯一索引，创建带 `tenantId` 的唯一索引。
- 保留 `superadmin/platform_superadmin` 为平台角色，`tenantId=null`。
- 给 `admin/operator/tenant_admin` 绑定 `fanren` 租户。
- 将历史上传文件迁到 `backend/uploads/tenants/fanren/`，并重写数据库中的 `/uploads/` URL。

### 5.5 执行 MySQL 结构迁移

优先使用 MySQL CLI：

```bash
cd /var/www/morning-reading/backend
mysql -u "$MYSQL_USER" -p "$MYSQL_DATABASE" < database/mysql-tenant-migration.sql
```

如果线上仍没有 `mysql` 命令，用 `mysql2` 执行该 SQL 文件，不能跳过：

```bash
cd /var/www/morning-reading/backend
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
})();
NODE
```

### 5.6 迁移后校验

优先使用脚本校验：

```bash
cd /var/www/morning-reading/backend
node scripts/validate-multi-tenant-deploy.js --phase post-migration
```

脚本必须通过后才能重启后端。它会校验：

- `fanren` 租户存在，并绑定 `WECHAT_APPID`。
- `fanren.wechatPay.mchId` 已配置。
- 所有业务集合没有缺失或为 null 的 `tenantId`。
- `superadmin/platform_superadmin` 的 `tenantId` 为空，其他管理员已绑定租户。
- Mongo 关键唯一索引已替换为 `tenant_*_unique`。
- MySQL 14 张表都有 `tenant_id` 和 `idx_tenant_id`。

如需手工复核，Mongo 校验：

```js
db.tenants.find({}, { slug: 1, wxAppIds: 1, 'wechatLogin.appId': 1, 'wechatPay.mchId': 1 })
db.users.countDocuments({ $or: [{ tenantId: { $exists: false } }, { tenantId: null }] })
db.periods.countDocuments({ $or: [{ tenantId: { $exists: false } }, { tenantId: null }] })
db.sections.countDocuments({ $or: [{ tenantId: { $exists: false } }, { tenantId: null }] })
db.checkins.countDocuments({ $or: [{ tenantId: { $exists: false } }, { tenantId: null }] })
db.enrollments.countDocuments({ $or: [{ tenantId: { $exists: false } }, { tenantId: null }] })
db.payments.countDocuments({ $or: [{ tenantId: { $exists: false } }, { tenantId: null }] })
db.admins.find({}, { email: 1, role: 1, tenantId: 1 })
db.users.getIndexes()
db.payments.getIndexes()
```

预期：

- `tenants` 至少有 `fanren`。
- 业务集合未迁移数量为 0。
- `superadmin/platform_superadmin` 的 `tenantId` 可为空。
- 其他管理员必须有 `tenantId`。
- 唯一索引名称应包含 `tenant_*_unique`。

MySQL 校验：

```sql
SHOW COLUMNS FROM users LIKE 'tenant_id';
SHOW COLUMNS FROM admins LIKE 'tenant_id';
SHOW COLUMNS FROM comment_replies LIKE 'tenant_id';
SHOW COLUMNS FROM insight_likes LIKE 'tenant_id';
SHOW COLUMNS FROM insight_request_audit_logs LIKE 'tenant_id';
SHOW INDEX FROM users WHERE Key_name = 'idx_tenant_id';
```

### 5.7 重启后端

```bash
pm2 restart morning-reading-backend
pm2 logs morning-reading-backend --lines 80
```

重点看：

- `TenantContextError`
- `缺少 X-Wx-AppId`
- `未识别的小程序 appId`
- `Unknown column 'tenant_id'`
- 支付回调验签错误

后端重启后至少验证这些 HTTP 接口：

```bash
curl -f https://wx.shubai01.com/health
curl -f https://wx.shubai01.com/api/v1/admin/current-tenant \
  -H "Authorization: Bearer <adminToken>"
curl -f "https://wx.shubai01.com/api/v1/users?page=1&limit=1" \
  -H "Authorization: Bearer <adminToken>"
```

如果是 `superadmin/platform_superadmin` 指定租户视图，还要带：

```bash
-H "X-Active-Tenant: <fanrenTenantId>"
```

### 5.8 部署管理后台

```bash
cd admin
npm run build
rsync -avz --delete dist/ ubuntu@118.25.145.179:/var/www/morning-reading/admin/dist/
```

如果 Nginx 指向其他目录，以线上 `nginx -T` 输出为准。部署后：

```bash
sudo nginx -t
sudo nginx -s reload
```

管理后台部署后验收：

- 刷新页面后侧边栏仍能显示租户管理入口。
- 租户切换下拉能加载 `fanren`。
- 选择 `fanren` 后，用户列表只显示该租户用户。
- 清空租户选择后，`superadmin/platform_superadmin` 能看全平台视图。

### 5.9 发布小程序

后端和管理后台验证通过后，再上传小程序。

发布前确认：

- `miniprogram/config/env.js` 的 `currentEnv` 为 `prod`，不是 `dev` 或 `superman_dev`。
- prod `wxAppId` 与 `fanren` 租户一致。
- 微信开发工具取消“不校验合法域名”。

发布前再跑一次：

```bash
cd backend
node scripts/validate-multi-tenant-deploy.js --phase release-config
```

---

## 6. 验收清单

- [ ] 老用户能登录，token 中含 `tenantId`。
- [ ] 新用户能登录并创建在 `fanren` 租户下。
- [ ] 首页期次、课节、打卡记录正常。
- [ ] 打卡提交、评论、通知正常。
- [ ] WebSocket 连接正常，不再因 token 参数名不一致失败。
- [ ] 管理后台登录正常。
- [ ] `superadmin` 和 `platform_superadmin` 都能访问租户管理。
- [ ] `admin/operator/tenant_admin` 只能看到绑定租户数据。
- [ ] 审计日志列表有数据和分页。
- [ ] MySQL 备份同步日志没有 `Unknown column 'tenant_id'`。
- [ ] 支付下单和微信回调使用对应租户支付配置。

---

## 7. 回滚策略

### 7.1 还没执行数据库迁移

可以直接恢复旧代码：

```bash
cd /var/www
tar -xzf /home/ubuntu/backups/<备份目录>/app-files-<TS>.tar.gz
pm2 restart morning-reading-backend
```

### 7.2 已执行 Mongo/MySQL 迁移，但还没有接入第二租户

可以短期回滚到老服务，前提：

- 没有创建第二个租户并产生业务数据。
- 现有管理员角色仍保留 `superadmin/admin/operator`，没有强制改成老服务不识别的角色。
- 上传文件已迁到 `/uploads/tenants/fanren/` 后，老服务必须仍通过 `/uploads/...` 静态根目录访问；如果老服务路径不兼容，恢复 `app-files` 里的 `backend/uploads`。

风险：

- Mongo 唯一索引已经从全局唯一变成 `tenantId + 字段`。只有一个租户时通常不影响老代码；一旦存在第二租户同 openid/orderNo，老代码会读错数据。
- MySQL 多出来的 `tenant_id` 是兼容字段，老服务忽略即可。

### 7.3 已经有第二租户或新租户写入

不能直接回滚到单租户老服务。老服务没有租户隔离，会出现跨租户读写。

此时只有两种安全选择：

1. 修复新服务并继续运行。
2. 全量恢复发布前 Mongo/MySQL/上传文件备份，同时接受备份之后的写入全部丢失。

全量数据库恢复必须在停机窗口执行，并先确认“会丢弃备份之后的数据”。

### 7.4 小程序回滚

微信公众平台 -> 版本管理 -> 回退到上一线上版本。

后端保持 `ENABLE_LEGACY_DEFAULT_TENANT=true` 时，旧小程序未传 `X-Wx-AppId` 也能继续访问默认租户。

---

## 8. 禁止事项

- 禁止执行 `backend/scripts/init-mongodb.js`。
- 禁止执行任何 `DROP DATABASE`、`deleteMany({})`、`db.dropDatabase()`，除非用户明确确认恢复备份并接受备份后数据丢失。
- 禁止在未备份时迁移上传文件。
- 禁止新后端先上线运行、数据库后迁移。
