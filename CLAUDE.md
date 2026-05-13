<!-- OPENSPEC:START -->

# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Claude Code 晨读营项目指南

## 会话启动必做

每次开始新会话，先清理遗留进程，防止 context 泄漏：

```bash
pkill -9 -f "npm run dev"; pkill -9 -f "node.*src/server"; pkill -9 -f "mongosh"; pkill -9 -f "docker"; sleep 2
```

随后快速确认状态：

```bash
git status --short
git log --oneline | head -5
```

## 数据库安全红线

禁止不经用户明确指令执行任何数据库重置脚本。

- 严禁自动执行 `backend/scripts/init-mongodb.js` 或任何 `init-*.js`
- 严禁调用会清空、覆盖、重置数据库的命令
- 严禁看到数据库为空就假设需要初始化
- 如果发现数据缺失，立即停止并报告情况，等待用户明确确认
- 执行前必须说明：“我将执行 init-mongodb.js，这会清空现有数据，你确认吗？”

历史教训：2025-12-03 因错误执行 `init-mongodb.js` 导致 90+ 天真实用户数据被永久删除。

## 默认工作模式

默认按 fast 模式处理日常小需求：优先快速读代码、做最小必要修改、跑针对性验证。

适用 fast 模式：

- 文案、样式、小页面调整
- 单接口或单组件 bug 修复
- 文档整理、历史案例迁移
- 有明确文件和明确目标的小改动

需要提高推理深度或先做方案：

- 涉及支付、登录、权限、数据库写入、数据迁移
- 跨前端、后端、数据库的大功能
- 架构调整、性能或安全改造
- 需求不清晰且可能影响生产数据

结论：fast 模式不会让“小需求”明显变差，反而能减少上下文负担和响应延迟；复杂任务要主动升档或先查 OpenSpec。

## 开发流程

按这个顺序推进，不跳过验证：

1. 阅读相关代码和历史记录
2. 实现最小必要改动
3. 自测 API、页面或脚本
4. 覆盖正常场景和关键错误场景
5. 等用户测试反馈
6. 用户确认后再提交和推送
7. 有复用价值的问题写入文档

## 文档导航

优先入口：

- 快速问题查询：`.claude/memory/quick-reference.md`
- 历史案例归档：`docs/guides/AGENTS_HISTORY.md`
- Bug 修复经验库：`docs/guides/BUG_FIXES.md`

专题文档：

- 开发流程：`DEVELOPMENT.md`
- 小程序规范：`MINIPROGRAM_GUIDE.md`
- Git 工作流：`GIT_WORKFLOW.md`
- 部署指南：`DEPLOYMENT.md`
- 部署脚本：`DEPLOY_SCRIPTS.md`
- OpenSpec：`openspec/AGENTS.md`

工具系统：

- Memory：`.claude/memory/`
- Commands：`.claude/commands/`
- Git Hooks：`.claude/hooks/`
- Subagents：`.claude/agents/`

## 常用命令

启动与测试：

```bash
.claude/commands/development/dev-start-backend.sh
.claude/commands/development/dev-start-miniprogram.sh
.claude/commands/testing/test-api.sh
.claude/commands/testing/test-auth.sh
.claude/commands/testing/test-insights.sh
```

搜索历史问题：

```bash
.claude/commands/search/search-bug.sh "页面空白"
.claude/commands/search/search-bug.sh "用户ID"
.claude/commands/search/search-bug.sh backend
```

部署准备：

```bash
.claude/commands/deployment/check-deploy.sh
.claude/commands/deployment/backup-db.sh
```

注意：备份命令允许；初始化、清空、重置数据库必须先获得用户明确确认。

## 项目信息

| 项目 | 说明 |
| --- | --- |
| 项目名称 | 晨读营小程序 |
| 仓库 | `flylion816/Morning_Reading_Club` |
| 类型 | 微信小程序 + Node.js 后端 + Vue 管理后台 |
| 技术栈 | 微信小程序原生框架、WeUI、Node.js、MongoDB、Vue 3 |

## 项目结构

```text
miniprogram/              # 微信小程序
backend/                  # Node.js 后端
admin/                    # Vue 3 管理后台
docs/                     # 项目文档
docs/guides/              # 开发指南和历史经验
openspec/                 # OpenSpec 变更规范
.claude/                  # Memory、Commands、Hooks、Agents
```

## 关键规范

- 微信小程序使用原生框架 + WeUI，不引入第三方前端框架
- 后端用户主键统一使用 MongoDB 标准 `_id`
- 需要用户身份的接口必须在路由层挂载认证中间件
- Mongoose populate 数据进入表单前要转换为 ID 字符串
- 环境变量必须在依赖它的模块加载前设置
- 提交前跑与改动相关的最小测试集
- 推送按项目 Git 规范执行，优先使用已配置的 GitHub CLI/token 流程

## 完成检查清单

- [ ] 功能或文档改动是否完整？
- [ ] 是否没有触碰数据库重置脚本？
- [ ] 是否做了针对性验证？
- [ ] 是否覆盖关键错误场景？
- [ ] 是否需要更新 `docs/guides/BUG_FIXES.md` 或 `docs/guides/AGENTS_HISTORY.md`？
- [ ] 是否等待用户测试确认后再提交？

最后更新：2026-05-14
