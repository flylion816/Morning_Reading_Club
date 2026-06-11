# 代码审查问题追踪

> 审查日期：2026-06-10  
> 执行策略：按 Critical → High → Medium → Low 顺序逐条修复，每条修复后运行相关测试并单独提交。  
> 状态标记：`[ ]` 待处理 | `[x]` 已完成 | `[~]` 暂留（需确认）| `[skip]` 需求变更/不修改

---

## Critical（安全 / 数据完整性）

### C1 — IDOR：任意用户可读他人支付记录
- **状态：** `[x]` 已完成 — commit `ad8a682`
- **文件：** `backend/src/controllers/payment.controller.js:634`、`enrollment.controller.js:554`、`checkin.controller.js:316`
- **路由：** `GET /api/v1/payments/user/:userId`、`GET /api/v1/enrollments/user/:userId`、`GET /api/v1/checkins/user/:userId`
- **问题：** `const userId = req.params.userId || req.user.userId` 允许调用方传入任意 userId，无 owner 校验。
- **修复方案：** 非管理员路由强制使用 `req.user.userId`，忽略 path param 中的 userId（或校验 param === current user）。
- **测试重点：** 用 userA token 请求 userB 的数据，期望 403。
- **Commit：** `ad8a682`（同时包含 M7）

---

### C2 — Mock 支付在生产环境可用
- **状态：** `[x]` 已完成 — commit `65b57f6`
- **文件：** `backend/src/routes/payment.routes.js:51`、`backend/src/controllers/payment.controller.js:131`
- **问题：** `POST /:paymentId/mock-confirm` 路由和 `paymentMethod: 'mock'` 无 `NODE_ENV !== 'production'` 守卫，生产环境攻击者可免费激活报名。
- **修复方案：** 路由注册和 initiatePayment 中的 mock 分支都加 `process.env.NODE_ENV !== 'production'` 判断，生产环境返回 400。
- **Commit：** `65b57f6`

---

### C3 — 支付确认竞态条件（双重确认）
- **状态：** `[x]` 已完成 — commit `1b0c610`
- **文件：** `backend/src/controllers/payment.controller.js:319-326`
- **问题：** `confirmPayment` 先 findById 再判断状态，两个并发请求都能通过检查，导致报名重复激活/双重发通知。
- **修复方案：** 改用原子操作 `Payment.findOneAndUpdate({ _id, userId, status: { $in: ['pending','processing'] } }, { $set: { status: 'processing' } }, { new: true })`。
- **Commit：** `1b0c610`

---

### C4 — console.log 将 PII / DB 完整结果输出到生产日志
- **状态：** `[x]` 已完成 — commit `cba6e99`
- **文件：** `backend/src/controllers/enrollment.controller.js:557-572`
- **问题：** `console.log('req.user:', req.user)` 把 openid、tenantId、role 和完整查询结果打印到 stdout，生产日志可见敏感信息。
- **修复方案：** 删除该段全部 console.log 调试输出。
- **Commit：** `cba6e99`

---

### C5 — 危险的 debugCleanupEnrollments 函数
- **状态：** `[x]` 已完成 — commit `55250be`
- **文件：** `backend/src/controllers/enrollment.controller.js:1224-1258`
- **问题：** 函数体直接 `deleteMany` 指定用户的所有报名记录，虽未注册路由，但存在被误连线的风险。
- **修复方案：** 直接删除该函数。
- **Commit：** `55250be`

---

## High（逻辑 Bug / 数据错误）

### H1 — 用户统计积分竞态（非原子增量）
- **状态：** `[x]` 已完成 — commit `2f13138`
- **文件：** `backend/src/controllers/checkin.controller.js`
- **修复方案（A）：** totalCheckinDays/totalPoints 用 `$inc` 原子操作；streak 逻辑保留但改为单独 findByIdAndUpdate，不与 $inc 字段混用。
- **Commit：** `2f13138`

### H2 — #7 同一天可多次打卡（需求变更，不修代码）
- **状态：** `[skip]`
- **说明：** 用户确认该行为符合新需求。唯一索引注释与实际行为不一致，可视情况修改以避免误导。

### H3 — N+1 查询：批量昵称同步
- **状态：** `[x]` 已完成 — commit `528bc9f`
- **文件：** `backend/src/controllers/enrollment.controller.js`
- **修复方案：** aggregate + Map + bulkWrite，DB 调用从 O(N) 降至 O(1)。
- **Commit：** `528bc9f`

### H4 — 排名分页 total 跑了两遍全量 aggregate
- **状态：** `[x]` 已完成 — commit `87c3ff8`
- **文件：** `backend/src/controllers/ranking.controller.js`
- **修复方案：** 改用 `$facet`，三个分支（data/totalCount/allRanked）一次执行完成。
- **Commit：** `87c3ff8`

### H5 — enrollmentCount 在管理员删除/完成报名时未递减
- **状态：** `[skip]` 经核查无需修改
- **说明：** `deleteEnrollment` 已有 `$inc: { enrollmentCount: -1 }`；`completeEnrollment` 语义是"完成学习"不是退出，不应递减，原逻辑正确。

### H6 — Imprint update 跳过 create 时的字段校验
- **状态：** `[x]` 已完成 — commit `eae02d4`
- **文件：** `backend/src/controllers/imprint.controller.js`
- **修复方案：** 提取 `validateImprintFields()` 公共函数，update 和 adminUpdate 复用。
- **Commit：** `eae02d4`

### H7 — cancelAttend 无 owner 校验，任意用户可移除他人
- **状态：** `[x]` 已完成 — commit `9953f0f`
- **文件：** `backend/src/controllers/imprint.controller.js`
- **修复方案：** 加 findById 存在性检查 + attendees 归属校验，非列表成员返回 403。
- **Commit：** `9953f0f`

---

## Medium（输入验证 / 安全 / 性能）

### M1 — Comment content 未校验（可提交空内容）
- **状态：** `[ ]`
- **文件：** `backend/src/controllers/comment.controller.js:83`
- **问题：** content 无非空和最大长度校验。
- **修复方案：** 加 `if (!content?.trim()) return res.status(400)...`，加最大长度限制（如 500 字符）。
- **Commit：** —

### M2 — getUserStats 返回任意用户积分等敏感字段
- **状态：** `[~]` 暂留，待确认
- **文件：** `backend/src/controllers/user.controller.js:157-190`
- **问题：** `totalPoints`、`level` 等字段对任意登录用户可见，是否属于公开信息需产品确认。
- **说明：** 若积分/等级是公开展示设计，则无需修改；否则限制只能查自己或过滤敏感字段。

### M3 — 管理员更新报名用黑名单而非白名单
- **状态：** `[~]` 暂留，待确认
- **文件：** `backend/src/controllers/enrollment.controller.js:1061-1093`
- **问题：** 排除字段方式允许管理员直接设置 `paymentStatus: 'paid'` 绕过支付流程，是否为预期的管理员能力需确认。
- **说明：** 若管理员确实需要手动设置支付状态（如线下付款），则当前行为合理，只需补文档；否则改为白名单。

### M4 — 微信回调 JSON body 路径跳过签名验证
- **状态：** `[~]` 暂留，待确认
- **文件：** `backend/src/controllers/payment.controller.js:706-729`
- **问题：** JSON body 的回调请求完全跳过签名验证，直接处理支付确认。需确认是否有合理场景会发送 JSON body，还是应该一律要求 XML。
- **影响：** 若修改可能影响现有回调流程，修前需在测试环境验证。

### M1 — Comment content 未校验（可提交空内容）
- **状态：** `[x]` 已完成 — commit `9955362`
- **Commit：** `9955362`

### M5 — getAdminCheckins 把所有记录 load 进内存求和
- **状态：** `[x]` 已完成 — commit `9955362`
- **Commit：** `9955362`

### M8 — Payment 回调按 orderNo 单查，命中复合索引效率低
- **状态：** `[x]` 已完成 — commit `9955362`
- **Commit：** `9955362`

---

## Low（Schema / UX / 隐私）

### L1 — User.status 枚举不包含 'inactive'
- **状态：** `[x]` 已完成 — commit `a04f932`
- **修复方案：** isActive=false 路径改写 `'banned'`（与前端对齐），枚举不再写入非法值。
- **Commit：** `a04f932`

### L2 — Enrollment 缺少复合索引影响 getMyCompletionReports
- **状态：** `[x]` 已完成 — commit `a04f932`
- **Commit：** `a04f932`

### L3 — Payment.orderNo 无 required 约束
- **状态：** `[x]` 已完成 — commit `a04f932`
- **Commit：** `a04f932`

### L4 — 支付确认 fire-and-forget，失败无用户可见恢复入口
- **状态：** `[~]` 暂留，待确认
- **文件：** `miniprogram/pages/payment/payment.js:330-358`
- **问题：** 微信支付回调是兜底，但若回调也失败用户无法重试。需确认是否需要"查询支付状态"重试按钮。

### L5 — 草稿 key 回退 'guest'，多用户同设备可能共享草稿
- **状态：** `[~]` 暂留，待确认
- **文件：** `miniprogram/pages/checkin/checkin.js:302`
- **问题：** userId 未加载时草稿 key 变成 `checkin_draft_guest_{sectionId}`，极端情况两个用户共享草稿。
- **说明：** 微信小程序多账号同设备场景稀少，可优先级较低处理；也可在草稿保存前判断 userId 是否已就绪。

---

## 待用户确认的问题汇总

以下问题在修复前需要你确认预期行为：

| # | 问题 | 需要确认的点 |
|---|------|------------|
| M2 | getUserStats 字段暴露 | totalPoints/level 是否设计为公开？ |
| M3 | 管理员更新报名白名单 | 管理员是否需要手动设置 paymentStatus？ |
| M4 | 微信回调跳过签名 | 是否有合法的 JSON body 回调场景？ |
| M6 | 小程序随机 readingTime | 是否计划收集真实数据？字段要保留吗？ |
| L4 | 支付确认无重试 | 是否需要在前端加重试入口？ |
| L5 | 草稿 key 回退 guest | 是否需要修复？ |

---

_最后更新：2026-06-11_
