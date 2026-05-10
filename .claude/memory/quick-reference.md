# 🔍 快速问题查询指南

> **最常用的文件** - 遇到问题时首先查看这里！

---

## 🚀 快速命令系统 (Commands)

**如果需要快速启动服务、测试API、搜索问题或部署检查，使用Commands系统！**

### 最常用的命令

```bash
# 启动后端并快速测试
.claude/commands/development/start-backend.sh
.claude/commands/testing/test-api.sh

# 快速搜索问题（而不是手动查文档）
.claude/commands/search/search-bug.sh "页面空白"
.claude/commands/search/search-bug.sh "用户ID"

# 部署前检查和备份
.claude/commands/deployment/check-deploy.sh
.claude/commands/deployment/backup-db.sh
```

**详细使用指南**：[standards/commands-usage.md](./standards/commands-usage.md)

---

## 📍 按现象快速查找

### 页面相关问题

- **页面空白、样式不显示**
  - 常见原因：WXSS路径错误、权重不足、CSS加载失败
  - 查看详情：[issues/frontend/wxml-wxss.md](./issues/frontend/wxml-wxss.md)
  - 典型问题：问题1, 问题2, 问题3

- **点击事件处理异常、嵌套点击失效**
  - 常见原因：Button标签事件冒泡、bindtap/catchtap使用不当
  - 查看详情：[issues/frontend/wxml-wxss.md](./issues/frontend/wxml-wxss.md) - 问题4
  - 解决方案：使用view+catchtap替代button+bindtap

- **组件显示异常、样式混乱**
  - 常见原因：WeUI组件配置、props传递错误、生命周期问题
  - 查看详情：[issues/frontend/components.md](./issues/frontend/components.md)
  - 典型问题：问题4, 问题5

- **布局错乱、Flex失效、scroll-view异常**
  - 常见原因：Flex属性设置、scroll-view高度约束、嵌套问题
  - 查看详情：[issues/frontend/layout-ui.md](./issues/frontend/layout-ui.md)
  - 典型问题：问题18-24

### 数据相关问题

- **数据不显示或更新不及时**
  - 常见原因：绑定错误、setData调用不正确、对象引用问题
  - 查看详情：[issues/frontend/data-binding.md](./issues/frontend/data-binding.md)
  - 典型问题：问题11, 问题12, 问题13, 问题14, 问题15

- **事件不触发、回调异常**
  - 常见原因：事件绑定错误、作用域问题、事件冒泡
  - 查看详情：[issues/frontend/data-binding.md](./issues/frontend/data-binding.md)
  - 典型问题：问题11-17

- **页面返回后数据未刷新、状态不更新**
  - 常见原因：onShow() 生命周期未刷新可变状态
  - 查看详情：[issues/frontend/enrollment-state-refresh.md](./issues/frontend/enrollment-state-refresh.md)
  - 典型问题：问题34 - 报名状态未刷新

### 日期和时间问题

- **日期格式不一致、时间偏差、时区问题**
  - 常见原因：ISO格式转换、时区差异、前后端格式不一致
  - 查看详情：[issues/common/datetime.md](./issues/common/datetime.md)
  - 典型问题：问题6-10

### API和网络问题

- **API返回结构异常、响应处理错误**
  - 常见原因：响应格式变化、unwrapping失败、错误处理缺失
  - 查看详情：[issues/frontend/api-integration.md](./issues/frontend/api-integration.md)
  - 典型问题：问题27, 问题28, 问题29, 问题30

- **接口返回的是对象不是数组，`map` 报错**
  - 常见原因：`preserveResponse: true` 后直接把响应包装对象当数组处理
  - 查看详情：[issues/frontend/api-integration.md](./issues/frontend/api-integration.md)
  - 典型问题：问题35

### 🚀 部署和基础设施问题 ⭐ **线上部署必读**

- **页面白屏 + JavaScript 加载失败（MIME 类型错误）**
  - 错误信息：`Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html"`
  - 常见原因：Nginx location 块优先级错误，静态资源被 SPA 路由拦截
  - 解决方案：使用非正则前缀 `^~` 而不是 `~`，把静态资源 location 放在前面
  - 查看详情：[bug-fixes/ssl-nginx-deployment.md](./bug-fixes/ssl-nginx-deployment.md) - 问题2
  - 部署检查清单：[deployment-checklist.md](./deployment-checklist.md) - 2.6 Nginx 静态资源配置

- **浏览器显示"连接不安全"警告**
  - 症状：绿色锁形变红，浏览器提示"此网站不安全"
  - 常见原因：使用自签名证书（Self-signed certificate）
  - 解决方案：申请 Let's Encrypt 免费证书（被全球浏览器信任）
  - 查看详情：[bug-fixes/ssl-nginx-deployment.md](./bug-fixes/ssl-nginx-deployment.md) - 问题1
  - 部署检查清单：[deployment-checklist.md](./deployment-checklist.md) - 2.5 HTTPS 和 SSL 证书

- **修复后浏览器仍显示错误**
  - 常见原因：浏览器缓存了旧的错误响应
  - 解决方案：清除浏览器缓存 + 硬刷新 (Cmd+Shift+R / Ctrl+Shift+R)
  - 查看详情：[bug-fixes/ssl-nginx-deployment.md](./bug-fixes/ssl-nginx-deployment.md) - 问题3

---

## 🔴 按错误关键词快速查找

| 错误信息/关键词          | 常见原因                    | 查看位置                                                               |
| ------------------------ | --------------------------- | ---------------------------------------------------------------------- |
| `undefined`              | 数据未初始化、属性不存在    | [issues/frontend/data-binding.md](./issues/frontend/data-binding.md)   |
| `Cannot read property`   | 对象为null、属性为undefined | [issues/frontend/data-binding.md](./issues/frontend/data-binding.md)   |
| `404 / 路由不存在`       | API路由未定义               | [backend/api-design.md](./backend/api-design.md)                       |
| `userId / _id / user.id` | 用户ID字段不统一            | [architecture/user-id-field.md](./architecture/user-id-field.md)       |
| `权限不足 / 认证失败`    | 认证中间件缺失、token无效   | [backend/auth-middleware.md](./backend/auth-middleware.md)             |
| `数据查询为空`           | $or查询失效、条件错误       | [architecture/insights-feature.md](./architecture/insights-feature.md) |
| `样式不生效`             | WXSS权重、路径错误          | [issues/frontend/wxml-wxss.md](./issues/frontend/wxml-wxss.md)         |
| `日期格式错误`           | ISO转换、时区差异           | [issues/common/datetime.md](./issues/common/datetime.md)               |
| `map is not a function`  | 响应对象误当数组使用        | [issues/frontend/api-integration.md](./issues/frontend/api-integration.md) |
| `点击按钮触发父事件`     | Button标签事件冒泡          | [issues/frontend/wxml-wxss.md](./issues/frontend/wxml-wxss.md) - 问题4 |
| `嵌套点击失效`           | bindtap无法阻止冒泡         | [issues/frontend/wxml-wxss.md](./issues/frontend/wxml-wxss.md) - 问题4 |

---

## 🎯 按功能快速查找

| 功能模块     | 相关问题                         | 查看位置                                                                                     |
| ------------ | -------------------------------- | -------------------------------------------------------------------------------------------- |
| **用户认证** | 登录流程、token处理、权限检查    | [backend/auth-middleware.md](./backend/auth-middleware.md)                                   |
| **打卡记录** | 数据显示、查询过滤、性能优化     | [architecture/insights-feature.md](./architecture/insights-feature.md)                       |
| **小凡看见** | 功能架构、数据流、问题排查       | [architecture/insights-feature.md](./architecture/insights-feature.md)                       |
| **期次报名** | 报名检查、状态刷新、生命周期管理 | [issues/frontend/enrollment-state-refresh.md](./issues/frontend/enrollment-state-refresh.md) |
| **API规范**  | 响应格式、错误处理、字段映射     | [architecture/api-response-format.md](./architecture/api-response-format.md)                 |
| **数据库**   | MongoDB操作、索引、查询优化      | [backend/database.md](./backend/database.md)                                                 |

---

## 🔥 最近常见问题（按解决频率排序）

### Top 5 热点问题

1. **API返回结构错误**
   - 用户ID字段不统一 (`id` vs `_id`)
   - 响应unwrapping失败
   - 错误格式不标准
   - 接口返回对象却被当数组，导致 `map` 报错
   - 📖 [查看详情](./architecture/user-id-field.md)

2. **认证中间件缺失**
   - 路由没有应用authMiddleware
   - 导致req.user为undefined
   - 查询无法使用当前用户ID
   - 📖 [查看详情](./backend/auth-middleware.md)

3. **页面空白或样式不显示**
   - WXSS文件路径错误
   - CSS权重不足
   - 样式加载顺序问题
   - 📖 [查看详情](./issues/frontend/wxml-wxss.md)

4. **数据不显示在列表中**
   - setData调用错误
   - 数据绑定路径错误
   - 数据源为空或未初始化
   - 📖 [查看详情](./issues/frontend/data-binding.md)

5. **用户ID显示undefined**
   - 前后端返回字段不统一
   - 数据层未正确映射
   - 查询条件使用错误字段
   - 📖 [查看详情](./architecture/user-id-field.md)

---

## 💻 快速搜索命令

在Memory系统中全文搜索：

```bash
# 搜索特定关键词
grep -r "关键词" .claude/memory/ --include="*.md"

# 示例
grep -r "页面空白" .claude/memory/
grep -r "userId" .claude/memory/
grep -r "认证" .claude/memory/
grep -r "setData" .claude/memory/
```

---

## 📁 文件导航

| 文件位置               | 用途         | 访问频率    |
| ---------------------- | ------------ | ----------- |
| **quick-reference.md** | 快速查询索引 | ⭐⭐⭐ 高频 |
| **issues/frontend/**   | 前端问题库   | ⭐⭐ 中频   |
| **issues/backend/**    | 后端问题库   | ⭐⭐ 中频   |
| **issues/common/**     | 通用问题库   | ⭐ 低频     |
| **architecture/**      | 架构决策     | ⭐⭐ 参考   |
| **standards/**         | 编码规范     | ⭐ 初次     |
| **index.json**         | 机器可读索引 | ⭐ 工具用   |

---

## 🚀 使用流程

### 当你遇到问题时：

```
1. 打开这个文件 (quick-reference.md)
   ↓
2. 按"现象" / "关键词" / "功能"查找相关问题
   ↓
3. 点击链接进入对应的详细文档
   ↓
4. 找到问题编号，查看完整解决方案
   ↓
5. 应用解决方案 (预期耗时: 2-5分钟)
```

### 当你解决新问题时：

```
1. 记录问题编号和解决方案
   ↓
2. 更新对应的 issues/*.md 文件
   ↓
3. 同时更新 quick-reference.md 的"最近常见问题"部分
   ↓
4. 下次遇到相同问题可以秒解
```

---

## 📞 获取帮助

- **快速问题** → 查看 quick-reference.md（这个文件）
- **详细解决方案** → 点击链接进入 issues/ 或 architecture/
- **系统架构** → 查看 architecture/ 目录
- **编码规范** → 查看 standards/ 目录
- **新问题** → 查询后更新相应文档

---

## ✅ 提示

- 💡 最常遇到的问题已在"Top 5"部分列出
- 🔗 所有链接都是相对路径，可以直接点击
- 📖 每个问题都有完整的原因分析和解决步骤
- ⚡ 平均查询时间：**2-3分钟**（vs原来10分钟）
- 🎯 本文档定期更新，保持问题的时效性

---

**最后更新**：2025-11-30
**维护者**：Claude Code Memory System
**问题总数**：35+ 个精选问题
