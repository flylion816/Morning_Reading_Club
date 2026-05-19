租户上下文中间件，通过 AsyncLocalStorage 在当前请求的异步调用链中注入 tenantId。支持三种模式：用户路由（从 JWT 取 tenantId）、管理员路由（从 admin.tenantId 或 X-Active-Tenant 头取）、公开路由（从 X-Wx-AppId 查询 Tenant 表）。
