# Change: 安全事件告警

## Why

项目已有通用错误率监控，但管理员暴力登录、跨租户拒绝、外部集成滥用、大数据导出和支付核验不匹配等安全事件缺少可审计的专项告警。

## What Changes

- 新增安全告警服务，按事件类型使用 Redis 计数、阈值和去重。
- 对以下事件产生告警：
  - 管理员连续登录失败、未知/禁用账号登录
  - 跨租户边界拒绝
  - 外部集成限流、未知 Key、已停用 Key
  - 超过 1MB 的备份/审计导出/数据库读取
  - 支付查询或回调签名与订单不匹配
- 告警只记录哈希后的 subject、类型、端点、阈值和计数，不记录邮箱、IP、token、业务正文等敏感值。
- 修复 GitHub Pages 将项目代码中的 JavaScript/Vue 表达式当作 Liquid 解析导致的构建失败。

## Impact

- Affected code: `backend/src/services/security-alert.service.js`、管理员登录、外部集成认证、限流、监控、错误处理、支付回调/确认
- Affected specs: `security-alerting`
- 告警写入既有 `logs/alerts.log` 和 Redis，可通过既有 `/api/v1/monitoring/alerts` 管理端接口查看。
