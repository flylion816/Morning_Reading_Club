# 2026-03-27 小凡看见 / 请求看见回归测试

## 本次补充的测试

### 单元测试

文件：`backend/tests/unit/controllers/insight.request-flow.test.js`

覆盖点：

- 同一用户对同一条 `insightId` 重复申请时复用原记录，并重置为 `pending`
- `getRequestStatus` 在单条授权场景下只返回 `approvedInsightIds`，不把同请求中的 `periodId` 视为整期授权
- `getUserInsights` 查看他人列表时，只解锁被批准的单条内容，同期其他条目保持 `isAccessible: false`

### 接口回归测试

文件：`backend/tests/integration/insight-request-flow.integration.test.js`

覆盖点：

- `POST /api/v1/insights/requests`
- `GET /api/v1/insights/user/:userId`
- `GET /api/v1/insights/:insightId`
- `POST /api/v1/insights/requests/:requestId/approve`
- `POST /api/v1/insights/requests/:requestId/reject`
- `GET /api/v1/insights/requests/received`
- `GET /api/v1/insights/requests/sent`

## 已修复的授权逻辑

文件：`backend/src/controllers/insight.controller.js`

修复点：

- 单条 `insightId` 授权不再被 `approvedPeriodIds` 误判为整期授权
- `getApprovedInsightAccessForViewer` 仅把“没有 `insightId` 的 approved 请求”计入 `approvedPeriodIds`
- `getRequestStatus` 同步改为相同规则，避免前端误把单条授权当成整期授权

## 本地执行命令

单元测试：

```bash
cd backend
npx mocha --no-config tests/unit/controllers/insight.request-flow.test.js
```

接口回归测试：

```bash
cd backend
npx mocha --no-config tests/integration/insight-request-flow.integration.test.js
```

## 当前环境执行结果

### 已跑通

单元测试：

```text
Insight Controller - 单条授权与请求流
  ✔ 重复申请同一条 insight 时应复用原记录并重置为 pending
  ✔ 单条授权状态查询不应把 insight 申请当成整期授权
  ✔ 查看他人 insights 时只解锁被批准的单条内容，同期其他条目保持锁定

3 passing
```

### 当前环境未能跑通

接口回归测试在当前沙箱环境中无法完成，原因不是业务断言失败，而是环境禁止监听本地随机端口。即便使用 `supertest`，底层也需要临时监听端口，当前环境会报：

```text
listen EPERM: operation not permitted 0.0.0.0
```

这意味着：

- 测试文件已补齐，可在正常本地开发环境/CI 中执行
- 当前会话内只能确认单元测试通过，不能在本环境内完成接口级回归

## 建议验收顺序

1. 先跑单元测试，确认核心授权逻辑没有回退
2. 在本地正常终端或 CI 中跑接口回归测试
3. 人工补测三条业务链路：
   - 同条 insight 重复申请只保留一条记录
   - 批准一条 insight 后，同期其他条目仍保持锁定
   - 首页“请求看见”和“查看更多请求”都保留已处理记录且状态正确
