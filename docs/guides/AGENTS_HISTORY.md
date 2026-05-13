# AGENTS 历史案例归档

本文件从仓库根目录 `AGENTS.md` 迁移而来，用于保存会话指南中的历史复盘、经验教训和回滚参考。日常新会话只需阅读根目录 `AGENTS.md`；遇到相似问题时再查本文件或 `docs/guides/BUG_FIXES.md`。

## 2025-11-30：四阶段优化系统完成 + AGENTS.md 入门指南

完成内容：

1. Memory 系统
- 知识库索引：`.claude/memory/quick-reference.md`
   - 问题分类：frontend/backend/architecture
- 搜索脚本：`.claude/commands/search/search-bug.sh`

2. Git Hooks 自动化
   - Pre-commit：代码质量检查
   - Commit-msg：提交信息验证
   - Post-commit：自动反馈
- 安装脚本：`.claude/hooks/install.sh`

3. Commands 快速命令系统
   - 开发、测试、搜索、部署脚本
- 文档：`.claude/commands/README.md`
- 使用经验：`.claude/memory/standards/commands-usage.md`

4. Subagents 专家代理系统
   - 前端、后端、数据库、部署 4 个领域专家
   - 适合大功能并行处理

5. AGENTS.md 入门指南
   - 四阶段优化系统快速入门
   - 五大使用场景速查表
   - 新会话三步快速上手

关键成果：

- 完整的 Memory + Commands + Hooks + Subagents 系统已就位
- 新会话可通过根目录 `AGENTS.md` 快速找到入口
- 大任务优先拆分并行，小任务直接处理

## 2025-11-29：文档重构

历史上曾将 4708 行的 `AGENTS.md` 拆分为专题文档：

- `DEVELOPMENT.md`：开发流程与规范
- `MINIPROGRAM_GUIDE.md`：小程序开发指南
- `GIT_WORKFLOW.md`：Git 工作流程
- `docs/guides/BUG_FIXES.md`：Bug 修复经验库

经验：

- 根目录 `AGENTS.md` 只保留启动必读和导航
- 详细规则进入专题文档
- 历史案例进入 `docs/guides/AGENTS_HISTORY.md` 或 `docs/guides/BUG_FIXES.md`

## 用户 ID 字段统一重构（2025-11-29）

### 问题背景

用户 ID 字段在代码中存在不一致：

- 后端某些地方返回 `id: user._id`
- 前端代码期望 `userInfo._id`
- 导致 insights 页面显示 `当前用户ID: undefined`，无法加载数据

前一个会话采用兼容性方案，在 `app.js` 中添加复杂的三级 fallback 逻辑。后来判断这是设计 smell，决定统一为 MongoDB 标准 `_id` 字段。

### 重构内容

后端统一返回 `_id`：

```text
backend/src/controllers/auth.controller.js
  id: user._id -> _id: user._id

backend/src/controllers/user.controller.js
  id: user._id -> _id: user._id
  id: userId -> _id: userId
```

前端移除兼容性代码：

```text
miniprogram/app.js
  移除 id/openid/tempId 三级 fallback
  改为直接检查 userInfo._id
```

相关提交：

```text
Commit: bcb0a81
Message: refactor: 统一用户ID字段为_id - 移除兼容性代码
```

### 回滚参考

推荐用 Git 回滚：

```bash
git revert bcb0a81
```

手动回滚时，需要把这些响应字段从 `_id` 改回 `id`：

- `backend/src/controllers/auth.controller.js`
- `backend/src/controllers/user.controller.js`

如果需要回退前端兼容逻辑，可从 Git 历史提交 `f49af14` 找回旧版 `checkLoginStatus()`。

### 验证项

- 登录流程成功，Storage 中有 `user_info`
- 登录后页面日志中的用户 ID 不是 `undefined`
- insights 页面能显示记录
- 返回用户对象的 API 字段格式符合当前约定

### 经验教训

- MongoDB 技术栈优先统一使用 `_id`
- 兼容性 fallback 只能作为短期过渡
- 前后端字段命名不一致应从接口契约修复，不应只在前端兜底

## Vue 表单 el-select 绑定 populate 对象导致空值问题

### 问题现象

小凡看见编辑表单中，“被看见人” `targetUserId` 和“期次” `periodId` 显示为空，但列表中这些字段有数据。

### 根本原因

Mongoose populate 后，引用字段变成完整对象：

```js
{
  targetUserId: { _id: 'xxx', nickname: '阿泰' },
  periodId: { _id: 'yyy', name: '心流之境' }
}
```

而 `el-select` 的 `v-model` 期望字符串 ID。把对象直接赋值给 `v-model` 会匹配失败。

### 解决方案

编辑前提取 ID：

```js
function handleEditInsight(insight) {
  editingInsight.value = {
    ...insight,
    targetUserId: typeof insight.targetUserId === 'object'
      ? insight.targetUserId?._id
      : insight.targetUserId,
    periodId: typeof insight.periodId === 'object'
      ? insight.periodId?._id
      : insight.periodId
  };
}
```

修改文件：

- `admin/src/views/InsightsManagementView.vue`
- 提交：`9d282d8`

### 经验教训

- populate 返回对象，不是 ID
- 列表展示数据和编辑表单数据常常需要不同结构
- 编辑入口应有明确的数据转换函数
- 后端可考虑区分“列表响应”和“编辑响应”

## 路由认证中间件缺失导致 `$or` 查询失效问题（2025-11-30）

### 问题现象

`getInsightsForPeriod` 已经使用 `$or` 查询返回用户创建和被分配的 insights，但小程序首页仍显示“本期暂无记录”。

### 根本原因

`/insights/period/:periodId` 路由没有应用 `authMiddleware`，导致 `req.user` 永远是 `undefined`，查询回退到未登录逻辑。

错误写法：

```js
router.get('/period/:periodId', getInsightsForPeriod);
```

正确写法：

```js
router.get('/period/:periodId', authMiddleware, getInsightsForPeriod);
```

修改文件：

- `backend/src/routes/insight.routes.js`
- 提交：`83e2671`

### 经验教训

- 控制器中读取 `req.user` 前，路由必须挂载认证中间件
- 只检查控制器逻辑不够，要同时检查路由注册链路

## Codex 上下文清理经验（2025-11-30）

### 问题现象

Codex 环境变慢，`/context` 显示 messages 占用很高，free space 很低，compact 频繁触发。

### 根本原因

会话间遗留了大量后台进程，每个进程的启动命令都被纳入上下文提醒，导致 token 被无效占用。

### 解决方案

每次新会话开始先清理：

```bash
pkill -9 -f "npm run dev"; pkill -9 -f "node.*src/server"; pkill -9 -f "mongosh"; pkill -9 -f "docker"; sleep 2
```

必要时验证：

```bash
ps aux | grep -E "npm|node" | grep -v grep | wc -l
```

### 经验教训

- 会话启动清理应保留在根目录 `AGENTS.md`
- 不要让 dev server 或 mongosh 长期遗留
- 长时间工作结束前应关闭不再需要的后台进程

## NODE_ENV 初始化顺序导致 CORS 和配置使用开发环境（2026-03-03）

### 问题现象

管理后台 `https://wx.shubai01.com/admin` 请求后端 API 时收到 CORS 错误：

```text
Origin https://wx.shubai01.com not allowed by CORS
```

即使已配置 `ADMIN_URL` 和 `API_BASE_URL`，后端仍使用开发环境白名单。

### 根本原因

`server.js` 先加载 `app`，而 `app.js` 初始化 CORS 时依赖 `NODE_ENV`。此时 `NODE_ENV` 还没有被设置为 `production`。

错误顺序：

```js
const app = require('./app');

// 很多代码后才设置 NODE_ENV
process.env.NODE_ENV = process.env.NODE_ENV || envConfig.config.backend.nodeEnv;
```

`app.js` 初始化 CORS：

```js
app.use(cors(getCorsOptions()));
```

### 解决方案

1. 在加载 `app` 之前设置环境变量：

```js
try {
  const envConfigPath = path.resolve(__dirname, '../../.env.config.js');
  const envConfig = require(envConfigPath);
  process.env.NODE_ENV = process.env.NODE_ENV || envConfig.config.backend.nodeEnv;
  process.env.MONGODB_URI = process.env.MONGODB_URI || envConfig.config.backend.mongodbUri;
} catch (error) {
  logger.warn('未找到统一环境配置文件 .env.config.js，将使用 .env 文件');
}

require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
require('dotenv').config();

const app = require('./app');
```

2. CORS 白名单改为请求时动态获取：

```js
origin: (origin, callback) => {
  const allowedOrigins = getAllowedOrigins();
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  }
}
```

3. Morgan 日志格式根据运行环境选择：

```js
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat));
```

修改文件：

- `backend/src/server.js`
- `backend/src/app.js`
- `backend/src/config/cors.js`
- 提交：`5eb30e4`

### 经验教训

- 环境变量必须在依赖它的模块加载前设置
- 避免启动时缓存依赖环境变量的配置
- 对模块加载顺序敏感的位置要写清楚注释

## 维护记录

- 最后从 `AGENTS.md` 迁移：2026-05-14
- 维护者：Codex
- 项目仓库：Morning_Reading_Club
