# 统一环境配置指南

## 概述

项目使用根目录下的 `.env.config.js` 文件作为环境配置的真实信息源，同时控制：

1. **后端**：Node.js 服务器连接的数据库和运行环境
2. **小程序**：微信小程序调用的 API 端点
3. **管理后台**：Vue 管理后台连接的服务

## 快速开始

### 修改环境配置

由于微信小程序运行在沙箱环境，无法直接加载 Node.js 模块，因此需要同时修改两个配置文件：

#### ① 后端配置（`.env.config.js`）

打开根目录的 `.env.config.js` 文件，修改第 **17** 行：

```javascript
const currentEnv = 'dev'; // 改为 'dev' 或 'prod'
```

#### ② 小程序配置（`miniprogram/config/env.js`）

打开 `miniprogram/config/env.js` 文件，修改第 **15** 行为**相同的值**：

```javascript
const currentEnv = 'dev'; // 改为 'dev' 或 'prod'，必须与 .env.config.js 一致
```

### 可用的环境值

| 值       | 说明     | 后端数据库   | 小程序 API                     | 管理后台  |
| -------- | -------- | ------------ | ------------------------------ | --------- |
| `'dev'`  | 开发环境 | 本地 MongoDB | http://localhost:3000/api/v1   | localhost |
| `'prod'` | 生产环境 | 生产 MongoDB | https://wx.shubai01.com/api/v1 | 线上服务  |

### 重启服务

修改配置后，需要重启所有服务才能生效：

```bash
# 停止现有服务
pkill -f "npm run dev"
pkill -f "npm start"

# 重启后端（自动从 .env.config.js 加载）
cd backend && npm run dev

# 重启小程序（在微信开发工具中）
# 按 Ctrl+Shift+Q 重启

# 重启管理后台（如需要）
cd admin && npm run dev
```

## 配置结构

### `.env.config.js` 文件结构

```javascript
{
  // 当前激活的环境名称
  currentEnv: 'dev',

  // 当前激活的环境配置
  config: {
    backend: {
      mongodbUri: '...',        // MongoDB 连接字符串
      nodeEnv: 'development',   // NODE_ENV 值
      port: 3000                // 后端服务端口
    },
    miniprogram: {
      apiBaseUrl: '...',        // 小程序调用的 API 基址
      wxAppId: '...',           // 微信小程序 AppID
      enableDebug: true,        // 是否启用调试
      enableLog: true           // 是否启用日志
    },
    admin: {
      apiBaseUrl: '...',        // 管理后台 API 基址
      enableDebug: true         // 是否启用调试
    }
  },

  // 所有可用环境配置
  envConfig: { dev: {...}, prod: {...} }
}
```

## 环境配置详解

### 开发环境 (dev)

```javascript
dev: {
  backend: {
    mongodbUri: 'mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin',
    nodeEnv: 'development',
    port: 3000,
  },
  miniprogram: {
    apiBaseUrl: 'http://localhost:3000/api/v1',
    wxAppId: 'wx199d6d332344ed0a',
    enableDebug: true,
    enableLog: true,
  },
  admin: {
    apiBaseUrl: 'http://localhost:3000/api/v1',
    enableDebug: true,
  },
}
```

**特点**：

- 本地 MongoDB（需运行 `docker-compose up -d`）
- 本地后端服务
- 完整的调试日志
- 开发者工具 AppID

### 生产环境 (prod)

```javascript
prod: {
  backend: {
    mongodbUri: 'mongodb://admin:admin123@db.example.com:27017/morning_reading_prod?authSource=admin',
    nodeEnv: 'production',
    port: 3000,
  },
  miniprogram: {
    apiBaseUrl: 'https://wx.shubai01.com/api/v1',
    wxAppId: 'wx2b9a3c1d5e4195f8',
    enableDebug: false,
    enableLog: false,
  },
  admin: {
    apiBaseUrl: 'https://wx.shubai01.com/api/v1',
    enableDebug: false,
  },
}
```

**特点**：

- 生产 MongoDB 实例
- 线上后端服务
- 禁用调试日志（提升性能）
- 生产 AppID

## 工作流程

### 修改配置时的流程

1. **修改后端配置** (`.env.config.js`)

   ```bash
   # 编辑根目录的 .env.config.js，修改第17行
   vim .env.config.js
   ```

2. **修改小程序配置** (同步)

   由于小程序运行在 WeChat 沙箱中，无法直接加载 Node.js 模块，需要同步修改：

   ```bash
   # 编辑小程序配置，修改第15行为相同的值
   vim miniprogram/config/env.js
   ```

3. **后端自动加载新配置**

   后端的 `backend/src/server.js` 会在启动时从 `.env.config.js` 加载配置：

   ```javascript
   // backend/src/server.js
   const envConfig = require(path.resolve(__dirname, '../../.env.config.js'));
   process.env.NODE_ENV = process.env.NODE_ENV || envConfig.config.backend.nodeEnv;
   process.env.MONGODB_URI = process.env.MONGODB_URI || envConfig.config.backend.mongodbUri;
   ```

4. **小程序手动加载新配置**

   小程序的 `miniprogram/config/env.js` 使用本地定义的 `currentEnv` 值：

   ```javascript
   // miniprogram/config/env.js
   const currentEnv = 'dev'; // 需要手动同步与 .env.config.js 一致
   const envConfig = { dev: {...}, prod: {...}, ... };
   module.exports = { ...envConfig[currentEnv] };
   ```

5. **重启服务生效**

   ```bash
   # 停止并重启后端
   pkill -f "npm run dev"
   cd backend && npm run dev

   # 重启小程序开发工具
   # 按 Ctrl+Shift+Q 重启
   ```

## 添加新的环境

如果需要添加测试环境（staging），在 `.env.config.js` 中：

```javascript
const currentEnv = 'staging'; // 新增行

const envConfig = {
  // ... 现有的 dev 和 prod

  // 新增 staging 环境
  staging: {
    backend: {
      mongodbUri:
        'mongodb://admin:password@staging-db.example.com:27017/morning_reading_staging?authSource=admin',
      nodeEnv: 'staging',
      port: 3000
    },
    miniprogram: {
      apiBaseUrl: 'https://staging-api.example.com/api/v1',
      wxAppId: 'wx_staging_app_id',
      enableDebug: true,
      enableLog: true
    },
    admin: {
      apiBaseUrl: 'https://staging-api.example.com/api/v1',
      enableDebug: true
    }
  }
};
```

## 常见问题

### Q: 修改后配置未生效

**A**: 确保已重启所有服务。修改 `.env.config.js` 后需要：

1. 停止后端：`pkill -f "npm run dev"`
2. 重启后端：`cd backend && npm run dev`
3. 重启小程序开发工具

### Q: 不同模块看到的配置不同

**A**: 这说明某些模块还在使用旧的本地配置文件。检查：

- 后端：是否还有本地 `.env` 文件？尝试删除或更新它
- 小程序：是否修改了 `miniprogram/config/env.js` 的代码？应该只修改 `.env.config.js`
- 管理后台：检查是否仍在使用硬编码的配置

### Q: 生产环境 MongoDB URI 需要更新

**A**: 编辑 `.env.config.js` 中 `prod.backend.mongodbUri` 字段，然后重启后端：

```javascript
prod: {
  backend: {
    mongodbUri: 'mongodb://admin:new_password@new_host:27017/morning_reading_prod?authSource=admin',
    // ...
  },
}
```

### Q: 我想要自定义环境

**A**: 在 `.env.config.js` 中的 `envConfig` 对象中添加新环境配置，然后将 `currentEnv` 改为新环境名即可。

## 后续改进

可能的改进方向：

1. **使用命令行工具切换环境**

   ```bash
   npm run env:set dev
   npm run env:set prod
   ```

2. **支持本地 `.env.config.local.js` 覆盖**
   - 本地开发可使用 `.env.config.local.js`
   - 不会被 Git 追踪

3. **配置验证**
   - 在启动时验证 MongoDB URI 是否正确
   - 验证 API 端点是否可达

4. **配置热加载**
   - 支持不重启服务更新配置（需要特殊实现）

## 相关文件

- **主配置文件**：`.env.config.js`
- **后端使用**：`backend/src/server.js`（第 10-15 行）
- **小程序使用**：`miniprogram/config/env.js`（第 12-14 行）
- **本指南**：`ENV_CONFIG_GUIDE.md`

## 技术细节

### 为什么不使用单一 .env 文件？

`.env` 文件适合存储敏感信息（密码、密钥），但：

- 不支持 JavaScript 对象结构
- 需要多个 `.env.dev`、`.env.prod` 文件
- 小程序无法直接读取 Node.js .env 文件

`.env.config.js` 的优势：

- ✅ 单一配置源（.env.config.js）
- ✅ 后端自动加载配置
- ✅ 小程序配置结构一致（需手动同步 currentEnv 值）
- ✅ 支持复杂的配置结构
- ✅ 易于版本控制（不包含敏感信息）
- ✅ 易于扩展新环境

**注意**：由于小程序运行在 WeChat 沙箱中，无法直接加载 Node.js 模块，因此小程序的 `currentEnv` 需要与后端手动保持同步。这是技术限制，而非设计缺陷。

### 加载顺序

后端的配置加载优先级：

1. `.env.config.js` （最高，统一配置）
2. 环境变量（可覆盖）
3. `.env` 文件（最低）

```javascript
// 如果 NODE_ENV 未设置，使用统一配置
process.env.NODE_ENV = process.env.NODE_ENV || envConfig.config.backend.nodeEnv;
```

## 总结

使用 `.env.config.js` 统一管理环境配置的好处：

| 方面         | 改进                           |
| ------------ | ------------------------------ |
| **易用性**   | 只需修改一个文件中的一个值     |
| **一致性**   | 前后端使用同一份配置           |
| **可维护性** | 清晰的配置结构，易于添加新环境 |
| **错误减少** | 减少手动同步配置导致的错误     |
| **灵活性**   | 支持多个环境，易于扩展         |

---

**最后更新**：2025-12-18
**维护者**：Claude Code
