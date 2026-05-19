中间件层，包含：auth（JWT 用户认证）、adminAuth（管理员认证）、tenantContext（租户上下文注入，基于 AsyncLocalStorage）、cache（响应缓存）、ratelimit（限流）、errorHandler（统一错误处理）、monitoring（请求监控）、auditLog（操作审计）。
