# 统一配置策略 - 三层配置体系

## 现状问题

| 问题 | 影响 |
|------|------|
| `.env.production` 从不被加载 | 生产配置实际未被使用 |
| `backend/.env` 硬编码 `NODE_ENV=development` | 覆盖了 `.env.config.js` 的环境选择 |
| 配置文件散落在两处 | 维护困难，易出错 |
| 部署脚本不清楚用哪个文件 | 部署流程不明确 |

## ✅ 推荐方案：三层配置体系

### 层级 1：`.env.config.js` (项目根，`currentEnv` 选择器)

**职责**：选择当前使用的环境（dev 或 prod），控制全局行为

**内容**：
```javascript
const currentEnv = 'dev'; // 'dev' | 'prod'

const envConfig = {
  dev: {
    backend: {
      mongodbUri: 'mongodb://admin:admin123@localhost:27017/morning_reading_db?authSource=admin',
      nodeEnv: 'development',
      port: 3000,
    },
    miniprogram: { apiBaseUrl: 'http://localhost:3000/api/v1', ... },
    admin: { apiBaseUrl: 'http://localhost:3000/api/v1', ... },
  },
  prod: {
    backend: {
      mongodbUri: 'mongodb://mongodb:cephaEsLMPkNAemf@127.0.0.1:27017/morning_reading?authSource=admin',
      nodeEnv: 'production',
      port: 3000,
    },
    miniprogram: { apiBaseUrl: 'https://wx.shubai01.com/api/v1', ... },
    admin: { apiBaseUrl: 'https://wx.shubai01.com/api/v1', ... },
  },
};
```

**部署时**：修改 `currentEnv` 值（或通过环境变量覆盖）

### 层级 2：`backend/.env` (后端配置，单一文件)

**职责**：提供所有后端运行时需要的秘密信息和敏感配置

**内容**（保留开发环境默认值）：

```ini
# ===== 不要在此处定义 NODE_ENV 和 MONGODB_URI =====
# 这两个值由 .env.config.js 通过 backend/src/server.js 提供

# JWT 密钥（开发用默认值）
JWT_SECRET=dev-secret-key-12345678
JWT_REFRESH_SECRET=dev-refresh-secret-key-87654321
JWT_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=30d

# MySQL 配置（开发环境默认）
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=morning_user
MYSQL_PASSWORD=morning123
MYSQL_DATABASE=morning_reading

# Redis 配置（开发环境默认）
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=26379
REDIS_PASSWORD=
REDIS_DB=0

# 微信配置（开发用 Mock）
WECHAT_APPID=wx199d6d332344ed0a
WECHAT_SECRET=mock-secret-for-local-dev

# 日志级别
LOG_LEVEL=debug

# API 基础 URL（用于某些内部调用）
API_BASE_URL=http://localhost:3000

# Admin 管理员密码（仅开发环境）
ADMIN_DEFAULT_PASSWORD=admin123456
ADMIN_DB_ACCESS_PASSWORD=admin123456
```

**部署时**：服务器使用不同的密钥值覆盖这些变量（见下文）

### 层级 3：环境变量覆盖 (部署时在服务器上设置)

**职责**：在生产环境中覆盖敏感信息

**方式**：
- **本地部署脚本生成** `backend/.env` 文件上传到服务器（包含生产密钥）
- **或** 服务器上手动设置环境变量

**生产环境需要覆盖的值**：

```bash
# 在服务器上执行 deploy 脚本前，确保以下环境变量正确
# 或者让 deploy 脚本自动生成 .env 文件

JWT_SECRET=<生产环境强随机密钥>
JWT_REFRESH_SECRET=<生产环境强随机密钥>
MYSQL_HOST=localhost
MYSQL_PORT=13306
MYSQL_USER=root
MYSQL_PASSWORD=<生产MySQL密码>
REDIS_HOST=localhost
REDIS_PORT=26379
REDIS_PASSWORD=<生产Redis密码>
WECHAT_APPID=wx2b9a3c1d5e4195f8
WECHAT_SECRET=<微信SECRET>
LOG_LEVEL=info
API_BASE_URL=https://wx.shubai01.com
```

## 配置加载顺序

```
1. backend/src/server.js 启动
   ↓
2. 尝试加载 .env.config.js
   - 设置 NODE_ENV = envConfig.config.backend.nodeEnv
   - 设置 MONGODB_URI = envConfig.config.backend.mongodbUri
   ↓
3. 加载 backend/.env.local（如果存在，用于本地开发覆盖）
   ↓
4. 加载 backend/.env（默认值 + 开发秘密）
   ↓
5. 环境变量（如果通过 export 或 pm2 设置，会覆盖上面的值）
   ↓
6. 使用 config-validator.js 验证所有必需变量已设置
```

## 🚀 执行步骤

### 步骤 1：删除冗余的 `.env.production`

```bash
# 将其内容备份，然后删除
rm backend/.env.production
```

**为什么删除**：
- 它从不被自动加载（dotenv 只加载 `.env`）
- 生产环境的配置现在通过层级1和层级2维护
- 如果需要恢复，可以从 git 历史中取回

### 步骤 2：修改 `backend/.env` - 移除 NODE_ENV 硬编码

**改动**：

```bash
# ❌ 删除这一行（让 .env.config.js 决定）
# NODE_ENV=development

# ✅ 如果本地开发需要强制指定，改为注释状态
# NODE_ENV=development  # 由 .env.config.js 决定
```

**原因**：
- `.env` 中的 `NODE_ENV=development` 会覆盖 `.env.config.js` 的设置
- 我们希望 `.env.config.js` 是决策者
- 如果本地需要强制 development，可以在 `.env.local` 中设置

### 步骤 3：验证部署脚本 (已完成)

前次会话已修改：
```bash
✅ 添加了 scripts/ 目录复制
✅ 修改了 tar 命令排除 .env.production
✅ 添加了 .env.config.js 复制
```

### 步骤 4：生产环境部署检查清单

部署时确保：

- [ ] 本地 `.env.config.js` 的 `currentEnv = 'prod'`
- [ ] 本地 `backend/.env` 包含所有必需变量（或部署脚本生成）
- [ ] `.env.config.js` 被复制到服务器 `/var/www/morning-reading/.env.config.js`
- [ ] `backend/.env` 被复制到服务器 `/var/www/morning-reading/backend/.env`
- [ ] 服务器 `.env` 包含正确的数据库密码和 JWT 密钥
- [ ] PM2 环境变量 (如使用 ecosystem.config.js) 不与 .env 冲突

## 📝 敏感信息管理

### ✅ 安全做法

1. `.env.config.js` - 非敏感信息，**可以提交到 git**
2. `backend/.env` - **绝对不要提交**，使用 `.gitignore` 排除
3. 生产服务器上的敏感信息 - 使用密钥管理系统或加密存储

### 生产部署流程

```bash
# 本地（明确 prod 环境）
cp backend/.env.production backend/.env  # 或由部署脚本生成
sed -i 's/CHANGE_THIS_/actual_value/g' backend/.env  # 替换敏感值

# 执行部署脚本（会打包并上传）
bash scripts/deploy-to-server.sh

# 服务器上（确保 .env.config.js 和 backend/.env 都已上传）
pm2 restart morning-reading-backend
pm2 logs morning-reading-backend  # 验证启动
```

## 总结对比

| 项目 | 旧方案（混乱） | 新方案（统一） |
|------|---|---|
| 环境选择 | 修改 NODE_ENV 在多个地方 | 只修改 `.env.config.js` 的 currentEnv |
| 生产配置来源 | `.env.production`（不被加载！） | 通过 `.env.config.js` + `backend/.env` 覆盖 |
| 配置优先级 | 不清楚 | 清晰的三层体系 |
| 部署脚本 | 不清楚该复制什么 | 清晰：复制 .env.config.js 和 backend/.env |
| 敏感信息 | 分散在两个文件 | 统一在 backend/.env，通过 gitignore 保护 |

---

**状态**：✅ 方案已制定，待执行
