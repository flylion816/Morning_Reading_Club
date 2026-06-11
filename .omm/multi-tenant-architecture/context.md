## 背景

晨读营平台从单租户改造为多租户 SaaS，目标是用一套代码、一个数据库承载多个独立读书会品牌（如"凡人共读"、"超人读书会"），各租户数据完全隔离。

## 核心设计决策

- **共享数据库，逻辑隔离**：所有租户数据存在同一个 MongoDB，每条业务记录带 `tenantId` 字段
- **AsyncLocalStorage（ALS）传递上下文**：请求进入时写入 tenantId，Mongoose plugin 在 query 层自动读取并注入过滤条件，Controller 无需手动传参
- **appId → tenantId 映射**：小程序启动时用自己的 wxAppId 登录，后端反查 Tenant 集合得到 tenantId，写入 JWT
- **fail-closed 原则**：无租户上下文的查询直接报错，只有显式 `withSystemContext(null, ...)` 才能跨租户（用于 cron 任务）

## 角色体系

| 角色 | 说明 |
|------|------|
| platform_superadmin | 平台运营者，可通过 X-Active-Tenant header 切换租户视角 |
| tenant_admin | 各租户管理员，只能操作本租户数据 |
| user | 普通用户，通过微信登录，绑定到具体租户 |
