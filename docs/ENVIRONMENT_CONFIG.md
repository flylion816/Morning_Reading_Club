# 环境配置系统指南

## 📋 概述

晨读营项目采用**三层配置系统**，确保所有环境（本地开发、Docker、生产服务器）的配置一致性和安全性。

```
顶层：.env.config.js（非敏感配置，可提交 Git）
  ↓ 生成
中层：.env.docker / .env.production（敏感配置，不提交 Git）
  ↓ 使用
底层：应用运行时（Docker 容器或 Node.js 进程）
```

---

## 🔑 三层配置文件

### 第一层：`.env.config.js` ✅ **提交到 Git**

**位置**：项目根目录

**用途**：统一配置数据库密码、端口、连接字符串等 —— 同时控制后端和管理后台的环境配置

**特点**：
- ✅ 包含完整的开发和生产配置
- ✅ 所有敏感信息（密码）的**唯一来源**
- ✅ 可以安全地提交到 Git（无实际秘密）
- ✅ 修改此文件可同时影响所有环境

**结构**：
```javascript
const currentEnv = 'dev';  // 'dev' | 'prod'

const envConfig = {
  dev: { ... },    // 开发环境配置
  prod: { ... }    // 生产环境配置
};
```

### 第二层：`.env.docker` / `.env.production` ❌ **不提交 Git**

**生成方式**：运行脚本自动从 `.env.config.js` 生成

```bash
# 生成 Docker 环境配置
node scripts/generate-env-production.js --docker

# 生成服务器环境配置
node scripts/generate-env-production.js --server
```

**两个文件的区别**：

| 文件 | 用途 | MongoDB 连接地址 | MySQL 端口 |
|------|------|-----------------|-----------|
| `.env.docker` | 本地 Docker Compose | `mongodb://mongodb:...`（Docker 服务名） | 3306 |
| `.env.production` | 生产服务器 | `127.0.0.1:...`（本地回环） | 13306 |

---

## 🚀 使用流程

### 场景 1：本地开发（使用 Docker）

1. **编辑配置**（如果需要）
   ```bash
   # 修改 .env.config.js 中的 dev 或 prod 配置
   vim .env.config.js
   ```

2. **生成 Docker 配置**
   ```bash
   node scripts/generate-env-production.js --docker
   ```

3. **启动 Docker 容器**
   ```bash
   docker-compose -f deploy/docker-compose.prod.yml \
     --env-file .env.docker up -d
   ```

### 场景 2：生产服务器部署

1. **本地生成配置**（部署脚本自动执行）
   ```bash
   node scripts/generate-env-production.js --server
   ```

2. **上传到服务器**（包含在 `deploy-to-server.sh` 中）
   ```bash
   scp backend/.env.production ubuntu@server:/var/www/morning-reading/backend/
   ```

3. **服务器启动应用**
   ```bash
   cd /var/www/morning-reading/backend
   npm install
   npm start
   ```

---

## 🔐 密码和凭证管理

### 密码来源

所有密码都定义在 `.env.config.js` 中，按环境分离：

```javascript
prod: {
  backend: {
    mongodbUri: 'mongodb://admin:ProdMongodbSecure123@...'
  },
  mysql: {
    password: 'L55PWzePtXYPNkn7'
  },
  redis: {
    password: 'Redis@Prod@User0816!'
  }
}
```

### 修改密码的方法

1. **编辑 `.env.config.js`**
   ```javascript
   prod: {
     mysql: {
       password: 'NEW_PASSWORD_HERE'  // ← 改这里
     }
   }
   ```

2. **重新生成环境文件**
   ```bash
   node scripts/generate-env-production.js --server
   ```

3. **推送到服务器**
   ```bash
   scp backend/.env.production ubuntu@server:/var/www/morning-reading/backend/
   ```

4. **重启应用**
   ```bash
   ssh ubuntu@server "pm2 restart morning-reading-backend"
   ```

---

## ✅ 验证配置

### 本地验证

```bash
# 检查生成的 .env.docker 中的 MongoDB 密码
grep MONGO_PASSWORD .env.docker
# 应该输出: MONGO_PASSWORD=ProdMongodbSecure123

# 检查 MySQL 连接信息
grep MYSQL .env.docker | head -3
```

### 服务器验证

```bash
ssh ubuntu@server

# 检查 MongoDB 连接
mongosh "mongodb://admin:PASSWORD@localhost:27017" --eval "db.runCommand({ping:1})"

# 检查 MySQL 连接
mysql -u root -p -e "SELECT 1"

# 检查 Redis 连接
redis-cli -a PASSWORD ping
```

---

## 🐛 常见问题

### Q: 为什么生成的 MongoDB 连接字符串中密码不包含特殊字符？

**A**: 某些特殊字符（如 `@`, `:`, `?`）在 URI 中需要 URL 编码。为了简化，我们在 `.env.config.js` 中设置密码为 `ProdMongodbSecure123`（不含特殊字符）。

### Q: 修改 `.env.config.js` 后需要重新生成文件吗？

**A**: 是的。`.env.docker` 和 `.env.production` 是自动生成的，每次修改 `.env.config.js` 后都需要重新运行生成脚本。

### Q: 为什么有两个不同的 MongoDB 连接地址？

**A**:
- **`.env.docker`** 中：`mongodb://mongodb:...` —— Docker 容器之间通过服务名通信
- **`.env.production`** 中：`mongodb://127.0.0.1:...` —— 服务器上直接连接本地数据库

### Q: 能否直接编辑 `.env.production` 而不修改 `.env.config.js`？

**A**: 不建议。这样做会导致配置不一致，下次生成时被覆盖。始终通过修改 `.env.config.js` 来更新配置。

---

## 📚 相关文件

| 文件 | 说明 |
|------|------|
| `.env.config.js` | 统一配置源（非敏感） |
| `scripts/generate-env-production.js` | 生成脚本 |
| `deploy/docker-compose.prod.yml` | Docker 编排文件 |
| `.gitignore` | Git 忽略配置（包含 `.env.docker` 等） |

---

## 🔄 配置流向图

```
┌─ .env.config.js (dev 配置)
│
├─ dev:
│   ├─ mongodb://admin:DevMongodbLocal123@localhost:27017
│   ├─ mysql:3306, password: morning123
│   └─ redis:6379, password: ''
│
└─ .env.config.js (prod 配置)
   ├─ mongodb://admin:ProdMongodbSecure123@127.0.0.1:27017
   ├─ mysql:13306, password: L55PWzePtXYPNkn7
   └─ redis:26379, password: Redis@Prod@User0816!
        ↓
        node scripts/generate-env-production.js
        ↓
     ┌──────────────────────────────────────┐
     │                                      │
  .env.docker                        .env.production
     │                                      │
     ├─ MONGO_PASSWORD=ProdMongodbSecure123 │
     ├─ MONGODB_URI=                        │
     │  mongodb://mongodb:...               │
     │  (Docker 服务名)                     │
     └─ MYSQL_PORT=3306                     ├─ MONGO_PASSWORD=ProdMongodbSecure123
                                            ├─ MONGODB_URI=
                                            │  mongodb://127.0.0.1:...
                                            │  (本地回环)
                                            └─ MYSQL_PORT=13306
                                                 ↓
                                            /var/www/morning-reading/backend/
                                            npm start
```
