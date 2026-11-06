# Claude Code Commands 快速命令系统使用指南

**创建时间**：2025-11-30
**类别**：编码规范与最佳实践
**优先级**：高 - 日常开发必用

---

## 📋 Commands 系统概览

晨读营项目提供了9个精心设计的快速命令，用于加速开发、测试和部署流程。

### 位置

```
.claude/commands/
├── development/     # 开发启动
├── testing/         # API和功能测试
├── search/          # 问题查询
└── deployment/      # 部署管理
```

### 9个命令全清单

```
开发:   start-all.sh          start-backend.sh       start-miniprogram.sh
测试:   test-api.sh           test-auth.sh           test-insights.sh
搜索:   search-bug.sh
部署:   check-deploy.sh       backup-db.sh
```

---

## 🚀 日常开发场景使用指南

### 场景1：开始开发工作

**目标**：启动后端，验证API可用

**步骤**：

```bash
# 1. 启动后端服务（在一个终端）
.claude/commands/development/start-backend.sh
# 输出：后端服务启动在 http://localhost:3000

# 2. 另开终端，快速测试API
.claude/commands/testing/test-api.sh
# 输出：完整的API测试结果，包括token
```

**预期结果**：

- ✅ 后端运行在Port 3000
- ✅ 所有主要API端点可用
- ✅ 获得管理员token用于后续测试

**耗时**：2分钟（包括启动和测试）

**技巧**：

- 后端启动后，保持终端开启以查看日志
- 测试成功会自动提取token，可用于手动curl测试

---

### 场景2：快速定位历史问题

**目标**：遇到"页面空白"问题，快速查找解决方案

**步骤**：

```bash
# 1. 搜索关键词
.claude/commands/search/search-bug.sh "页面空白"

# 输出示例：
# 搜索 Memory 系统
# 🔎 在 Memory 系统中搜索...
#
# ✓ 搜索结果:
#
# [前端] wxml-wxss.md
#    → 问题1：页面空白，样式不显示。原因：样式文件路径错误...
```

**预期结果**：

- ✅ 找到相关的历史问题
- ✅ 显示问题文件位置
- ✅ 获得解决方案摘要

**耗时**：30秒

**常见搜索词**：

```bash
.claude/commands/search/search-bug.sh "数据不显示"    # 数据问题
.claude/commands/search/search-bug.sh "用户ID"        # 用户相关
.claude/commands/search/search-bug.sh "API错误"       # 后端问题
.claude/commands/search/search-bug.sh "事件不触发"    # 事件问题
```

---

### 场景3：完整的功能测试

**目标**：新增打卡功能，需要完整测试

**步骤**：

```bash
# 1. 确保后端运行（见场景1）

# 2. 快速测试所有主要API
.claude/commands/testing/test-api.sh
# 验证：健康检查、登录、仪表板、期次列表、用户信息

# 3. 详细测试认证流程
.claude/commands/testing/test-auth.sh
# 验证：正确凭证、错误密码、无效用户、Token访问

# 4. 完整测试打卡功能
.claude/commands/testing/test-insights.sh
# 验证：登录、获取记录、创建、更新、删除
```

**预期结果**：

- ✅ API快速测试：5项全部通过
- ✅ 认证测试：5个场景全部通过
- ✅ 打卡测试：7个步骤全部通过

**耗时**：3-5分钟

**输出解读**：

- 🟢 ✅ - 测试通过
- 🔴 ❌ - 测试失败（需要修复）
- 🟡 ⚠️ - 警告（响应可能异常）

---

### 场景4：部署前准备

**目标**：部署到生产前的检查清单

**步骤**：

```bash
# 1. 检查部署状态
.claude/commands/deployment/check-deploy.sh
# 输出：Git状态、后端状态、数据库、文件、配置、清单

# 2. 备份数据库
.claude/commands/deployment/backup-db.sh
# 输出：备份完成，文件保存在 ./backups/

# 3. 手动检查清单
# ☐ 所有代码已提交到 Git
# ☐ 所有提交已推送到 GitHub
# ☐ 后端依赖已安装
# ☐ 环境变量已配置
# ☐ 数据库连接正常
```

**预期结果**：

- ✅ Git状态清晰
- ✅ 后端可用
- ✅ 数据库已备份
- ✅ 所有检查项已确认

**耗时**：5-10分钟

**注意**：

- 备份文件保存在 `./backups/db_backup_YYYYMMDD_HHMMSS.tar.gz`
- 定期清理旧备份：`find ./backups -mtime +7 -delete`

---

### 场景5：小程序开发设置

**目标**：启动小程序开发，了解配置

**步骤**：

```bash
# 显示小程序配置信息
.claude/commands/development/start-miniprogram.sh

# 输出：
# 📋 小程序项目位置: ./miniprogram
# 🛠️ 使用微信开发者工具:
#   1. 打开微信开发者工具
#   2. 点击 '导入项目'
#   3. 选择 miniprogram 文件夹
```

**预期结果**：

- ✅ 了解项目位置
- ✅ 获得开发工具链接
- ✅ 配置参考信息

**下一步**：

1. 打开微信开发者工具
2. 导入 `miniprogram` 目录
3. 配置后端地址：`http://localhost:3000/api/v1`

---

## 📊 Commands 使用效果对比

### 启动后端

**传统方式**（5分钟）：

```
1. 打开终端
2. 进入backend目录
3. npm install（如果缺依赖）
4. npm run dev
5. 等待启动完成
```

**使用Commands**（30秒）：

```bash
.claude/commands/development/start-backend.sh
```

**效率提升**：90%

---

### 测试API

**传统方式**（10分钟）：

```bash
# 逐个手写curl命令
curl -X POST http://localhost:3000/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@morningreading.com","password":"<从密钥管理服务读取>"}'

# 复制token，再测试其他端点
# ... 重复多次
```

**使用Commands**（2分钟）：

```bash
.claude/commands/testing/test-api.sh
```

**效率提升**：80%

---

### 查找问题

**传统方式**（15分钟）：

```
1. 打开BUG_FIXES.md（4114行）
2. Ctrl+F搜索关键词
3. 可能找不到（因为表述方式不同）
4. 重新读文档
5. 最终找到解决方案
```

**使用Commands**（1分钟）：

```bash
.claude/commands/search/search-bug.sh "关键词"
```

**效率提升**：93%

---

## 🔍 Commands 内部工作原理

### search-bug.sh 如何工作

```
用户输入: .claude/commands/search/search-bug.sh "页面空白"
   ↓
脚本检查: .claude/memory/ 目录是否存在
   ↓
搜索操作: grep -r "页面空白" .claude/memory/ --include="*.md"
   ↓
结果处理: 提取文件名、匹配行、内容摘要
   ↓
输出格式: [类别] 文件名
         → 匹配内容摘要...
   ↓
用户查看: 快速定位到相关问题和解决方案
```

### test-api.sh 如何工作

```
启动检查: curl到后端健康检查端点
   ↓
认证流程: 发送邮箱密码，获取token
   ↓
顺序测试: 使用token逐个调用API
   ↓
结果收集: 统计成功/失败的测试项
   ↓
输出报告: 显示完整的测试结果和token
```

---

## ⚙️ Commands 的环境要求

### 必需工具

```
bash              - 脚本解释器
curl              - HTTP客户端（用于API测试）
mongosh           - MongoDB客户端（用于数据库备份）
grep              - 文本搜索（用于Memory系统搜索）
```

### 必需目录

```
.claude/commands/     - Commands脚本位置
.claude/memory/       - Memory系统位置（用于search-bug.sh）
.claude/hooks/        - Git Hooks配置
backend/              - 后端项目目录
miniprogram/          - 小程序项目目录
```

### 可选工具

```
lsof              - 端口检查（用于check-deploy.sh）
mongodump         - MongoDB备份（用于backup-db.sh）
```

---

## 💡 Commands 使用最佳实践

### 1. 开发前规范化

```bash
# 每次开发前
.claude/commands/development/start-backend.sh     # 启动服务
.claude/commands/testing/test-api.sh              # 快速验证
```

### 2. 问题优先查询Memory

```bash
# 遇到问题时，先不要盲目修改
.claude/commands/search/search-bug.sh "问题描述"

# 如果找到解决方案，直接应用
# 如果是新问题，记录到 .claude/memory/
```

### 3. 部署有备无患

```bash
# 每次部署前
.claude/commands/deployment/backup-db.sh         # 先备份
.claude/commands/deployment/check-deploy.sh      # 再检查
```

### 4. 定期清理备份

```bash
# 每周清理旧备份
find ./backups -name "*.tar.gz" -mtime +7 -delete
```

---

## 🚀 Commands 扩展性

### 添加新命令

如果需要添加新命令，遵循规范：

```bash
# 位置：.claude/commands/[category]/[name].sh
# 示例：.claude/commands/testing/test-metrics.sh

# 基本结构
#!/bin/bash

# 颜色定义（使用项目统一的）
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 标题
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}🎯 命令标题${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"

# 逻辑代码
# ...

# 结果输出
echo -e "${GREEN}✅ 完成!${NC}"
```

### 命名规范

- 使用小写字母和连字符
- 清晰表达功能
- 避免特殊字符

---

## 📝 常见问题

### Q: Commands不可执行

**A**: 检查权限

```bash
chmod +x .claude/commands/*/*.sh
```

### Q: Backend启动失败

**A**: 检查依赖

```bash
cd backend && npm install
```

### Q: search-bug.sh搜不到结果

**A**: 检查Memory系统

```bash
ls -la .claude/memory/
cat .claude/memory/quick-reference.md
```

### Q: 测试API返回401

**A**: 后端未启动或token过期

```bash
.claude/commands/development/start-backend.sh
.claude/commands/testing/test-api.sh  # 重新测试
```

---

## 📚 相关资源

- **完整指南**：`.claude/commands/README.md` (450+行)
- **实施日志**：`.claude/commands/IMPLEMENTATION_LOG.md`
- **Memory系统**：`.claude/memory/quick-reference.md`
- **Git Hooks**：`.claude/hooks/README.md`

---

## ✅ Commands 使用检查清单

完成任务后，检查是否有用到Commands：

- [ ] 启动服务时是否用过 `start-backend.sh`？
- [ ] 测试功能时是否用过 `test-*.sh`？
- [ ] 遇到问题时是否用过 `search-bug.sh`？
- [ ] 部署前是否用过 `check-deploy.sh` 和 `backup-db.sh`？

**如果全部打✅，说明已经很好地利用了Commands系统！**

---

**创建时间**：2025-11-30
**更新状态**：✅ 完整
**使用频率**：⭐⭐⭐⭐⭐ 日常必用
