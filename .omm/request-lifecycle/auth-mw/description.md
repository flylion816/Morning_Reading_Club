JWT 认证中间件，验证请求头中的 Bearer token，解析出 userId 和 tenantId 并挂载到 req.user。管理员路由使用 adminAuth.js 验证管理员 token。
