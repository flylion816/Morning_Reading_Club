# Memory 系统使用指南

欢迎使用晨读营项目的 Memory 系统！这是一个结构化的知识库，帮助你快速查找和解决历史问题。

---

## 🎯 快速开始（3步）

### 1️⃣ 遇到问题？打开这个文件

```
.claude/memory/quick-reference.md
```

### 2️⃣ 按现象/关键词/功能查找

- 页面空白？→ 查看"页面相关问题"
- API错误？→ 查看"API和网络问题"
- 用户ID问题？→ 查看"按错误关键词"

### 3️⃣ 点击链接进入详细文档

```
issues/frontend/wxml-wxss.md
│
├── 问题1：页面空白，样式不显示
├── 问题2：CSS权重问题
└── 问题3：布局错乱
```

---

## 📁 目录结构说明

```
.claude/memory/
│
├── quick-reference.md          ⭐ 最常用 - 快速问题查询
├── README.md                    📖 本文件 - 使用指南
├── index.json                   🔧 机器可读索引
│
├── issues/                      📚 问题库（按类型分类）
│   ├── frontend/               💻 前端问题（约24个）
│   │   ├── wxml-wxss.md       🎨 页面显示问题
│   │   ├── components.md      🧩 组件问题
│   │   ├── data-binding.md    🔗 数据绑定问题
│   │   ├── layout-ui.md       📐 布局问题
│   │   └── api-integration.md 🌐 API集成问题
│   │
│   ├── backend/                🖥️ 后端问题（约6个）
│   │   ├── api-design.md      🔴 API设计规范
│   │   ├── auth-middleware.md 🔐 认证问题
│   │   └── database.md        🗄️ 数据库问题
│   │
│   └── common/                 🛠️ 通用问题（约5个）
│       ├── datetime.md        📅 日期时间问题
│       ├── state-management.md 📊 状态管理问题
│       └── debugging.md       🐛 调试技巧
│
├── architecture/               🏗️ 架构决策记录
│   ├── user-id-field.md       👤 用户ID字段统一
│   ├── api-response-format.md 📋 API响应格式
│   ├── request-unwrapping.md  📦 响应解包模式
│   └── insights-feature.md    📈 打卡记录架构
│
└── standards/                  📚 编码规范
    ├── miniprogram-best-practices.md  ✨ 小程序最佳实践
    ├── error-handling.md              ⚠️ 错误处理规范
    ├── api-testing.md                 ✅ API测试规范
    └── testing-checklist.md           📋 测试清单
```

---

## 📖 常见查询场景

### 场景1：页面显示异常

```
现象：加载页面后只显示空白，没有内容

步骤：
1. 打开 quick-reference.md
2. 查找"页面相关问题"部分
3. 点击"页面空白、样式不显示" → issues/frontend/wxml-wxss.md
4. 查看问题1的完整解决方案
5. 应用代码修复 (耗时: 2-5分钟)
```

### 场景2：数据不显示

```
现象：数据已从API获取，但页面没有显示出来

步骤：
1. 快速参考 → 数据相关问题
2. 点击"数据不显示或更新不及时"
3. issues/frontend/data-binding.md
4. 问题11-15，通常是setData调用错误
```

### 场景3：API返回异常

```
现象：前端收到API响应，但数据结构异常

步骤：
1. 快速参考 → API和网络问题
2. 或按关键词 → 搜索"API返回结构"
3. issues/frontend/api-integration.md
4. architecture/api-response-format.md
```

### 场景4：用户认证问题

```
现象：用户无法正确获取自己的数据

步骤：
1. 按关键词 → "认证失败"或"权限不足"
2. backend/auth-middleware.md
3. architecture/user-id-field.md
4. 通常是两个原因之一：
   - 路由缺少authMiddleware
   - 用户ID字段不统一
```

---

## 🔍 搜索技巧

### 快速搜索命令

```bash
# 方法1：在Memory中搜索
cd .claude/memory
grep -r "关键词" . --include="*.md"

# 方法2：搜索特定问题编号
grep -r "问题27" . --include="*.md"

# 方法3：搜索特定文件
cat issues/frontend/data-binding.md | grep "undefined"
```

### 搜索示例

```bash
# 搜索"页面空白"相关问题
grep -r "页面空白" .

# 搜索"setData"问题
grep -r "setData" .

# 搜索"user._id"相关
grep -r "_id\|userId" .

# 搜索认证问题
grep -r "authMiddleware\|认证" .
```

---

## 📊 文件使用频率参考

根据项目历史，以下是常用文件的排序：

```
⭐⭐⭐ 高频（每周多次）
  └─ quick-reference.md
  └─ issues/frontend/data-binding.md
  └─ issues/frontend/api-integration.md
  └─ architecture/user-id-field.md

⭐⭐ 中频（每周1-2次）
  └─ issues/frontend/wxml-wxss.md
  └─ issues/frontend/layout-ui.md
  └─ backend/auth-middleware.md

⭐ 低频（偶尔查看）
  └─ issues/common/datetime.md
  └─ standards/*.md
  └─ architecture/*.md（参考）
```

---

## ✏️ 更新规则

### 何时更新Memory

1. **解决新问题时** → 记录到对应的 `issues/` 文件
2. **发现设计问题时** → 更新 `architecture/` 文件
3. **总结最佳实践时** → 更新 `standards/` 文件

### 如何更新

```markdown
## 问题33：这是一个新问题

**现象**：
[描述问题现象]

**根本原因**：
[分析根本原因]

**解决方案**：

1. 第一步
2. 第二步
3. 第三步

**代码示例**：
[提供代码示例]

**相关提交**：
commit-hash (如果有的话)

**关键教训**：

- ✅ 这是对的
- ❌ 这是错的
```

### 更新频率

- **hot-fix**：问题发现 → 立即记录（最重要）
- **定期整理**：每月1-2次整理一下structure
- **文档完善**：每季度审视一遍是否还准确

---

## 🔗 与其他文档的关系

| 文档               | 关系             | 使用场景             |
| ------------------ | ---------------- | -------------------- |
| **BUG_FIXES.md**   | 原始文档（归档） | 查看完整历史         |
| **CLAUDE.md**      | 项目总指南       | 项目整体了解         |
| **DEVELOPMENT.md** | 开发流程         | 了解工作流程         |
| **Memory系统**     | 优化产物         | 快速查找问题（推荐） |

---

## 💡 使用建议

### ✅ 应该这样做

1. ✅ 遇到问题**先查这里**，80%的问题都能找到答案
2. ✅ 定期**浏览Top 5**热点问题，提前预防
3. ✅ 发现新问题**立即记录**，帮助未来的自己
4. ✅ **按现象查找**比按错误代码更快
5. ✅ 使用**相对链接**在文档间导航

### ❌ 避免这样做

1. ❌ 不要一开始就读整个BUG_FIXES.md（太长了）
2. ❌ 不要只依赖关键词搜索，先看quick-reference.md
3. ❌ 不要忘记更新Memory（新问题应立即记录）
4. ❌ 不要在中间删除或重命名文件（会破坏链接）
5. ❌ 不要让Memory系统过时（定期维护）

---

## 📈 性能指标

### 预期效果

| 指标         | 改进前 | 改进后 | 提升     |
| ------------ | ------ | ------ | -------- |
| 问题检索时间 | 10分钟 | 2分钟  | **80%**  |
| 上下文消耗   | 4114行 | <500行 | **88%**  |
| 查询成功率   | 60%    | 95%+   | **提升** |
| 学习曲线     | 高     | 低     | **加快** |

### 达成标准

- [ ] 能在 2-3 分钟内找到任何常见问题
- [ ] 上下文消耗从 4114 行下降到 500 行以内
- [ ] 新问题解决后立即能在 Memory 中找到
- [ ] 至少 90% 的问题都在 quick-reference.md 有索引

---

## 🔐 维护责任

### Memory系统的维护者

- 📝 **创建者**：Claude Code
- 🔧 **维护者**：开发团队（你）
- 📅 **更新周期**：发现新问题时立即更新
- 📊 **定期审视**：每月审视一次完整性

---

## 📞 常见问题

### Q: 如何快速找到"页面空白"的解决方案？

A: 打开 quick-reference.md → 查找"页面相关问题" → 点击链接

### Q: 能不能用grep搜索？

A: 可以！`grep -r "关键词" .claude/memory/`

### Q: 如果找不到我的问题怎么办？

A:

1. 先尝试按不同的关键词搜索
2. 查看architecture/目录的架构决策
3. 如果是真的新问题，解决后记录到对应文件

### Q: Memory系统什么时候会过时？

A: 如果问题的解决方案改变，需要及时更新文档

---

## 🚀 开始使用

### 第一次使用

1. 快速浏览 quick-reference.md（5分钟）
2. 了解目录结构（2分钟）
3. 尝试搜索一个你之前遇到过的问题（3分钟）
4. 熟悉后开始日常使用

### 日常使用

```
遇到问题
  ↓
打开 quick-reference.md
  ↓
按现象查找 (2分钟)
  ↓
点击链接查看详情 (2-3分钟)
  ↓
应用解决方案 ✅
```

---

**使用愉快！如有问题，欢迎更新和补充。** 🎉

最后更新：2025-11-30
