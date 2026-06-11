多租户 SaaS 架构全景图，展示租户隔离机制：从小程序 appId 识别租户、JWT 携带 tenantId、AsyncLocalStorage 传递上下文、Mongoose plugin 自动注入过滤，到 MongoDB 共享数据库按 tenantId 隔离数据的完整链路。
