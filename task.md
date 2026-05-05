# 账号管理开发任务

## 任务目标

在管理后台新增一个 `账号管理` 左侧 tab 页，用于管理后台管理员账号体系。该功能要覆盖账号的创建、编辑、启用/禁用、重置密码、删除，以及账号列表和详情查看，并且让审计日志能明确追踪“哪个管理员做了什么操作”。

本任务以现有管理员体系为基础，不重建一套独立账号系统。

## 参考设计

先阅读这份设计文档：

- [docs/admin-account-management-design.md](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/docs/admin-account-management-design.md)

## 当前现状

- 后端已经有 `Admin` 模型和基础管理员鉴权。
- 后端已经有管理员列表、创建、更新、删除、登录、修改密码等接口。
- 前端左侧菜单里还没有 `账号管理`。
- 审计日志已经存在，但账号治理没有独立页面承接。

## 你要完成的内容

### 1. 前端新增账号管理页面

新增一个后台页面，用于管理管理员账号。

建议页面能力：

- 列表展示管理员账号
- 支持筛选：关键词、角色、状态、权限
- 支持创建账号
- 支持编辑账号
- 支持重置密码
- 支持启用/禁用
- 支持删除
- 支持查看详情

页面建议文件名：

- `admin/src/views/AccountManagementView.vue`

### 2. 左侧菜单新增入口

在后台左侧导航的 `系统管理` 分组中加入：

- `账号管理`

点击后进入账号管理页面。

需要修改：

- [admin/src/components/AdminLayout.vue](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/admin/src/components/AdminLayout.vue)
- [admin/src/router/index.ts](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/admin/src/router/index.ts)

### 3. 补充前端 API 封装

在前端服务层新增管理员账号相关 API 封装。

建议集中放在：

- [admin/src/services/api.ts](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/admin/src/services/api.ts)

至少应包含：

- 获取账号列表
- 获取账号详情
- 创建账号
- 更新账号
- 重置密码
- 修改状态
- 删除账号

### 4. 后端补齐账号管理接口

复用现有 `Admin` 模型和管理员鉴权，在后端补齐账号管理相关接口，确保前端页面能完整闭环。

重点文件：

- [backend/src/controllers/admin.controller.js](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/controllers/admin.controller.js)
- [backend/src/routes/admin.routes.js](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/routes/admin.routes.js)
- [backend/src/models/Admin.js](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/models/Admin.js)

建议支持的后端能力：

- 列表查询
- 单条详情
- 创建
- 更新
- 重置密码
- 启用/禁用
- 删除

### 5. 审计日志必须补齐

账号管理的所有高危动作都必须写入审计日志。

至少要记录：

- 创建管理员
- 编辑管理员
- 重置密码
- 修改角色
- 修改权限
- 启用/禁用
- 删除

需要确保：

- 记录操作者 `adminId`
- 记录操作者 `adminName`
- 记录真实客户端 IP
- 记录操作类型和变更内容

重点文件：

- [backend/src/middleware/auditLog.js](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/middleware/auditLog.js)
- [backend/src/utils/auditHelper.js](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/utils/auditHelper.js)
- [backend/src/models/AuditLog.js](/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/src/models/AuditLog.js)

### 6. 权限边界要明确

建议权限规则：

- `superadmin`：可管理所有后台账号
- `admin`：默认只能查看自己的信息和修改自己的密码
- `operator`：默认只能查看自己的信息和修改自己的密码

如果你要放宽权限，必须在代码里写清楚具体规则，不要默许全部账号都能管账号。

### 7. 要补测试

至少补这些测试：

- 后端管理员账号接口测试
- 账号管理相关权限测试
- 审计日志写入测试
- 前端页面基础渲染测试或组件测试

## 推荐实现顺序

1. 先补后端接口和权限控制。
2. 再接前端 `api.ts`。
3. 再做 `AccountManagementView.vue`。
4. 再把左侧菜单和路由接入。
5. 最后补审计和测试。

## 具体验收标准

完成后应满足：

1. 左侧能看到 `账号管理`。
2. 能进入账号管理页。
3. 能看到管理员账号列表。
4. 能创建新管理员账号。
5. 能编辑账号信息。
6. 能启用或禁用账号。
7. 能重置密码。
8. 能删除账号。
9. 操作会进入审计日志。
10. 审计日志里能看出具体是谁执行的。

## 不要做的事

- 不要新建一套独立账号系统。
- 不要把账号数据和审计数据混成一张表。
- 不要让普通管理员默认拥有账号治理权限。
- 不要忽略审计日志。
- 不要改动 `.claude` 和 `.omc` 这类本地状态文件。

## 建议输出格式

如果你要继续交给别的模型做开发，建议它最终交付：

- 改动过的文件列表
- 接口说明
- 新增页面说明
- 测试结果
- 已知限制

