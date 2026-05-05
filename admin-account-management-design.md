# 管理后台账号管理设计文档

## 1. 背景与目标

当前管理后台已经有管理员登录体系，但缺少一个统一的“账号管理”入口来管理后台账号本身。现状下，管理员账号的创建、禁用、角色调整、密码重置等动作主要依赖后端接口和手工操作，前端没有独立页面承接，也没有完整的账号治理流程。

本需求的目标是新增一个左侧 `账号管理` tab 页，用于集中管理管理后台的账号体系，并确保审计日志能准确识别“是谁”执行了某次操作。

核心目标：

1. 在后台左侧菜单新增 `账号管理`。
2. 提供管理员账号的列表、创建、编辑、禁用/启用、重置密码、查看详情能力。
3. 建立清晰的后台账号治理规则，支持不同角色的管理员分工。
4. 确保审计日志中记录的是真实的后台操作者账号，而不是模糊的“admin”。
5. 尽量复用现有 `Admin` 数据模型和登录体系，不重复造一套账号系统。

## 2. 现状梳理

### 2.1 现有后端能力

后端已经存在 `Admin` 模型和基础管理员接口。

参考文件：

- [backend/src/models/Admin.js](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/models/Admin.js)
- [backend/src/routes/admin.routes.js](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/routes/admin.routes.js)
- [backend/src/controllers/admin.controller.js](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/controllers/admin.controller.js)
- [backend/src/middleware/adminAuth.js](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/middleware/adminAuth.js)

现有 `Admin` 模型字段：

- `name`
- `email`
- `password`
- `dbAccessPassword`
- `avatar`
- `role`
- `permissions`
- `status`
- `lastLoginAt`
- `loginCount`
- `createdAt`
- `updatedAt`

现有角色：

- `superadmin`
- `admin`
- `operator`

现有状态：

- `active`
- `inactive`

现有接口已经有：

- 登录
- 获取当前管理员信息
- 管理员列表
- 创建管理员
- 更新管理员
- 删除管理员
- 修改当前管理员密码
- 修改数据库访问密码

### 2.2 现有前端结构

管理后台左侧菜单已包含多个业务页，但没有独立的账号管理页。

参考文件：

- [admin/src/components/AdminLayout.vue](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/admin/src/components/AdminLayout.vue)
- [admin/src/router/index.ts](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/admin/src/router/index.ts)
- [admin/src/services/api.ts](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/admin/src/services/api.ts)

### 2.3 审计现状

审计日志模型已存在，并且已经做了基础的管理员身份记录。

参考文件：

- [backend/src/models/AuditLog.js](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/models/AuditLog.js)
- [backend/src/middleware/auditLog.js](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/middleware/auditLog.js)
- [backend/src/utils/auditHelper.js](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/utils/auditHelper.js)

审计需要满足的关键点：

- 记录操作者的管理员 ID
- 记录操作者的管理员名称
- 记录操作时间、IP、操作类型、资源类型、状态、变更内容
- 管理员名称应当以“操作当时的快照”写入日志，避免后续改名导致历史日志失真

## 3. 设计原则

1. 复用现有 `Admin` 集合，不另起一套账号表。
2. 后台账号的主标识用 `email`，登录和权限体系继续沿用现有 JWT 管理员鉴权。
3. 账号状态优先用 `status` 控制启用/禁用，不建议依赖删除作为常规管理动作。
4. 删除管理员应当作为高危操作，仅限超级管理员，并且必须可审计。
5. 审计日志中的 `adminName` 必须是快照值，不能依赖实时关联查询结果。
6. 所有关键管理动作必须能追溯到具体账号，而不是只有“系统管理员”这种泛化身份。

## 4. 业务定义

### 4.1 什么是“后台账号”

“后台账号”指登录管理后台、执行后台管理操作的管理员账户。

它和普通小程序用户不同：

- 后台账号登录的是管理后台网页
- 后台账号通过 `Admin` 模型管理
- 后台账号用于执行业务审批、内容管理、数据分析、系统管理等动作

### 4.2 账号分层

建议保留三类角色：

#### `superadmin`

最高权限账号。

职责：

- 创建、编辑、禁用、删除其他管理员账号
- 分配角色与权限
- 访问数据库管理
- 管理敏感配置

#### `admin`

业务管理员。

职责：

- 处理报名、支付、期次、内容、打卡、申请等业务
- 查看审计日志
- 不允许管理超级敏感系统项，除非权限明确授予

#### `operator`

操作员。

职责：

- 执行日常操作
- 只能操作指定模块
- 不应拥有账号体系管理权限

### 4.3 禁用与删除的语义

建议把“禁用账号”作为主流程，把“删除账号”作为例外流程。

原因：

- 禁用可以保留历史审计关系
- 删除会让审计日志、操作归属、权限判断更复杂
- 账号治理上，临时离职或暂停权限一般更适合禁用

建议规则：

- `inactive` 表示账号不可登录
- `delete` 仅由 `superadmin` 执行，并且尽量只在初始化错误、测试账号清理等少数场景使用

## 5. 页面设计

### 5.1 左侧菜单

建议在 `系统管理` 分组下新增：

- `账号管理`

位置建议：

- 放在 `数据库管理` 之前或之后
- 与 `审计日志`、`订阅消息排查` 同属于系统管理类页面

### 5.2 页面标题

建议标题：

- `账号管理`

副标题：

- `管理后台登录账号、角色权限和启停状态`

### 5.3 页面主体布局

页面建议分为四块：

1. 顶部概览卡片
2. 账号筛选区
3. 账号列表表格
4. 账号详情/编辑抽屉或弹窗

### 5.4 顶部概览卡片

建议显示：

- 总账号数
- 启用账号数
- 禁用账号数
- 超级管理员数

如果需要更精细，可以再加：

- 最近登录人数
- 近 7 天活跃账号数

### 5.5 筛选条件

建议支持：

- 账号名称/邮箱模糊搜索
- 角色筛选
- 状态筛选
- 权限筛选

建议筛选项：

- `keyword`
- `role`
- `status`
- `permission`

### 5.6 列表字段

建议列表展示：

- 头像
- 姓名
- 邮箱
- 角色
- 权限摘要
- 状态
- 最后登录时间
- 登录次数
- 创建时间
- 操作

### 5.7 行内操作

建议每行提供：

- 查看详情
- 编辑
- 重置密码
- 启用/禁用
- 删除

建议确认策略：

- 重置密码、禁用、删除都要二次确认
- 禁用和删除按钮要有明显风险提示

### 5.8 新建账号弹窗

建议字段：

- 姓名
- 邮箱
- 初始密码
- 角色
- 权限
- 状态
- 头像

建议交互：

- 邮箱作为登录账号
- 初始密码必填
- 角色默认为 `operator`
- 状态默认为 `active`
- 创建成功后一次性提示密码，请管理员立即修改

### 5.9 编辑账号抽屉

建议可编辑内容：

- 姓名
- 角色
- 权限
- 状态
- 头像

建议不可编辑或受限内容：

- 邮箱：默认不可直接修改，避免登录名变更造成混乱
- 密码：独立走重置密码流程

### 5.10 重置密码

建议采用单独弹窗，而不是混在编辑页里。

流程建议：

1. 输入新密码
2. 二次确认
3. 提交后立即生效
4. 记录审计日志

建议支持：

- 生成随机密码
- 手动输入密码

### 5.11 当前账号信息

页面可补充一个“当前登录账号信息”区域：

- 当前账号姓名
- 当前账号邮箱
- 当前角色
- 最近登录时间
- 当前会话状态

这有助于操作者判断自己当前是谁，以减少误操作。

## 6. 后端设计

### 6.1 数据模型建议

建议继续沿用 `Admin` 集合，并按需要补充字段，而不是新建 `Account` 模型。

如果要增强账号管理能力，可以考虑增加：

- `phone`
- `description`
- `lastPasswordChangedAt`
- `lockedUntil`
- `failedLoginCount`
- `createdBy`
- `updatedBy`

其中：

- `createdBy` 和 `updatedBy` 适合做账号治理追踪
- 如果短期不想扩表，可以先不加

### 6.2 接口建议

以下为建议接口设计。

#### 列表

`GET /api/v1/admins`

Query：

- `page`
- `pageSize`
- `keyword`
- `role`
- `status`
- `permission`

返回：

- `list`
- `total`
- `page`
- `pageSize`

#### 详情

`GET /api/v1/admins/:id`

返回：

- 账号基础信息
- 角色
- 权限
- 状态
- 登录统计
- 最近审计摘要

#### 创建

`POST /api/v1/admins`

Body：

- `name`
- `email`
- `password`
- `role`
- `permissions`
- `status`
- `avatar`

#### 更新

`PUT /api/v1/admins/:id`

Body：

- `name`
- `role`
- `permissions`
- `status`
- `avatar`

#### 重置密码

建议新增：

`PATCH /api/v1/admins/:id/password`

Body：

- `password`

#### 启用/禁用

建议新增：

`PATCH /api/v1/admins/:id/status`

Body：

- `status`

#### 删除

`DELETE /api/v1/admins/:id`

建议保留，但只允许 `superadmin` 使用，并记录审计。

### 6.3 权限控制

建议权限矩阵：

| 操作 | superadmin | admin | operator |
| --- | --- | --- | --- |
| 查看账号列表 | 是 | 否/可选 | 否 |
| 新建账号 | 是 | 否 | 否 |
| 编辑账号 | 是 | 否 | 否 |
| 重置密码 | 是 | 否 | 否 |
| 启用/禁用 | 是 | 否 | 否 |
| 删除账号 | 是 | 否 | 否 |
| 查看自己的资料 | 是 | 是 | 是 |
| 修改自己的密码 | 是 | 是 | 是 |

如果后续需要更细粒度权限，再把“查看列表”或“重置密码”拆成独立权限点。

## 7. 审计设计

账号管理一定要纳入审计。

### 7.1 必须记录的动作

- 创建管理员
- 修改管理员信息
- 重置管理员密码
- 修改管理员角色
- 修改管理员权限
- 启用/禁用管理员
- 删除管理员
- 当前管理员修改自己的密码

### 7.2 审计字段建议

建议审计日志中保留：

- `adminId`
- `adminName`
- `actionType`
- `resourceType = admin`
- `resourceId`
- `resourceName`
- `description`
- `changes`
- `status`
- `errorMessage`
- `ipAddress`
- `userAgent`

### 7.3 归属口径

审计日志中的操作者字段建议采用快照：

- `adminId`：管理员 ID
- `adminName`：管理员当时名称

这样即使后来改名，审计日志仍然能反映当时谁做的操作。

### 7.4 推荐动作名称

- `CREATE`
- `UPDATE`
- `DELETE`
- `LOGIN`
- `LOGOUT`
- `ROLE_CHANGE`
- `PASSWORD_RESET`
- `STATUS_CHANGE`

如果当前 `AuditLog` 枚举不够用，可以扩充；否则先复用 `UPDATE` + `description` 也可以，但不如独立动作清晰。

## 8. 登录与密码策略

### 8.1 登录账号定义

后台登录统一使用：

- 邮箱 + 密码

不建议用手机号作为后台主登录名，除非有明确业务需要。

### 8.2 密码规则

建议密码规则：

- 最少 8 位
- 至少包含字母和数字
- 可选要求特殊字符

### 8.3 密码重置策略

建议：

- 初始密码只展示一次
- 重置后要求用户下次登录后立即修改
- 如需要，可增加“首次登录强制改密”标志位

### 8.4 安全策略

建议保留或加强：

- 登录失败次数限制
- 连续失败锁定
- JWT 过期控制
- 管理员状态禁用后立即失效

## 9. 交互细节

### 9.1 账号列表默认排序

建议默认按：

- `createdAt DESC`

辅助排序：

- 最近登录时间
- 角色优先级

### 9.2 禁用账号后的行为

禁用后：

- 账号不能继续登录
- 当前 token 可以选择立即失效，或在下次请求时被拦截
- 列表中显示为禁用状态

### 9.3 删除账号后的行为

建议：

- 删除前必须确认
- 删除后历史审计日志仍保留
- 列表中相关日志仍显示快照名称

### 9.4 自己不能删除自己

必须保留现有约束：

- 当前登录账号不能删除自己

建议进一步约束：

- 当前登录账号不能把自己降级成无权限账号
- 当前登录账号不能禁用自己

## 10. 数据口径与展示口径

### 10.1 账号数量统计

定义建议：

- 总账号数：`Admin.countDocuments()`
- 启用账号数：`status = active`
- 禁用账号数：`status = inactive`
- 超级管理员数：`role = superadmin`

### 10.2 活跃账号

如果要展示“活跃账号”，建议口径是：

- 最近 7 天内有登录行为，或
- 最近 7 天内有后台写操作行为

建议只选一种作为页面文案口径，避免混淆。

## 11. 需要改动的代码区域

以下是大概率需要修改的位置。

### 11.1 前端

- `admin/src/components/AdminLayout.vue`
  - 新增左侧 `账号管理` 菜单项
  - 新增页面标题和副标题

- `admin/src/router/index.ts`
  - 新增 `/account-management` 或 `/admins`

- `admin/src/services/api.ts`
  - 新增 `adminApi`

- 新增页面：
  - `admin/src/views/AccountManagementView.vue`

### 11.2 后端

- `backend/src/routes/admin.routes.js`
  - 如需要新增账号列表、详情、密码重置、启停接口

- `backend/src/controllers/admin.controller.js`
  - 增加账号管理逻辑

- `backend/src/models/Admin.js`
  - 如需新增字段

- `backend/src/middleware/adminAuth.js`
  - 如需更严格的权限控制

- `backend/src/middleware/auditLog.js`
  - 确保账号管理动作被记录

- `backend/src/utils/auditHelper.js`
  - 补充账号管理相关审计 helper

### 11.3 文档和测试

- 新增单元测试
- 新增接口集成测试
- 新增前端组件测试

## 12. 推荐实现顺序

建议按下面顺序实施：

1. 先补后端接口和权限控制。
2. 再做前端列表页和表单弹窗。
3. 再接审计日志。
4. 最后补测试和边界处理。

这样可以先把业务闭环打通，再优化交互。

## 13. 验收标准

满足以下条件即可认为完成：

1. 左侧菜单出现 `账号管理`。
2. 只有有权限的后台账号可以进入该页。
3. 可以看到后台账号列表、角色、状态、最后登录时间。
4. 可以创建新管理员账号。
5. 可以编辑已有账号信息。
6. 可以禁用和启用账号。
7. 可以重置密码。
8. 可以删除账号，但必须受权限限制并写入审计。
9. 审计日志能准确显示操作者账号。
10. 禁用账号后无法再登录后台。

## 14. 风险点

### 14.1 误删和误禁用

后台账号属于高敏感资源，误操作影响很大。必须加：

- 二次确认
- 权限限制
- 审计记录

### 14.2 历史日志归属失真

如果审计只存 `adminId` 不存 `adminName` 快照，后续改名会影响历史可读性。建议保留快照。

### 14.3 删除造成审计引用断裂

如果直接硬删管理员，审计里的 populate 可能查不到关联对象。建议尽量禁用而不是删除。

### 14.4 token 失效问题

禁用账号后，旧 token 是否立即失效要提前定义。建议在认证层增加状态校验。

## 15. 建议的页面命名

如果需要统一路由命名，建议：

- 路由：`/account-management`
- 菜单：`账号管理`
- 页面组件：`AccountManagementView.vue`
- API 分组：`adminApi`

## 16. 结论

这次账号管理功能，最合适的方式是：

- 复用现有 `Admin` 模型
- 在后台新增独立 `账号管理` 页面
- 只允许 `superadmin` 做账号治理
- 所有动作写入审计日志
- 通过禁用优先于删除的策略保证审计可追溯

如果后续开发要更进一步，还可以扩展：

- 账号分组
- 权限模板
- 登录失败锁定
- 强制改密
- 账号操作审批流

