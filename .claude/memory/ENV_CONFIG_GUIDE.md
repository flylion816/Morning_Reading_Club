# 晨读营项目 - 环境配置完整指南

## 🎯 核心原则

整个项目有 **3 个独立的配置系统**，分别控制不同的模块：

```
┌─────────────────────────────────────────────┐
│  项目级总控配置: .env.config.js             │
│  (影响：后端 + 管理后台)                     │
└────────────┬────────────────────────────────┘
             │
   ┌─────────┼─────────┐
   │         │         │
   ▼         ▼         ▼
┌──────┐ ┌──────┐ ┌──────────┐
│后端  │ │数据库│ │管理后台  │
│服务  │ │配置  │ │配置      │
└──────┘ └──────┘ └──────────┘

┌─────────────────────────────────────┐
│  小程序独立配置: miniprogram/config/env.js
│  (只影响：小程序开发工具)
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  后端敏感信息: backend/.env.production
│  (补充细节配置，如JWT密钥等)
└─────────────────────────────────────┘
```

---

## 📋 三个配置文件详细说明

### 1️⃣ 根目录：`.env.config.js`

**作用：**

- 控制 **后端** 和 **管理后台** 的环境
- 一个开关控制整个后端系统

**位置：** `/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/.env.config.js`

**关键配置：**

```javascript
const currentEnv = 'prod'; // ← 改这一行就改了所有后端配置
```

**当前配置详情：**

| 配置项           | 开发环境 (dev)               | 生产环境 (prod)                |
| ---------------- | ---------------------------- | ------------------------------ |
| **后端 MongoDB** | localhost:27017              | 127.0.0.1:27017                |
| **MongoDB 用户** | admin                        | admin                          |
| **MongoDB 密码** | admin123                     | p62CWhV0Kd1Unq                 |
| **数据库名**     | morning_reading_db           | morning_reading                |
| **Node.js 环境** | development                  | production                     |
| **服务端口**     | 3000                         | 3000                           |
| **管理后台 API** | http://localhost:3000/api/v1 | https://wx.shubai01.com/api/v1 |

**修改步骤：**

```bash
# 1. 打开文件
vim .env.config.js

# 2. 修改第 17 行
const currentEnv = 'dev';   # 改成 dev（连接本地数据库）
或
const currentEnv = 'prod';  # 改成 prod（连接线上数据库）

# 3. 保存文件

# 4. 重启后端服务
npm run dev  # 后端会自动加载新配置
```

---

### 2️⃣ 小程序配置：`miniprogram/config/env.js`

**作用：**

- 控制 **小程序开发工具** 连接哪个 API 服务器
- **完全独立**，不受 `.env.config.js` 影响

**位置：** `/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/miniprogram/config/env.js`

**关键配置：**

```javascript
const currentEnv = 'prod'; // ← 改这一行就改了小程序连接的服务器
```

**当前配置详情：**

| 配置项         | dev                          | test                           | prod                           |
| -------------- | ---------------------------- | ------------------------------ | ------------------------------ |
| **API 地址**   | http://localhost:3000/api/v1 | https://wx.shubai01.com/api/v1 | https://wx.shubai01.com/api/v1 |
| **微信 AppID** | wx199d6d332344ed0a           | wx199d6d332344ed0a             | wx2b9a3c1d5e4195f8             |
| **调试模式**   | true                         | true                           | false                          |
| **日志输出**   | true                         | true                           | true                           |

**修改步骤：**

```bash
# 1. 打开文件
vim miniprogram/config/env.js

# 2. 修改第 17 行
const currentEnv = 'dev';   # 连接本地后端 (localhost:3000)
或
const currentEnv = 'prod';  # 连接线上后端 (wx.shubai01.com)

# 3. 保存文件

# 4. 重启微信开发者工具（使新配置生效）
```

---

### 3️⃣ 后端敏感信息：`backend/.env.production`

**作用：**

- 补充后端的敏感信息（JWT密钥、微信Secret等）
- `.env.config.js` 定义了总体架构，这个文件定义了具体的密钥

**位置：** `/Users/pica_1/我的坚果云/flylion/AI项目开发/七个习惯晨读营/backend/.env.production`

**重要配置：**

```bash
NODE_ENV=production                  # ← 必须是 production
PORT=3000
API_BASE_URL=https://wx.shubai01.com

# 数据库
MONGODB_URI=mongodb://admin:p62CWhV0Kd1Unq@127.0.0.1:27017/morning_reading?authSource=admin

# JWT 密钥
JWT_SECRET=0f405b99aefbbb7e304e0a82b2ca9db14d0cb4ed02fdecbb57192e6c330a0a06
JWT_REFRESH_SECRET=8ffd042c189499bf2c4af4fcb89d983d6b65ee050ca6e99a5a387d0443eed52c

# 微信配置
WECHAT_APPID=wx2b9a3c1d5e4195f8
WECHAT_SECRET=36b3d2538c006e63971ba4a83905eb8b

# 日志
LOG_LEVEL=info
```

**⚠️ 重要提示：**

- ❌ 不要提交到 Git（已在 .gitignore 中）
- ❌ 不要修改 JWT_SECRET（除非你知道后果）
- ✅ 定期检查和更新 WECHAT_SECRET

---

## 🎬 常见场景配置

### 场景 1️⃣：本地完整开发（连接本地数据库）

**目标：** 在本地快速开发，完全不依赖线上环境

```bash
# 1. 修改 .env.config.js
const currentEnv = 'dev';

# 2. 修改 miniprogram/config/env.js
const currentEnv = 'dev';

# 3. 启动后端
npm run dev

# 4. 启动小程序开发工具
# 打开微信开发者工具，小程序会连接 localhost:3000
```

**验证：**

```
后端日志：[MongoDB] Connected to mongodb://localhost:27017
小程序日志：[ENV DEBUG] apiBaseUrl: http://localhost:3000/api/v1
```

---

### 场景 2️⃣：测试线上环境（在开发工具中测试线上）

**目标：** 用开发工具直接测试线上的所有功能

```bash
# 1. 修改 miniprogram/config/env.js
const currentEnv = 'prod';

# 2. 保持 .env.config.js 不变（或也改为 prod）

# 3. 重启微信开发者工具

# 4. 在 Network 标签中查看请求
# 应该看到：https://wx.shubai01.com/api/v1/auth/...
```

**验证：**

```
小程序日志：[ENV DEBUG] apiBaseUrl: https://wx.shubai01.com/api/v1
Network 标签：请求 URL 以 https://wx.shubai01.com 开头
```

---

### 场景 3️⃣：混合模式（小程序用线上，后端用本地数据库）

**目标：** 小程序用线上服务器，但后端连接本地数据库做测试

```bash
# 1. 修改 .env.config.js
const currentEnv = 'dev';

# 2. 修改 miniprogram/config/env.js
const currentEnv = 'prod';

# 3. 启动后端
npm run dev
# 后端连接 localhost:27017（本地 MongoDB）

# 4. 小程序连接 https://wx.shubai01.com
# 但那边的后端会使用本地数据库的数据
```

⚠️ **注意：** 这种配置很奇怪，一般不用。

---

## 🔄 环境变化流程图

```
修改 .env.config.js 中的 currentEnv
           │
           ▼
    重启后端服务 (npm run dev)
           │
           ├─→ 后端重新加载配置
           │   ├─→ 连接相应的 MongoDB
           │   └─→ 设置相应的 API_BASE_URL
           │
           └─→ 管理后台自动使用新配置
               (访问 http://localhost:5173)


修改 miniprogram/config/env.js 中的 currentEnv
           │
           ▼
    重启微信开发者工具
           │
           └─→ 小程序连接新的 API 地址
               ├─→ Network 标签显示新的请求 URL
               └─→ 控制台显示新的 apiBaseUrl
```

---

## 📊 当前项目实际配置（2026-02-27）

### 根目录 `.env.config.js`

```
currentEnv = 'prod'
后端连接：线上 MongoDB (127.0.0.1:27017)
管理后台：https://wx.shubai01.com/api/v1
```

### 小程序 `miniprogram/config/env.js`

```
currentEnv = 'prod'
小程序连接：https://wx.shubai01.com/api/v1
```

### 后端 `backend/.env.production`

```
NODE_ENV=production
MONGODB_URI=线上地址
JWT_SECRET=已配置
WECHAT_APPID=wx2b9a3c1d5e4195f8
```

**结论：** ✅ 所有系统都连接线上环境

---

## 🛠️ 快速切换命令

```bash
# 本地开发模式（所有连接 localhost）
echo "const currentEnv = 'dev';" > .env.config.js
echo "const currentEnv = 'dev';" > miniprogram/config/env.js
npm run dev

# 线上测试模式（所有连接线上）
echo "const currentEnv = 'prod';" > .env.config.js
echo "const currentEnv = 'prod';" > miniprogram/config/env.js
# 重启微信开发者工具

# 混合模式（小程序线上，后端本地）
echo "const currentEnv = 'dev';" > .env.config.js
echo "const currentEnv = 'prod';" > miniprogram/config/env.js
npm run dev
# 重启微信开发者工具
```

---

## ⚠️ 常见错误

### ❌ 错误 1：修改了 `.env.config.js` 但小程序还是连接旧地址

**原因：** 小程序有独立的配置，两个文件要分别修改

**解决：**

```bash
# 修改两个地方
1. .env.config.js 的 currentEnv
2. miniprogram/config/env.js 的 currentEnv
3. 都重启相应的服务
```

### ❌ 错误 2：修改了配置但没生效

**原因：** 没有重启服务，还在使用旧的配置

**解决：**

```bash
# 后端改配置后，重启：
npm run dev

# 小程序改配置后，重启：
微信开发者工具 → 重新编译或关闭重开
```

### ❌ 错误 3：不知道现在连接的是哪个环境

**原因：** 没查看日志输出

**解决：** 看这些日志

**后端：**

```bash
npm run dev
# 查看：[MongoDB] Connected to mongodb://... (看域名或 localhost)
```

**小程序：**

```
控制台输出：
[ENV DEBUG] currentEnv: dev/prod
[ENV DEBUG] apiBaseUrl: http://localhost:3000 或 https://wx.shubai01.com
```

---

## 📚 配置文件权限

| 文件                        | Git提交   | 敏感信息 | 修改频率    |
| --------------------------- | --------- | -------- | ----------- |
| `.env.config.js`            | ✅ 提交   | ❌ 无    | ⭐⭐ 经常   |
| `miniprogram/config/env.js` | ✅ 提交   | ❌ 无    | ⭐ 很少     |
| `backend/.env.production`   | ❌ 不提交 | ✅ 有    | ⭐ 很少     |
| `backend/.env.development`  | ✅ 提交   | ❌ 无    | ⭐⭐⭐ 常改 |

---

## 🎓 总结速记

```
记住这三点就够了：

1️⃣  .env.config.js 的 currentEnv
     控制：后端 + 管理后台的环境

2️⃣  miniprogram/config/env.js 的 currentEnv
     控制：小程序开发工具的环境
     （完全独立，互不影响）

3️⃣  backend/.env.production
     补充：JWT、微信密钥等敏感信息
     （一般不改）

修改任何配置后，都要重启对应的服务！
```

---

**最后更新：** 2026-02-27
**维护者：** Claude Code
**适用版本：** v1.0+
