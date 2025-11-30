# Claude Code Subagents 系统

本项目包含4个专业领域的AI代理，用于并行处理大型功能开发。

## 📋 4个专家代理

### 1. 前端专家 (frontend-expert.yaml)
**职责**: 微信小程序前端开发
- WXML/WXSS编写
- WeUI组件定制
- 事件处理和数据绑定
- 性能优化

**常见任务**:
```bash
# 由前端专家处理
.claude/agents/frontend-expert.yaml

# 相关命令
.claude/commands/development/start-miniprogram.sh
```

### 2. 后端专家 (backend-expert.yaml)
**职责**: Node.js + Express API开发
- RESTful API设计
- 路由和控制器
- 认证和授权
- 错误处理

**常见任务**:
```bash
# 由后端专家处理
.claude/agents/backend-expert.yaml

# 相关命令
.claude/commands/development/start-backend.sh
.claude/commands/testing/test-api.sh
```

### 3. 数据库专家 (database-expert.yaml)
**职责**: MongoDB数据库设计和优化
- Schema设计
- 索引优化
- 数据迁移
- 性能调优

**常见任务**:
```bash
# 由数据库专家处理
.claude/agents/database-expert.yaml

# 相关命令
.claude/commands/deployment/backup-db.sh
```

### 4. 部署专家 (deployment-expert.yaml)
**职责**: 应用部署和维护
- 环境配置
- 版本管理
- 故障排查
- 备份恢复

**常见任务**:
```bash
# 由部署专家处理
.claude/agents/deployment-expert.yaml

# 相关命令
.claude/commands/deployment/check-deploy.sh
.claude/commands/deployment/backup-db.sh
```

---

## 🚀 如何使用Subagents

### 单个功能开发（前面的方式）
```
用户请求 → Claude Code (主对话) → 代码完成
```

### 大型功能开发（使用Subagents）
```
用户请求 (例如：添加"打卡统计"功能)
   ↓
Claude Code Plan Mode 分析
   ↓
分配任务到多个代理（并行）:
   • 前端代理: 创建统计页面
   • 后端代理: 创建统计API
   • 数据库代理: 优化查询性能
   ↓
代理并行工作（2小时 vs 原来的5小时）
   ↓
集成测试和最终验证
   ↓
代码完成
```

---

## 📊 性能对比

### 添加"打卡统计"功能

**单线程方式** (传统)：
```
1. 后端API设计   (1.5小时)
   ↓
2. 前端页面     (2小时)
   ↓
3. 数据库优化    (0.5小时)
   ↓
4. 集成测试     (1小时)
──────────────
总耗时: 5小时
```

**并行方式** (Subagents)：
```
后端API设计(1.5h) ║ 前端页面(2h) ║ 数据库优化(0.5h)
─────────────────────────────────────────────────
最长耗时: 2小时
集成测试: 30分钟
──────────────
总耗时: 2.5小时 (减少50%)
```

**性能提升**: 50%+ (5小时 → 2.5小时)

---

## 🎯 何时使用Subagents

### ✅ 应该使用
- [ ] 功能涉及前端、后端、数据库多个部分
- [ ] 功能估算时间 > 3小时
- [ ] 有独立的子任务可以并行处理
- [ ] 团队人手充足（可以并行工作）

### ❌ 不需要使用
- [ ] 简单的Bug修复
- [ ] 单个模块修改
- [ ] 功能 < 2小时

---

## 📝 每个代理的文件位置

```
.claude/agents/
├── frontend-expert.yaml      # 前端专家配置
├── backend-expert.yaml       # 后端专家配置
├── database-expert.yaml      # 数据库专家配置
├── deployment-expert.yaml    # 部署专家配置
└── README.md                 # 本文件
```

---

## 🔍 代理的协作方式

### 前端 ↔ 后端

**场景**: 前端需要新API
```
前端专家: "需要/api/v1/insights/stats API"
     ↓
后端专家: 查看.claude/memory/architecture/api-response-format.md
     ↓
创建API: {
  success: true,
  data: { total: 100, thisMonth: 30, ... }
}
     ↓
前端专家: 集成API到页面
```

### 后端 ↔ 数据库

**场景**: 后端查询太慢
```
后端专家: "getInsights查询返回1000条，太慢"
     ↓
数据库专家: 创建 { userId, date } 索引
     ↓
查询优化: 从1000ms降低到10ms
     ↓
后端专家: 部署新API
```

### 任何 ↔ 部署

**场景**: 发布新版本
```
所有代理: 代码就绪
     ↓
部署专家:
  1. 备份数据库
  2. 执行迁移脚本
  3. 部署应用
  4. 验证功能
     ↓
用户发布
```

---

## 💡 最佳实践

### 1. 明确的分工
```
前端代理: 处理所有.wxml/.wxss/.js文件
后端代理: 处理所有路由、控制器、中间件
数据库代理: 处理所有Schema、索引、迁移
部署代理: 处理环境、版本、备份
```

### 2. 及时沟通
```
通过Memory系统: .claude/memory/architecture/
通过Commands: .claude/commands/testing/
通过实时日志: 应用日志
```

### 3. 统一标准
```
API响应格式: .claude/memory/architecture/api-response-format.md
数据模型: .claude/memory/architecture/insights-feature.md
代码规范: .claude/memory/standards/
```

### 4. 测试验证
```
前端: 视觉验证，交互测试
后端: API测试 (.claude/commands/testing/test-api.sh)
数据库: 数据一致性，查询性能
部署: 冒烟测试，监控告警
```

---

## 🚀 快速开始

### 第一步：理解代理能力
```bash
cat .claude/agents/frontend-expert.yaml    # 了解前端代理
cat .claude/agents/backend-expert.yaml     # 了解后端代理
cat .claude/agents/database-expert.yaml    # 了解数据库代理
cat .claude/agents/deployment-expert.yaml  # 了解部署代理
```

### 第二步：查看代理职责
```bash
grep "expertise:" .claude/agents/*.yaml    # 查看技能
grep "common_tasks:" .claude/agents/*.yaml # 查看常见任务
```

### 第三步：分配任务给代理
```
用户: "添加打卡统计功能，包括前端页面和后端API"
     ↓
Claude Code Plan Mode:
  任务分解为:
  1. 前端页面 → 前端专家
  2. 后端API → 后端专家
  3. 数据库优化 → 数据库专家
     ↓
并行执行，每个代理各司其职
     ↓
集成验证，功能完成
```

---

## 📚 相关文档

- **快速命令**: `.claude/commands/README.md`
- **Memory系统**: `.claude/memory/quick-reference.md`
- **开发指南**: `DEVELOPMENT.md`
- **Git工作流**: `GIT_WORKFLOW.md`

---

## ✅ Subagents的优势

1. **效率** - 并行处理，减少50%的开发时间
2. **质量** - 专家型代理，更高的代码质量
3. **一致性** - 统一的标准和规范
4. **可维护** - 清晰的职责分工
5. **可扩展** - 支持快速增加新功能

---

**创建时间**: 2025-11-30
**状态**: ✅ 完全就绪
**版本**: 1.0
