多租户隔离的核心机制：tenantContext 中间件通过 AsyncLocalStorage 在请求生命周期内传递 tenantId，Mongoose tenantPlugin 在所有查询中自动注入 { tenantId } 过滤条件，无需业务代码手动传递。
