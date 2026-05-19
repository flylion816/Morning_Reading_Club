Mongoose 数据模型层，定义所有集合 Schema。包含 User、Tenant、Period、Section、Checkin、Enrollment、Payment、Insight、Comment、Notification、AuditLog 等 15+ 个模型。所有模型通过 tenantPlugin 自动注入 tenantId 字段和查询过滤。
