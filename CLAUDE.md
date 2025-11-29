# Claude Code 晨读营项目指南

> **重要提示**：本文档已重构。详细内容分散在多个专题文档中，便于查找和维护。

## 📚 文档导航

本项目的所有开发指南已按主题分类，使用时请根据需求查阅对应文档：

### 🚀 快速开始

1. **项目信息与开发流程** → [`DEVELOPMENT.md`](./DEVELOPMENT.md)
   - 项目基本信息（技术栈、仓库地址等）
   - Claude Code 标准工作流程（7个步骤）
   - 自测流程与用户测试协作
   - 文档更新与Git提交规范

2. **微信小程序开发规范** → [`MINIPROGRAM_GUIDE.md`](./MINIPROGRAM_GUIDE.md)
   - WeUI 组件库使用规范
   - 小程序架构与目录结构
   - 代码规范与最佳实践
   - 性能优化与适配指南

3. **Git 工作流程** → [`GIT_WORKFLOW.md`](./GIT_WORKFLOW.md)
   - Git 基本操作命令
   - GitHub 认证与推送（使用 gh CLI）
   - Commit message 规范
   - 常见问题排查

4. **Bug修复经验库** → [`BUG_FIXES.md`](./BUG_FIXES.md)
   - 30+ 个常见问题及解决方案
   - 调试技巧与排查流程
   - 项目开发里程碑记录
   - 经验教训与最佳实践

---

## 📋 项目信息快速参考

| 项目 | 说明 |
|------|------|
| **项目名称** | 晨读营小程序 |
| **仓库地址** | https://github.com/flylion816/Morning_Reading_Club |
| **项目类型** | 微信小程序 |
| **技术栈** | 微信小程序原生框架 + Node.js + MongoDB |
| **UI框架** | WeUI 小程序版 |

---

## 🔑 核心原则

### 开发流程

按照以下顺序执行，**绝对不能跳过任何步骤**：

```
第1步: 代码实现 → 第2步: 自测(curl/Postman) → 第3步: 用例测试
     ↓
第4步: 等待用户测试 → 第5步: 根据反馈修复 → 第6步: 用户确认后提交GitHub
     ↓
第7步: 更新CLAUDE.md文档(如需要)
```

**详见** → [`DEVELOPMENT.md`](./DEVELOPMENT.md)

### 编码规范

1. **微信小程序开发**：必须使用原生框架 + WeUI，不用第三方框架
2. **代码提交**：使用 `gh` 命令推送，不要直接 `git push`
3. **Commit格式**：遵循 `feat:`、`fix:`、`docs:` 等规范前缀
4. **文档更新**：重要问题必须记录到 Bug修复经验库

**详见** → [`MINIPROGRAM_GUIDE.md`](./MINIPROGRAM_GUIDE.md) 与 [`GIT_WORKFLOW.md`](./GIT_WORKFLOW.md)

---

## 🎯 工作检查清单

完成任务后，使用此清单确保没有遗漏：

- [ ] 功能是否完整实现？
- [ ] 是否用 curl 或 Postman 自测所有 API？
- [ ] 正常场景和错误场景都验证过？
- [ ] 等待用户测试反馈后再提交？
- [ ] 是否有值得记录的问题（Bug修复经验库）？
- [ ] 是否更新了相关文档？
- [ ] 是否推送到 GitHub？

---

## 🐛 常见问题速查表

| 问题分类 | 查看位置 |
|---------|--------|
| 页面空白、CSS错误、组件问题 | [`BUG_FIXES.md`](./BUG_FIXES.md) 问题1-5 |
| 日期格式、时间不一致、数据问题 | [`BUG_FIXES.md`](./BUG_FIXES.md) 问题6-10 |
| 事件处理、数据传递、状态管理 | [`BUG_FIXES.md`](./BUG_FIXES.md) 问题11-15 |
| API返回结构、响应处理 | [`BUG_FIXES.md`](./BUG_FIXES.md) 问题27-30 |
| Flex布局、scroll-view、日历组件 | [`BUG_FIXES.md`](./BUG_FIXES.md) 问题18-24 |
| 调试技巧、排查流程 | [`BUG_FIXES.md`](./BUG_FIXES.md) - 调试技巧部分 |

---

## 📝 快速命令参考

### Git 提交

```bash
cd "/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营"

# 添加所有修改
git add -A

# 提交
git commit -m "feat: 功能描述

详细说明:
- 修改点1
- 修改点2

测试验证: 所有 API 端点已通过测试 ✅

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 推送到 GitHub（使用 gh）
git push https://$(gh auth token)@github.com/flylion816/Morning_Reading_Club.git main
```

### 测试 API

```bash
# 登录测试
curl -X POST http://localhost:3000/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@morningreading.com","password":"admin123456"}'

# 使用token访问受保护的API
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/v1/stats/dashboard
```

---

## 📚 项目结构

```
晨读营小程序/
├── miniprogram/              # 小程序主目录
│   ├── app.js               # 应用入口
│   ├── app.json             # 应用配置
│   ├── config/              # 配置文件
│   ├── utils/               # 工具函数
│   ├── services/            # API服务层
│   ├── pages/               # 页面目录
│   ├── components/          # 组件目录
│   └── assets/              # 静态资源
├── backend/                  # Node.js 后端
│   ├── src/
│   │   ├── models/          # MongoDB模型
│   │   ├── controllers/     # 业务逻辑
│   │   ├── routes/          # 路由定义
│   │   ├── middleware/      # 中间件
│   │   └── utils/           # 工具函数
│   └── package.json
├── admin/                    # Vue 3 管理后台
│   ├── src/
│   │   ├── views/           # 页面
│   │   ├── components/      # 组件
│   │   └── services/        # API服务
│   └── package.json
├── CLAUDE.md                 # 本文件（项目指南索引）
├── DEVELOPMENT.md            # 开发流程与规范
├── MINIPROGRAM_GUIDE.md      # 小程序开发指南
├── GIT_WORKFLOW.md           # Git工作流程
├── BUG_FIXES.md              # Bug修复经验库
└── README.md                 # 项目说明
```

---

## 🤖 工作模式说明

本项目采用 Claude Code 高效协作模式：

1. **自测驱动**：实现后立即自测，不依赖用户测试发现问题
2. **文档驱动**：重要决策和问题都记录在案，形成知识库
3. **Git清洁**：每个提交都是完整的、经过验证的功能点
4. **规范驱动**：遵循统一的编码、命名、提交规范

**详见** → [`DEVELOPMENT.md`](./DEVELOPMENT.md)

---

## 📖 参考资源

- [GitHub CLI 文档](https://cli.github.com/manual/)
- [Git 官方文档](https://git-scm.com/doc)
- [微信小程序文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [WeUI 小程序版](https://github.com/wechat-miniprogram/weui-miniprogram)
- [Node.js 文档](https://nodejs.org/docs/)
- [MongoDB 文档](https://docs.mongodb.com/)

---

## ✨ 最近更新

### 2025-11-29：文档重构

- 将 4708 行的 CLAUDE.md 拆分为 4 个专题文档
- 创建 `DEVELOPMENT.md`：开发流程与规范（250行）
- 创建 `MINIPROGRAM_GUIDE.md`：小程序开发指南（352行）
- 创建 `GIT_WORKFLOW.md`：Git工作流程（199行）
- 创建 `BUG_FIXES.md`：Bug修复经验库（3908行）
- 改进文档可读性和查找效率

**优点**：
- ✅ 内容按主题分类，便于快速查找
- ✅ 减少单文件体积，加快打开速度
- ✅ 便于维护和定期更新
- ✅ 保持完整性，所有内容都保留

---

## 🔗 快速导航

| 需求 | 查看文档 |
|------|--------|
| 如何开始开发？ | [`DEVELOPMENT.md`](./DEVELOPMENT.md) |
| 小程序怎么写？ | [`MINIPROGRAM_GUIDE.md`](./MINIPROGRAM_GUIDE.md) |
| Git怎么用？ | [`GIT_WORKFLOW.md`](./GIT_WORKFLOW.md) |
| 遇到bug怎么办？ | [`BUG_FIXES.md`](./BUG_FIXES.md) |
| 项目总体情况？ | 本文件 (CLAUDE.md) |

---

**最后更新**：2025-11-29
**维护者**：Claude Code
**项目仓库**：[Morning_Reading_Club](https://github.com/flylion816/Morning_Reading_Club)
