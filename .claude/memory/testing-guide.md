# 测试指南快速索引

本文件只做入口，不再承载完整测试手册。

## 权威文档

- 测试总指南：`docs/guides/TESTING_GUIDE.md`
- 测试计划索引：`docs/plans/testing/TESTING_INDEX.md`
- 测试快速开始：`docs/plans/testing/TESTING_QUICK_START.md`

## 先看什么

按目标选择：

- 想直接跑现有测试：看 `docs/guides/TESTING_GUIDE.md`
- 想了解测试建设计划：看 `docs/plans/testing/TESTING_INDEX.md`
- 想快速知道今天先做哪一步：看 `docs/plans/testing/TESTING_QUICK_START.md`

## 最小记忆集

1. 后端测试是当前最成熟的一套，优先复用已有脚本和目录结构
2. 新增测试时，先确认是补回归还是补空白模块，不要把两类目标混在一次会话里
3. 小需求默认只跑和改动相关的最小测试集
4. 覆盖率文档和一次性执行计划不应放在默认入口里

## 高频命令

```bash
.claude/commands/testing/test-api.sh
.claude/commands/testing/test-auth.sh
.claude/commands/testing/test-insights.sh
cd backend && npm test
```

## 相关归档

- 历史测试计划参考：`.claude/memory/TESTING_PLAN_REFERENCE.md`
- 更细的阶段性计划：`docs/plans/testing/`

## 为什么缩短

之前这里和 `docs/guides/TESTING_GUIDE.md` 重复了大量测试统计、完成度和执行细节。对于会话上下文，这些信息大多不是默认必需。

最后更新：2026-05-14
