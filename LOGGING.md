# 晨读营项目 - 日志系统使用指南

## 📋 概览

本项目使用 **Winston 3.x** 作为生产级日志系统，提供完整的日志记录、旋转、分类等功能。

### 主要特性

- ✅ **多级别日志**：error, warn, info, debug
- ✅ **多传输方式**：console, file, errors
- ✅ **日志旋转**：按文件大小自动轮转
- ✅ **环境适配**：开发/生产自动配置
- ✅ **异常处理**：捕获未处理的异常和Promise拒绝
- ✅ **性能友好**：异步写入，不阻塞主线程

---

## 🚀 快速开始

### 导入日志系统

```javascript
const logger = require('./utils/logger');

// 记录信息
logger.info('应用启动成功');

// 记录警告
logger.warn('内存使用过高', { memUsage: '512MB' });

// 记录错误
logger.error('数据库连接失败', error, { retryCount: 3 });

// 记录调试信息
logger.debug('执行SQL查询', { query: 'SELECT * FROM users' });
```

---

## 📁 日志文件位置

所有日志文件都保存在 `./logs/` 目录下：

```
logs/
├── combined.log          # 所有日志（info及以上）
├── error.log             # 仅错误日志
├── warn.log              # 仅警告日志
├── debug.log             # 调试日志（开发环境）
├── exceptions.log        # 未捕获异常
├── rejections.log        # Promise拒绝
└── out.log / pm2.log     # 应用输出日志
```

### 日志轮转策略

| 文件 | 最大大小 | 保留天数 |
|------|--------|--------|
| combined.log | 10MB | 14天 |
| error.log | 10MB | 30天 |
| warn.log | 5MB | 7天 |
| debug.log | 5MB | 3天（仅开发环境）|
| exceptions.log | 5MB | 30天 |
| rejections.log | 5MB | 30天 |

---

## 📝 常见用法

### 1. 基础日志记录

```javascript
const logger = require('./utils/logger');

// 简单信息日志
logger.info('用户登录成功');

// 带上下文的日志
logger.info('用户登录成功', {
  userId: '123456',
  email: 'user@example.com',
  loginTime: new Date(),
  ipAddress: '192.168.1.1',
});
```

### 2. 错误日志记录

```javascript
// 记录错误对象和额外信息
try {
  await database.connect();
} catch (error) {
  logger.error('数据库连接失败', error, {
    host: 'localhost',
    port: 27017,
    retryCount: 3,
  });
}

// 记录仅包含消息的错误
logger.error('用户不存在', { userId: '999' });
```

### 3. HTTP请求日志

```javascript
const startTime = Date.now();

// 处理请求...

const duration = Date.now() - startTime;
logger.http('GET', '/api/v1/users', 200, duration, userId);
// 输出：[时间] info: HTTP GET /api/v1/users 200 { method: 'GET', statusCode: 200, duration: '45ms', userId: '123' }
```

### 4. 数据库操作日志

```javascript
const startTime = Date.now();

try {
  const result = await User.find({ status: 'active' });
  const duration = Date.now() - startTime;
  logger.database('SELECT', 'users', duration, true, {
    condition: 'status = "active"',
    resultCount: result.length,
  });
} catch (error) {
  logger.database('SELECT', 'users', Date.now() - startTime, false, {
    error: error.message,
  });
}
```

### 5. 认证事件日志

```javascript
// 用户登录
logger.auth('LOGIN_SUCCESS', userId, {
  method: 'wechat',
  ipAddress: '192.168.1.1',
});

// 用户登出
logger.auth('LOGOUT', userId, {
  sessionDuration: '2h30m',
});

// 认证失败
logger.auth('AUTH_FAILED', null, {
  reason: 'Invalid credentials',
  attemptCount: 5,
});
```

### 6. 业务事件日志

```javascript
// 用户创建
logger.event('USER_CREATED', '新用户注册', {
  userId: '123456',
  email: 'newuser@example.com',
  source: 'wechat',
});

// 订单下单
logger.event('ORDER_PLACED', '用户下单', {
  orderId: 'ORD-20251204-001',
  userId: '123456',
  totalAmount: 99.99,
  itemCount: 3,
});

// 数据同步
logger.event('DATA_SYNC', '小凡看见数据同步', {
  source: 'external_api',
  recordCount: 150,
  duration: '2.5s',
  status: 'success',
});
```

---

## 🔧 配置说明

### 日志级别

日志级别从低到高：`debug` → `info` → `warn` → `error`

```javascript
// 环境变量控制日志级别
process.env.LOG_LEVEL = 'debug'   // 最详细
process.env.LOG_LEVEL = 'info'    // 默认（生产环境）
process.env.LOG_LEVEL = 'warn'    // 仅警告和错误
process.env.LOG_LEVEL = 'error'   // 仅错误
```

### 环境特定配置

#### 开发环境
```
NODE_ENV=development
LOG_LEVEL=debug（默认）
- 输出到控制台（彩色格式）
- 输出到 combined.log
- 输出到 debug.log
- 记录内存信息
```

#### 生产环境
```
NODE_ENV=production
LOG_LEVEL=info（默认）
- 输出到控制台（简洁格式）
- 输出到 combined.log
- 输出到 error.log
- 输出到 warn.log
- 记录进程ID和内存信息
```

---

## 📊 日志输出示例

### 控制台输出（开发环境）
```
[2025-12-04 14:30:45] info: 应用启动配置 { environment: 'development', port: 3000, nodeVersion: 'v20.10.0', pid: 12345 }
[2025-12-04 14:30:46] info: 正在连接 MongoDB...
[2025-12-04 14:30:48] info: ✅ MongoDB 连接成功
[2025-12-04 14:30:49] info: 服务器已启动 { url: 'http://localhost:3000', apiBaseUrl: 'http://localhost:3000/api/v1', environment: 'development' }
[2025-12-04 14:30:50] info: HTTP GET /api/v1/health 200 { method: 'GET', statusCode: 200, duration: '5ms' }
```

### 文件输出（生产环境，combined.log）
```json
{"timestamp":"2025-12-04 14:30:45 +08:00","level":"info","message":"应用启动配置","environment":"production","port":3000,"nodeVersion":"v20.10.0","pid":12345,"memory":{"heapUsed":"145MB","heapTotal":"512MB"}}
{"timestamp":"2025-12-04 14:30:46 +08:00","level":"info","message":"正在连接 MongoDB...","pid":12345}
{"timestamp":"2025-12-04 14:30:48 +08:00","level":"info","message":"✅ MongoDB 连接成功","pid":12345}
```

---

## 🎯 最佳实践

### ✅ 推荐做法

1. **在关键操作前后记录日志**
   ```javascript
   logger.info('开始处理用户注册');
   // 处理...
   logger.info('用户注册完成', { userId, email });
   ```

2. **为错误添加上下文信息**
   ```javascript
   logger.error('API请求失败', error, {
     endpoint: '/api/v1/users',
     method: 'POST',
     statusCode: error.response?.status,
   });
   ```

3. **使用适当的日志级别**
   - `error`：必须立即处理的问题
   - `warn`：可能问题，需要关注
   - `info`：关键业务事件
   - `debug`：详细的开发信息

4. **隐藏敏感信息**
   ```javascript
   // ❌ 错误：记录密码
   logger.info('用户数据', { username, password });

   // ✅ 正确：只记录必要信息
   logger.info('用户登录成功', { userId, username });
   ```

### ❌ 避免做法

1. **不要使用 console.log 在生产环境**
   ```javascript
   // ❌ 错误
   console.log('用户数据:', userData);

   // ✅ 正确
   logger.debug('用户数据', { userId: userData.id });
   ```

2. **不要记录过于详细的信息**
   ```javascript
   // ❌ 过度记录
   logger.debug('SQL查询:', fullQuery, userData, queryResult, metadata);

   // ✅ 适度记录
   logger.debug('执行数据库查询', { table: 'users', recordCount: result.length });
   ```

3. **不要忽视错误日志**
   ```javascript
   // ❌ 错误：吞掉异常
   try {
     await database.connect();
   } catch (error) {
     // 没有记录！
   }

   // ✅ 正确
   try {
     await database.connect();
   } catch (error) {
     logger.error('数据库连接失败', error);
     throw error;
   }
   ```

---

## 🔍 日志查看

### 实时查看日志

```bash
# 查看所有日志
tail -f logs/combined.log

# 查看错误日志
tail -f logs/error.log

# 使用grep过滤
tail -f logs/combined.log | grep "用户"

# 统计特定关键字出现次数
grep -c "error" logs/error.log
```

### 分析日志文件

```bash
# 查看最近100行错误
tail -100 logs/error.log

# 查看特定时间的日志
grep "2025-12-04 14:3" logs/combined.log

# 统计各个日志级别的数量
grep -o '"level":"[^"]*"' logs/combined.log | sort | uniq -c
```

### 使用工具分析

```bash
# 使用jq解析JSON日志
tail -f logs/combined.log | jq '.level, .message'

# 导出为CSV
cat logs/combined.log | jq -r '[.timestamp, .level, .message] | @csv' > logs_export.csv
```

---

## 🚨 故障排查

### 日志文件未创建

**问题**：logs 目录不存在或权限不足

**解决**：
```bash
# 创建 logs 目录
mkdir -p logs

# 检查权限
ls -la logs/

# 修改权限（如需要）
chmod 755 logs/
```

### 日志大小过大

**问题**：某个日志文件超过预期大小

**解决**：
```bash
# 查看文件大小
ls -lh logs/

# 手动清理（只保留当前日志）
rm logs/combined.log.*
rm logs/error.log.*

# 重启应用生成新日志
```

### 敏感信息被记录

**问题**：日志中包含密码、token等敏感信息

**解决**：
```javascript
// 创建日志过滤函数
function sanitizeData(data) {
  const filtered = { ...data };
  if (filtered.password) delete filtered.password;
  if (filtered.token) delete filtered.token;
  if (filtered.secret) delete filtered.secret;
  return filtered;
}

// 使用过滤
logger.info('用户登录', sanitizeData(userData));
```

---

## 📚 相关链接

- [Winston 官方文档](https://github.com/winstonjs/winston)
- [项目日志配置文件](./backend/src/utils/logger.js)
- [后端启动文件](./backend/src/server.js)
- [PM2 日志配置](./backend/pm2.config.js)

---

## 更新记录

- **2025-12-04**：初始版本，完整的生产级日志系统
  - Winston 3.11.0 配置
  - 多传输方式支持
  - 日志轮转策略
  - 完整的使用指南

