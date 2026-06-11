# 在场活动类型标签管理 — 实施计划

**状态**: pending approval  
**日期**: 2026-05-22

---

## 需求摘要

将在场（印记）活动类型标签从硬编码改为后台可配置，支持：
- 管理后台：新建、编辑、删除、拖拽排序标签
- 小程序：从接口拉取标签列表，按后台顺序显示

---

## 验收标准

- [ ] 管理后台「在场管理」页面有标签管理区，可新建/编辑/删除/拖拽排序
- [ ] 新建标签需填写：名称、emoji、key（唯一）
- [ ] 删除标签时，已有印记的 activityType 不受影响（软删除或保留历史）
- [ ] 小程序在场列表页启动时拉取标签列表，「全部」始终在第一位
- [ ] 小程序发布印记页的活动类型选择器也从接口拉取
- [ ] 标签按 sortOrder 升序排列
- [ ] 接口响应 < 500ms（标签数量少，无需分页）

---

## 实施步骤

### 第 1 步：后端 — 新增 ImprintActivityType 模型

**文件**: `backend/src/models/ImprintActivityType.js`（新建）

```js
{
  tenantId: ObjectId,       // 租户隔离
  key: String,              // 唯一标识，如 'reading'
  label: String,            // 显示名称，如 '读书会'
  emoji: String,            // emoji，如 '📚'
  sortOrder: Number,        // 排序，越小越靠前
  isActive: Boolean         // 软删除标记
}
```

- 使用 `tenantPlugin` 自动隔离租户
- 索引：`{ tenantId: 1, sortOrder: 1 }`、`{ tenantId: 1, key: 1 }` (unique)

### 第 2 步：后端 — 新增 Controller

**文件**: `backend/src/controllers/imprintActivityType.controller.js`（新建）

- `list()` — GET，返回当前租户所有 isActive=true 的标签，按 sortOrder 升序
- `create()` — POST，新建标签，key 在租户内唯一
- `update(id)` — PUT，修改 label/emoji/sortOrder
- `remove(id)` — DELETE，软删除（isActive=false）
- `reorder()` — PUT `/reorder`，接收 `[{id, sortOrder}]` 批量更新排序

### 第 3 步：后端 — 注册路由

**文件**: `backend/src/routes/imprint.routes.js`（修改，约 +10 行）

在现有 admin 路由区块新增：
```
GET    /imprints/activity-types          — 小程序拉取（需 authMiddleware）
GET    /admin/imprints/activity-types    — 管理后台列表（adminAuthMiddleware）
POST   /admin/imprints/activity-types    — 新建
PUT    /admin/imprints/activity-types/:id — 编辑
DELETE /admin/imprints/activity-types/:id — 删除
PUT    /admin/imprints/activity-types/reorder — 批量排序
```

### 第 4 步：后端 — 初始化默认数据脚本

**文件**: `backend/scripts/init-imprint-activity-types.js`（新建）

为每个租户插入 6 个默认标签（reading/cooking/tea/walk/create/other），仅在该租户无标签时执行（幂等）。

> ⚠️ 此脚本不清空任何数据，仅补充缺失的默认标签。

### 第 5 步：后端 — imprint.controller.js 兼容处理

**文件**: `backend/src/controllers/imprint.controller.js`（修改）

- `VALID_ACTIVITY_TYPES`（第 7 行）改为动态从数据库查询，或移除硬编码校验，改为「key 存在于当前租户标签表」的校验
- `list()` 的 activityType 过滤保持不变（传 key 字符串）

### 第 6 步：管理后台 — ImprintsManagementView.vue

**文件**: `admin/src/views/ImprintsManagementView.vue`（修改）

在现有列表上方增加「活动类型管理」折叠区块：
- 标签列表（支持拖拽排序，使用 `@vueuse/core` 的 `useSortable` 或 Element Plus 的 `el-table` row-drag）
- 新建按钮 → 弹窗（key、label、emoji 三个字段）
- 每行有编辑、删除操作
- 拖拽后自动保存排序

同时将现有硬编码的 `ACTIVITY_TYPES`（第 215-222 行）改为从接口拉取。

### 第 7 步：管理后台 — api.ts 新增接口

**文件**: `admin/src/services/api.ts`（修改，约 +20 行）

新增 `imprintActivityTypeApi`：
- `getTypes()`
- `createType(data)`
- `updateType(id, data)`
- `deleteType(id)`
- `reorderTypes(items)`

### 第 8 步：小程序 — imprint.service.js

**文件**: `miniprogram/services/imprint.service.js`（修改，约 +3 行）

新增：
```js
getActivityTypes() → GET /imprints/activity-types
```

### 第 9 步：小程序 — 在场列表页

**文件**: `miniprogram/pages/zaichang/list/list.js`（修改）

- 删除硬编码 `ACTIVITY_TYPES`（第 5-13 行）
- `onLoad` 时调用 `imprintService.getActivityTypes()`，在列表前插入 `{ key: 'all', label: '全部' }`
- 将结果存入 `data.activityTypes`，wxml 中 `wx:for` 渲染

**文件**: `miniprogram/pages/zaichang/list/list.wxml`（修改）

将硬编码的标签 tab 改为动态渲染。

### 第 10 步：小程序 — 发布页

**文件**: `miniprogram/pages/zaichang/publish/publish.js`（修改）

- 删除硬编码 `ACTIVITY_TYPES`（第 7-14 行）
- `onLoad` 时拉取标签列表，存入 `data.activityTypes`

**文件**: `miniprogram/pages/zaichang/publish/publish.wxml`（修改）

活动类型选择器改为动态渲染。

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 租户无标签时小程序显示空 | 接口返回空时降级到内置默认列表 |
| 拖拽排序库引入新依赖 | 用简单的上移/下移按钮替代拖拽，避免引入新包 |
| activityType 校验破坏现有印记创建 | 校验改为「key 在标签表中存在 OR 在默认列表中」，兼容历史数据 |
| 初始化脚本误操作 | 脚本幂等，仅补充缺失，不覆盖已有数据 |

---

## 验证步骤

1. 管理后台新建标签「冥想 🧘 meditation」，确认出现在列表
2. 拖拽/移动排序后刷新，确认顺序持久化
3. 小程序在场列表页刷新，确认新标签出现且顺序与后台一致
4. 发布印记时选择新标签，确认保存成功
5. 删除标签后，已有该类型的印记仍可正常显示（历史数据不受影响）
6. 切换租户，确认标签列表互不干扰
