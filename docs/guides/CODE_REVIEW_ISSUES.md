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
- **状态：** `[ ]`
- **文件：** `backend/src/controllers/checkin.controller.js:185-213`
- **问题：** `findById` 读取用户后多个 await 再 `save`，并发打卡会覆盖彼此的修改，丢失积分/天数。
- **修复方案：** 改用 `User.findByIdAndUpdate(userId, { $inc: { totalCheckinDays: 1, totalPoints: 10 } })`，streak 逻辑若复杂可用乐观锁。
- **测试重点：** 模拟快速连续两次打卡，验证 totalCheckinDays 正确累加。
- **Commit：** —

### H2 — #7 同一天可多次打卡（需求变更，不修代码）
- **状态：** `[skip]`
- **说明：** 用户确认该行为符合新需求，Checkin.js 的唯一索引注释与实际行为不一致，已将需求文档更新为"允许同一天多次打卡"。唯一索引注释可视情况修改以避免误导。

### H3 — N+1 查询：批量昵称同步
- **状态：** `[ ]`
- **文件：** `backend/src/controllers/enrollment.controller.js:1158-1195`
- **问题：** 每个用户单独 `findOne + findByIdAndUpdate`，大量用户时串行 N 次 DB 调用。
- **修复方案：** 单次 `Enrollment.find({ userId: { $in: [...] } })` + Map，再用 `User.bulkWrite` 批量更新。
- **测试重点：** 功能正确性不变，查看慢查询日志或在测试中 spy DB 调用次数。
- **Commit：** —

### H4 — 排名分页 total 跑了两遍全量 aggregate
- **状态：** `[ ]`
- **文件：** `backend/src/controllers/ranking.controller.js:116-120`
- **问题：** count 用的是完整聚合管道副本，等于重跑一次排名计算。
- **修复方案：** 在聚合末尾加 `$facet` 同时取数据和 count，或在已有结果集上取 `.length`（若数据量可接受）。
- **测试重点：** 排名结果和分页 total 正确。
- **Commit：** —

### H5 — enrollmentCount 在管理员删除/完成报名时未递减
- **状态：** `[ ]`
- **文件：** `backend/src/controllers/enrollment.controller.js:1112`（deleteEnrollment）、`:703`（completeEnrollment）
- **问题：** 两处操作未同步 `Period.enrollmentCount -= 1`，导致计数持续虚高。
- **修复方案：** 在 deleteEnrollment 和 completeEnrollment 中加 `Period.findByIdAndUpdate(periodId, { $inc: { enrollmentCount: -1 } })`（仅当原状态不是已退出时）。
- **测试重点：** 删除报名后查 period.enrollmentCount 正确递减。
- **Commit：** —

### H6 — Imprint update 跳过 create 时的字段校验
- **状态：** `[ ]`
- **文件：** `backend/src/controllers/imprint.controller.js:263-279`
- **问题：** update 无 title 长度、activityType 合法性、mediaList 非空等校验。
- **修复方案：** 提取公共校验函数，在 create 和 update 中复用。
- **测试重点：** 尝试 update 为空 title / 非法 activityType，期望 400。
- **Commit：** —

### H7 — cancelAttend 无 owner 校验，任意用户可移除他人
- **状态：** `[ ]`
- **文件：** `backend/src/controllers/imprint.controller.js:348-361`
- **问题：** 任意登录用户可对任意 imprint 调用 cancelAttend 移除任意 attendee，且对不存在的 imprint 返回 200。
- **修复方案：** 先 `findById` 检查存在性，再校验 `attendees.userId === currentUserId`（只能移除自己）。
- **测试重点：** userA 尝试从 userB 的 imprint 移除 userC，期望 403。
- **Commit：** —

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

### M5 — getAdminCheckins 把所有记录 load 进内存求和
- **状态：** `[ ]`
- **文件：** `backend/src/controllers/checkin.controller.js:778-782`
- **问题：** `Checkin.find(query).select('points')` 全量加载后 reduce，数据量大时内存压力高。
- **修复方案：** 改用 `Checkin.aggregate([{ $match: query }, { $group: { _id: null, totalPoints: { $sum: '$points' }, count: { $sum: 1 } } }])`。
- **Commit：** —

### M6 — 小程序提交随机 readingTime 和硬编码 completionRate
- **状态：** `[~]` 暂留，待确认
- **文件：** `miniprogram/pages/checkin/checkin.js:584-587`
- **问题：** `readingTime: Math.random() * 30 + 10`、`completionRate: 88` 存入 DB，统计数据无意义。
- **说明：** 若后续有计划收集真实数据则先移除假数据字段；若字段已废弃则后端也应忽略。

### M7 — getUserCheckins IDOR（同 C1 模式）
- **状态：** `[x]` 已完成 — commit `ad8a682`（与 C1 一并修复）
- **文件：** `backend/src/controllers/checkin.controller.js:316`

### M8 — Payment 回调按 orderNo 单查，命中复合索引效率低
- **状态：** `[ ]`
- **文件：** `backend/src/models/Payment.js:121`、`backend/src/controllers/payment.controller.js:741`
- **问题：** 回调查询 `{ orderNo }` 无法利用 `(tenantId, orderNo)` 复合索引，全表扫描。
- **修复方案：** 在 Payment 模型上增加 `{ orderNo: 1 }` 单独索引。
- **Commit：** —

---

## Low（Schema / UX / 隐私）

### L1 — User.status 枚举不包含 'inactive'
- **状态：** `[ ]`
- **文件：** `backend/src/models/User.js:79`、`backend/src/controllers/user.controller.js:252`
- **问题：** 枚举是 `['active','banned','deleted']`，但代码写入 `'inactive'`，Mongoose strict 模式下静默失败。
- **修复方案：** 枚举加入 `'inactive'`，或将写入改为 `'banned'`（确认语义后选一）。
- **Commit：** —

### L2 — Enrollment 缺少复合索引影响 getMyCompletionReports
- **状态：** `[ ]`
- **文件：** `backend/src/models/Enrollment.js`
- **问题：** 查询 `{ tenantId, userId, deleted, status, paymentStatus }` 无对应索引。
- **修复方案：** 加 `{ tenantId: 1, userId: 1, paymentStatus: 1, status: 1 }` 索引。
- **Commit：** —

### L3 — Payment.orderNo 无 required 约束
- **状态：** `[ ]`
- **文件：** `backend/src/models/Payment.js:79`
- **问题：** orderNo 可为空，与业务逻辑矛盾。
- **修复方案：** 加 `required: true`。
- **Commit：** —

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

_最后更新：2026-06-10_
