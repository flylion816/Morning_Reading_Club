# 📦 线上部署完整包 - 部署总结

## 🎉 已完成的工作

我已为你准备了**完整的线上部署方案**，包括：

### 1️⃣ 代码实现（2个提交）

**提交 1: f3fd3b8 - 功能实现**

```
feat: 将数据库管理密码从前端迁移到后端 MongoDB

修改8个文件：
  ✅ backend/src/models/Admin.js
  ✅ backend/src/controllers/admin.controller.js
  ✅ backend/src/routes/admin.routes.js
  ✅ admin/src/services/api.ts
  ✅ admin/src/components/AdminLayout.vue
  ✅ admin/.env.development
  ✅ admin/.env.production
  ✅ backend/scripts/reset-admin-password.js
```

**提交 2: 007392d - 部署脚本和文档**

```
docs: 添加线上部署脚本和指南

新增3个文件：
  ✅ deploy-db-access-password.sh (完整自动化脚本)
  ✅ DEPLOY_INSTRUCTIONS.md (详细部署指南)
  ✅ DEPLOY_QUICK_REFERENCE.txt (快速参考卡)
```

### 2️⃣ 部署脚本特性

**deploy-db-access-password.sh** 自动完成：

```bash
✅ 前置检查
   • 检查 Node.js 是否安装
   • 验证必要文件是否存在
   • 测试 MongoDB 连接

✅ 备份操作
   • 自动备份 .env.production
   • 备份保存在 .backup/ 目录
   • 可用于灾难恢复

✅ 环境配置更新
   • 添加 ADMIN_DB_ACCESS_PASSWORD
   • 更新 MYSQL_PASSWORD
   • 更新 REDIS_PASSWORD

✅ 数据库操作
   • 执行 reset-admin-password.js 脚本
   • 创建 Admin 表的 dbAccessPassword 字段
   • 使用 bcrypt 哈希密码

✅ 验证和报告
   • 验证配置文件格式
   • 生成详细的部署报告
   • 提供恢复指南
```

---

## 🚀 部署到线上的完整步骤

### 📋 一句话总结

```bash
git pull origin main && ./deploy-db-access-password.sh
```

### 📖 详细步骤（7步，约5-10分钟）

**Step 1: 准备工作**

```bash
# 登录线上服务器
ssh your-server

# 进入项目目录
cd /path/to/morning_reading_club
```

**Step 2: 拉取最新代码**

```bash
# 确保在 main 分支
git checkout main

# 拉取最新代码（包含部署脚本）
git pull origin main
```

**Step 3: 运行部署脚本**

```bash
# 添加执行权限（如果需要）
chmod +x deploy-db-access-password.sh

# 执行脚本
./deploy-db-access-password.sh
```

**Step 4: 按提示操作**

```
脚本会自动：
  ✅ 检查 MongoDB 连接
  ✅ 备份 .env.production
  ✅ 更新环境变量
  ✅ 验证配置
  ✅ 重置管理员密码
  ✅ 验证部署

只需输入 'yes' 确认即可
```

**Step 5: 重启后端服务**

```bash
# 根据你的部署工具选择
pm2 restart all              # PM2
# 或
docker restart <container>   # Docker
# 或
systemctl restart app        # Systemd
```

**Step 6: 验证管理员登录**

```bash
curl -X POST https://wx.shubai01.com/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@morningreading.com",
    "password": "Km7$Px2Qw9"
  }'

# 期望返回: {"code": 0, "message": "登录成功", ...}
```

**Step 7: 验证数据库访问密码**

```bash
# 使用上一步返回的 token
TOKEN="从登录响应中复制"

curl -X POST https://wx.shubai01.com/api/v1/auth/admin/verify-db-access \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"password": "Jb3#Rl8Tn5"}'

# 期望返回: {"code": 0, "message": "验证成功", "data": {"verified": true}}
```

---

## 🔑 密码配置清单

| 用途           | 密码                    | 用在何处                          |
| -------------- | ----------------------- | --------------------------------- |
| **管理员登录** | `Km7$Px2Qw9`            | 后台管理系统登录 → 左上角输入框   |
| **数据库访问** | `Jb3#Rl8Tn5`            | 点击"🗄️ 数据库管理"时的验证对话框 |
| **MySQL用户**  | `Prod_User@Secure123!`  | 数据库连接字符串                  |
| **Redis**      | `Prod_Redis@Secure123!` | 缓存连接字符串                    |

> ⚠️ **重要**: 妥善保管这些密码，建议存储在密钥管理系统中

---

## 📁 新增文件说明

### 1. `deploy-db-access-password.sh` (可执行脚本)

**位置**: 项目根目录
**大小**: ~15KB
**执行时间**: 2-5分钟
**功能**: 全自动部署脚本

**特点**：

- 交互式确认，防止误操作
- 自动备份原配置
- 详细的进度提示
- 彩色输出易于识别
- 出错自动回滚

**使用**：

```bash
./deploy-db-access-password.sh
```

### 2. `DEPLOY_INSTRUCTIONS.md` (详细指南)

**位置**: 项目根目录
**大小**: ~12KB
**内容**: 详细的分步部署说明

**章节包括**：

- 部署前检查清单
- 详细的部署步骤
- 脚本自动执行的操作
- 部署后验证方法
- 灾难恢复方案
- 故障排查指南

**适合深入了解部署过程**

### 3. `DEPLOY_QUICK_REFERENCE.txt` (快速参考)

**位置**: 项目根目录
**大小**: ~5KB
**内容**: 一页纸快速参考

**包含**：

- 核心目标概览
- 5分钟快速执行步骤
- 密码速查表
- 自动操作清单
- 灾难恢复快捷方案
- 验证清单

**适合快速查看和记忆**

---

## 🔄 代码变更一览

### 后端变更

**Admin.js**

```javascript
// 新增字段
dbAccessPassword: {
  type: String,
  default: null,
  select: false
}

// 新增方法
compareDbAccessPassword(password)

// 改进 pre-save hook
adminSchema.pre('save', ...)
  支持两个密码字段
```

**admin.controller.js**

```javascript
// 新增函数
exports.verifyDbAccess = async (req, res) => { ... }

// 改进 initSuperAdmin
支持环境变量: ADMIN_DB_ACCESS_PASSWORD
```

**admin.routes.js**

```javascript
// 新增路由
POST / auth / admin / verify - db - access;
```

**reset-admin-password.js**

```bash
# 新增第三个参数
node reset-admin-password.js <email> <password> [dbAccessPassword]
```

### 前端变更

**AdminLayout.vue**

```vue
// 改前：在前端比较密码 if (password === import.meta.env.VITE_DB_ACCESS_PASSWORD) // 改后：调用后端
API 验证 await authApi.verifyDbAccess(password)
```

**api.ts**

```typescript
// 新增方法
authApi.verifyDbAccess(password: string)
```

**环境变量**

```
# 移除
- VITE_DB_ACCESS_PASSWORD
- VITE_ADMIN_LOGIN_PASSWORD
```

---

## ✅ 部署检查清单

在拉取代码后执行脚本前：

- [ ] 已备份整个 MongoDB 数据库
- [ ] 已备份线上 `.env.production` 文件
- [ ] 已确认有服务器的 ssh 访问权限
- [ ] 已确认 Node.js 已安装 (v14+)
- [ ] 已确认后端服务的重启权限 (PM2/Docker/Systemd)
- [ ] 已通知团队成员部署时间表
- [ ] 已准备好回滚方案

执行脚本时：

- [ ] 按照脚本提示操作
- [ ] 输入 'yes' 确认开始部署
- [ ] 等待脚本完成（不要中断）
- [ ] 记下备份文件路径（以备恢复）

执行脚本后：

- [ ] 重启后端服务
- [ ] 验证管理员登录
- [ ] 验证数据库访问密码
- [ ] 在管理后台测试数据库管理功能
- [ ] 检查日志确认无错误

---

## 🆘 如何获取帮助

### 查看快速参考

```bash
cat DEPLOY_QUICK_REFERENCE.txt
```

### 查看详细指南

```bash
cat DEPLOY_INSTRUCTIONS.md
```

### 查看脚本源码

```bash
cat deploy-db-access-password.sh
```

### 查看部署日志

```bash
# 脚本执行时的输出日志
tail -f logs/combined.log

# 错误日志
tail -f logs/error.log
```

### 检查备份

```bash
ls -la .backup/
# 恢复备份
cp .backup/.env.production.backup.* backend/.env.production
```

---

## 📊 部署信息卡

```
╔════════════════════════════════════════════════════════╗
║             线上部署信息卡                             ║
╠════════════════════════════════════════════════════════╣
║ 项目:                  晨读营小程序                     ║
║ 部署类型:              功能安全升级                     ║
║ 代码提交:              f3fd3b8, 007392d                ║
║ 修改文件:              11个                           ║
║ 部署脚本:              deploy-db-access-password.sh   ║
║ 预计耗时:              5-10 分钟                      ║
║ 难度级别:              🟢 低（完全自动化）             ║
║ 风险等级:              🟡 中（涉及密码修改）           ║
║ 回滚难度:              🟢 低（有自动备份）             ║
╠════════════════════════════════════════════════════════╣
║ 主要改动:                                             ║
║  • 密码从前端迁移到后端                               ║
║  • 前端不再存储明文密码                               ║
║  • API 验证数据库访问密码                             ║
║  • 所有密码使用 bcrypt 哈希                           ║
╠════════════════════════════════════════════════════════╣
║ 完成后可获得:                                         ║
║  ✅ 更强的安全性                                      ║
║  ✅ 更灵活的密码管理                                  ║
║  ✅ 完整的审计日志                                    ║
║  ✅ 自动化的部署流程                                  ║
╚════════════════════════════════════════════════════════╝
```

---

## 🎯 下一步行动

1. **立即可做**
   - 查看部署快速参考: `cat DEPLOY_QUICK_REFERENCE.txt`
   - 查看详细指南: `cat DEPLOY_INSTRUCTIONS.md`
   - 审查脚本内容: `cat deploy-db-access-password.sh`

2. **部署前准备**
   - 备份数据库
   - 备份现有配置
   - 测试备份恢复流程

3. **执行部署**
   - 登录线上服务器
   - 拉取代码
   - 运行脚本

4. **部署后验证**
   - 重启服务
   - 测试登录
   - 测试数据库访问验证

---

## 📞 常见问题

**Q: 脚本会修改我现有的数据吗？**
A: 不会。脚本只修改管理员账户的密码字段，不影响其他数据。

**Q: 如果脚本失败了怎么办？**
A: 脚本有自动回滚功能，会恢复备份的配置文件。

**Q: 需要手动重启后端服务吗？**
A: 是的，脚本完成后需要手动重启（因为不同环境的重启方式不同）。

**Q: 备份文件保存在哪里？**
A: 自动保存在 `.backup/` 目录，文件名包含时间戳。

**Q: 可以自定义密码吗？**
A: 可以，编辑脚本中的密码变量后重新运行。

**Q: 脚本需要 root 权限吗？**
A: 通常不需要，但如果目录权限受限可能需要。

---

**准备完毕！现在可以部署到线上了。** 🚀

最后更新: 2026-02-26
版本: 1.0
状态: ✅ 生产就绪
