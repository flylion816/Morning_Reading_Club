# Context Cost Audit - 2026-05-14

本清单面向 Codex / Claude 会话成本控制，目标是减少无效上下文、降低重复文档维护成本、让小需求默认走更短路径。

## 当前观察

高成本入口文件：

- `CLAUDE.md`: 177 行
- `AGENTS.md`: 177 行
- `docs/guides/BUG_FIXES.md`: 4404 行
- `docs/guides/AGENTS_HISTORY.md`: 322 行
- `.claude/memory/quick-reference.md`: 265 行

高成本主题文档：

- `docs/guides/DEPLOY_INSTRUCTIONS.md`: 1298 行
- `.claude/memory/online-deployment-plan.md`: 1139 行
- `docs/guides/TESTING_GUIDE.md`: 854 行
- `.claude/memory/day-2-checkin-module-analysis.md`: 789 行
- `.claude/memory/INSIGHT_ANALYSIS.md`: 772 行
- `docs/guides/SECURITY.md`: 765 行

重复最明显的区域：

- 根入口文档：`AGENTS.md` / `CLAUDE.md`
- 环境配置：`docs/guides/ENV_CONFIG_GUIDE.md` / `.claude/memory/ENV_CONFIG_GUIDE.md`
- 测试指南：`docs/guides/TESTING_GUIDE.md` / `.claude/memory/testing-guide.md` / `.claude/memory/TESTING_PLAN_REFERENCE.md`
- 部署主题：`docs/guides/DEPLOY_INSTRUCTIONS.md` / `.claude/memory/online-deployment-plan.md` / `.claude/memory/local-deployment-guide.md` / `.claude/memory/deployment-checklist.md`
- 通知主题：`.claude/memory/standards/miniprogram-notification-guide.md` / `.claude/memory/standards/notification-system-guide.md`
- 项目说明与结构：`.claude/memory/project-structure.md` / `docs/guides/QUICK_START.md` / 根入口文档部分内容

## 已执行

1. 将根 `AGENTS.md` 保持为短版入口，历史案例迁移到 `docs/guides/AGENTS_HISTORY.md`
2. 将 `CLAUDE.md` 同步压缩为短版入口，去掉与 `AGENTS.md` 重复的大段历史和案例
3. 将 `.claude/memory/ENV_CONFIG_GUIDE.md` 从完整正文缩成 46 行索引页，权威内容指向 `docs/guides/ENV_CONFIG_GUIDE.md`
4. 将 `.claude/memory/testing-guide.md` 从完整正文缩成 44 行索引页，权威内容指向 `docs/guides/TESTING_GUIDE.md`
5. 将 `.claude/memory/TESTING_PLAN_REFERENCE.md` 缩成 31 行历史计划入口，改为指向 `docs/plans/testing/`

## 建议优先级

### P0：继续保留短入口

目标：任何会话启动时默认只读短入口，不自动展开长历史。

动作：

- 保持 `AGENTS.md` / `CLAUDE.md` 小于 200 行
- 新历史案例不回灌到根入口
- 根入口只保留规则、导航、红线、常用命令

预期收益：

- 每次新会话固定成本显著下降
- 入口文件可维护性提高

### P1：把 `.claude/memory/` 从“总结仓库”改成“索引仓库”

目标：优先读索引，按需跳转，不直接读长总结。

动作：

- 保留 `.claude/memory/quick-reference.md` 为唯一默认入口
- 把 400 行以上的 memory 文档改成“摘要页 + 原文页”
- `IMPLEMENTATION_LOG.md`、`day-*`、`INSIGHT_*` 这类阶段性总结挪到 `docs/history/` 或单独 archive 目录

建议先处理：

- `.claude/memory/online-deployment-plan.md`
- `.claude/memory/day-2-checkin-module-analysis.md`
- `.claude/memory/INSIGHT_ANALYSIS.md`
- `.claude/memory/INSIGHT_IMPLEMENTATION_PLAN.md`
- `.claude/memory/IMPLEMENTATION_LOG.md`

预期收益：

- 减少检索时误打开长总结
- memory 更像索引系统，而不是第二套文档系统

### P1：合并重复专题

目标：一个主题只有一个权威入口，其他文档只保留链接。

建议合并：

- 环境配置：
  `docs/guides/ENV_CONFIG_GUIDE.md` 作为权威文档，`.claude/memory/ENV_CONFIG_GUIDE.md` 缩成摘要和跳转
- 测试：
  `docs/guides/TESTING_GUIDE.md` 作为权威文档，`.claude/memory/testing-guide.md` 和 `TESTING_PLAN_REFERENCE.md` 缩成索引
- 部署：
  `docs/guides/DEPLOY_INSTRUCTIONS.md` 和 `PRODUCTION_OPERATIONS_RUNBOOK.md` 二选一做主文档，其余 deployment memory 改为场景卡片
- 通知：
  `miniprogram-notification-guide.md` 和 `notification-system-guide.md` 合并为一份

预期收益：

- 降低维护时的重复编辑
- 降低模型在相似主题间反复搜索的概率

### P2：给超长文档做“前置索引”

目标：保留信息量，但不给模型一次吞整本书。

建议对象：

- `docs/guides/BUG_FIXES.md`
- `docs/guides/DEPLOY_INSTRUCTIONS.md`
- `docs/guides/TESTING_GUIDE.md`
- `docs/guides/SECURITY.md`

动作：

- 每个长文档前 40 到 80 行改成“问题目录 / 决策目录 / 关键词目录”
- 明确“先看这里，再跳章节”
- 每章增加固定关键词，方便 `rg` 命中

预期收益：

- 问题定位更快
- 降低把整份长文档读进上下文的概率

### P2：阶段性文档归档

目标：把一次性实施记录和长期规范分开。

适合归档到 `docs/history/` 的类型：

- `day-*` 实施总结
- `*_SUMMARY.md`
- `*_PLAN_REFERENCE.md`
- 一次性排障日志

应该保留在 guides / memory 的类型：

- 当前仍有效的流程规范
- 当前系统仍在使用的架构约束
- 高频查询索引

预期收益：

- 降低常驻目录噪音
- 让检索结果更贴近当前有效信息

## 使用建议

### 对用户提需求时

- 指定目标文件、页面、接口，不要只给问题现象
- 小需求单开新会话，不和大任务混在一起
- 明确“只改代码”还是“只分析”
- review 时限定范围，只看本次 diff 或某条链路

### 对 Codex / Claude 工作流

- 小需求默认 fast
- 高推理只留给支付、登录、权限、数据库写入、数据迁移、架构、安全
- 优先 `rg` 精确找文件和关键词，不做全仓大范围阅读
- 完成一个阶段后，用 5 到 10 行摘要替代长过程追溯

## 下一步建议

按投入产出比排序：

1. 把 deployment memory 文档改成索引 + 场景卡片
2. 给 `docs/guides/BUG_FIXES.md` 增加前置目录页
3. 将 `.claude/memory/IMPLEMENTATION_LOG.md` 和 `day-*` 迁入 `docs/history/`
4. 合并通知相关 memory 文档
5. 收敛 `.claude/memory/project-structure.md` 与 `docs/guides/QUICK_START.md`

## 判断标准

后续每新增一份文档时，先问四个问题：

1. 这是长期规范，还是一次性记录？
2. 这个主题是否已经有权威文档？
3. 这份内容是否必须全文存在，还是索引就够？
4. 这份文档是否会增加会话默认上下文成本？
