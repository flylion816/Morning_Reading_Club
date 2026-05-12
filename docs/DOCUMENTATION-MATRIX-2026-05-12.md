# 文档矩阵与维护策略

> 盘点日期：2026-05-12  
> 目的：解决 v3/v4/v6/历史报告并存导致的入口混乱问题。

## 1. 当前权威入口

| 文档 | 用途 | 维护状态 |
| --- | --- | --- |
| `docs/PRD-代码同步版-2026-05-12.md` | 当前产品事实、业务模块、权限边界 | 新增，后续 PRD 优先维护 |
| `docs/architecture/DETAILED-DESIGN-代码同步版-2026-05-12.md` | 当前详细设计、数据流、关键实现 | 新增，后续详细设计优先维护 |
| `docs/backend/API-接口索引-代码同步版-2026-05-12.md` | 当前后端路由索引和鉴权说明 | 新增，后续接口文档优先维护 |
| `docs/backend/DATA-MODEL-代码同步版-2026-05-12.md` | 当前 Mongoose 模型和关系 | 新增，后续数据模型优先维护 |
| `docs/guides/LONG_IMAGE_SHARE_DESIGN.md` | 打卡详情和小凡看见长图分享专项设计 | 新增，随相关代码维护 |

## 2. 保留但需降级为历史参考

| 文档 | 原用途 | 当前处理 |
| --- | --- | --- |
| `docs/PRD-完整业务逻辑文档.md` | 大型 PRD 汇总 | 顶部增加代码同步版入口，内容保留作历史背景 |
| `docs/backend/01-PRD-产品需求文档v3.0.md` | v3 PRD | 历史参考 |
| `docs/backend/01-PRD-产品需求文档v4.0.md` | v4 PRD | 历史参考 |
| `docs/backend/04-API接口设计v3.0-part1.md` | v3 API | 历史参考 |
| `docs/backend/04-API接口设计v3.0-part2.md` | v3 API | 历史参考 |
| `docs/backend/04-API接口设计v4.0-Postman.md` | Postman 测试说明 | 保留测试说明，接口事实以代码同步版为准 |
| `docs/backend/03-数据库设计v3.0.md` | 旧数据库设计 | 保留历史说明，模型事实以代码同步版为准 |
| `docs/architecture/ARCHITECTURE.md` | 架构图和存储说明 | 保留图示，详细设计以代码同步版为准 |

## 3. 继续维护的指南类文档

| 文档 | 用途 |
| --- | --- |
| `docs/guides/BUG_FIXES.md` | 历史问题和修复经验 |
| `docs/guides/SECURITY.md` | 安全指南 |
| `docs/guides/PRODUCTION_OPERATIONS_RUNBOOK.md` | 生产运维 |
| `docs/guides/TESTING_GUIDE.md` | 测试指南 |
| `docs/guides/MINIPROGRAM_GUIDE.md` | 小程序开发规范 |
| `docs/guides/GIT_WORKFLOW.md` | Git 工作流 |

## 4. 建议归档区域

以下文档更像阶段性报告，建议后续统一移动到 `docs/history/` 或保持现状但不作为开发入口：

- `docs/plans/2026-*`
- `docs/history/*`
- `docs/plans/testing/*`
- `docs/*最佳实践*.docx`

## 5. 后续维护规则

1. 改产品行为：更新 PRD 代码同步版。
2. 改页面状态、数据流、长图、鉴权或架构：更新详细设计。
3. 改后端路由、鉴权或响应结构：更新 API 接口索引。
4. 改 Mongoose model、索引、关系：更新数据模型索引。
5. 改测试策略或补测试：更新对应测试文档或专项设计。
6. 引入新能力、破坏性变更、架构变化：先按 OpenSpec 建 proposal。
