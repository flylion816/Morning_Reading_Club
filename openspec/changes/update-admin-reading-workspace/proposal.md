# Change: 统一管理后台晨读会视觉体验

## Why
管理后台登录页已经形成安静、克制的晨读会书页风格，但登录后的侧栏、页头和业务页面仍更接近通用管理系统。视觉体验在登录前后出现断层，各业务页的卡片、筛选区和标题层级也缺少统一规则。

## What Changes
- 建立登录后管理后台统一的“书房工作台”页面框架。
- 用章节眉题、纸张层次、书脊式导航和一致的内容节奏延续登录页风格。
- 保留每个租户的品牌主色，并自动派生选中态、强调色和浅色背景。
- 统一 Element Plus 卡片、表格、筛选区、分页、弹窗和空状态的视觉规则。
- 保持现有路由、权限、业务接口和数据行为不变。
- 覆盖桌面及窄屏布局，避免内容遮挡和横向破版。

## Impact
- Affected specs: `admin-reading-workspace`
- Affected code: `admin/src/components/AdminLayout.vue`, `admin/src/assets/base.css`, `admin/src/assets/main.css`, `admin/src/stores/tenant.ts`, related admin tests
- Data impact: none
- API impact: none

