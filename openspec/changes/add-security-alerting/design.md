## Context

现有 `alerting` 引擎负责告警去重、日志和 Redis 存储；监控中间件只覆盖通用错误率与响应耗时。安全事件分散在不同控制器和中间件中。

## Goals / Non-Goals

- Goals: 在既有告警体系上增加安全事件语义；跨 PM2 worker 使用 Redis 计数；避免把敏感主体写入告警。
- Non-Goals: 不新增外部短信/钉钉渠道；不改变现有认证授权判定；不将普通 403/404 误报为跨租户攻击。

## Decisions

- 每个事件显式定义阈值、时间窗和 severity。
- 登录失败按 email+IP 哈希聚合；外部 Key 按 tenant+keyId 哈希聚合；大读取按 actor+endpoint 哈希聚合。
- 跨租户事件只由 tenantPlugin/tenantValidator 的明确拒绝触发。
- 大读取只监控备份、审计导出和数据库维护端点，响应大于 1MB 才告警。
- Pages 继续只发布仓库概览；生产管理员指南仍由 `wx.shubai01.com` 静态目录提供。

## Risks / Trade-offs

- Redis 不可用时降级为单 worker 内存计数，可能降低多 worker 聚合精度，但不阻断主请求。
- 未知外部 Key 三次才告警，以减少扫描噪音；已停用 Key 和支付不匹配立即告警。
