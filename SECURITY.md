# 晨读营项目 - 安全审计报告

**版本**: 1.0.0
**日期**: 2025-11-21
**审计者**: Security Team

---

## 📋 执行摘要

本安全审计覆盖了晨读营项目的以下方面：

- 认证和授权机制
- 输入验证和数据处理
- API 安全
- 文件上传安全
- 数据库安全
- HTTPS/TLS 安全

**整体评分**: 待审计

---

## 🔐 1. 认证和授权审计

### 1.1 用户认证 (WeChat MiniProgram)

**实现方式**: 微信授权 → 后端 Token

**安全评估**:

| 项目           | 状态 | 备注                                 |
| -------------- | ---- | ------------------------------------ |
| 使用 HTTPS     | ✅   | 微信强制 HTTPS                       |
| Token 存储     | ⚠️   | localStorage (应考虑 sessionStorage) |
| Token 过期处理 | ✅   | 有刷新机制                           |
| 密码加密       | N/A  | 微信授权，无密码                     |

**建议**:

```javascript
// utils/storage.js - 改进 Token 存储
export const tokenStorage = {
  // 使用 sessionStorage 存储敏感 Token
  setToken(token) {
    sessionStorage.setItem('userToken', token);
  },

  getToken() {
    return sessionStorage.getItem('userToken');
  },

  // 只在用户主动选择时才持久化（记住我）
  setPersistentAuth(token, refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
    // Token 本身不持久化
  }
};
```

**优先级**: 中

---

### 1.2 管理员认证 (JWT)

**实现方式**: Email + Password → JWT Token

**代码审计**:

```javascript
// ✅ 好的做法
1. 密码使用 bcryptjs 加密
2. Token 使用 JWT 签名
3. 有 Token 过期时间
4. Token 存储在 localStorage

// ⚠️ 需要改进
1. 没有 Token 刷新机制（应有 refresh_token）
2. 没有登出时清除 Token
3. 没有 Session 超时提示
```

**改进方案**:

```javascript
// backend/src/controllers/admin.controller.js
module.exports = {
  login: async (req, res) => {
    // 验证邮箱和密码
    const admin = await validateAdminCredentials(email, password);

    // 发放 access token (短生命周期)
    const accessToken = jwt.sign(
      { id: admin._id, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' } // 1 小时
    );

    // 发放 refresh token (长生命周期)
    const refreshToken = jwt.sign(
      { id: admin._id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' } // 7 天
    );

    // 保存 refresh token 到数据库 (便于撤销)
    await AdminRefreshToken.create({
      adminId: admin._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    res.json(
      success({
        accessToken,
        refreshToken,
        expiresIn: 3600
      })
    );
  },

  refreshToken: async (req, res) => {
    const { refreshToken } = req.body;

    // 验证 refresh token
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const storedToken = await AdminRefreshToken.findOne({ token: refreshToken });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        return res.status(401).json(errors.unauthorized('Refresh token 已过期'));
      }

      // 发放新的 access token
      const newAccessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, {
        expiresIn: '1h'
      });

      res.json(success({ accessToken: newAccessToken }));
    } catch (err) {
      res.status(401).json(errors.unauthorized('Invalid refresh token'));
    }
  }
};
```

**优先级**: 高

---

### 1.3 授权检查

**评估**:

```javascript
// ✅ 已实现的保护
1. 路由级别认证中间件
2. 管理后台登录检查
3. 报名检查（已报名则不可重复报名）

// ⚠️ 缺少的保护
1. 角色基础访问控制 (RBAC)
2. 资源级别的权限检查
3. 审计日志
```

**改进示例**:

```javascript
// backend/src/middleware/authorization.js
module.exports = {
  // 角色检查
  requireRole(...allowedRoles) {
    return (req, res, next) => {
      const userRole = req.user?.role;
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json(errors.forbidden('权限不足'));
      }
      next();
    };
  },

  // 资源所有权检查
  checkResourceOwnership(resourceField) {
    return async (req, res, next) => {
      const resourceId = req.params.id;
      const resource = await Resource.findById(resourceId);

      if (resource.ownerId !== req.user.id) {
        return res.status(403).json(errors.forbidden('无权访问此资源'));
      }
      next();
    };
  }
};

// 使用
app.get(
  '/api/v1/enrollments/:id',
  adminAuth,
  requireRole('admin', 'superadmin'),
  checkResourceOwnership('enrollmentId'),
  getEnrollment
);
```

**优先级**: 中

---

## 🛡️ 2. 输入验证和数据处理

### 2.1 表单验证

**当前实现**:

```typescript
// ✅ 前端验证已实现 (Element Plus Form Rules)
// ⚠️ 后端验证需要改进
```

**后端改进方案**:

```javascript
// backend/src/validators/enrollment.validator.js
const Joi = require('joi');

const enrollmentSchema = Joi.object({
  userId: Joi.string().required(),
  periodId: Joi.string().required(),
  name: Joi.string().min(2).max(50).required(),
  gender: Joi.string().valid('male', 'female', 'other').required(),
  province: Joi.string().required(),
  detailedAddress: Joi.string().max(200).required(),
  age: Joi.number().min(1).max(120).required(),
  referrer: Joi.string().allow('').max(50),
  hasReadBooks: Joi.string().valid('yes', 'no').required(),
  readBookCount: Joi.when('hasReadBooks', {
    is: 'yes',
    then: Joi.number().min(1).required(),
    otherwise: Joi.forbidden()
  }),
  motivation: Joi.string().max(500),
  expectations: Joi.string().max(500),
  commitment: Joi.string().max(500)
});

function validateEnrollment(data) {
  const { error, value } = enrollmentSchema.validate(data);
  if (error) {
    throw new ValidationError(error.details[0].message);
  }
  return value;
}

module.exports = { validateEnrollment };
```

**优先级**: 高

---

### 2.2 SQL 注入防护

**当前状态**: ✅ 使用 ORM (Mongoose)，天然防护

**验证**:

```javascript
// ✅ 安全：使用 ORM
Enrollment.find({ userId: req.query.userId });

// ❌ 危险：不要使用字符串拼接（项目中未发现）
db.collection('enrollments').find(`{ userId: '${req.query.userId}' }`);
```

**优先级**: 低

---

### 2.3 XSS 防护

**前端**:

```typescript
// ✅ Vue 3 自动转义 HTML
// 不需要手动 escapeHtml()
<div>{{ userContent }}</div>  // 安全

// ❌ 仅在必要时使用 v-html
<div v-html="richContent"></div>  // 需要验证 richContent
```

**后端**:

```javascript
// 存储用户生成的内容前进行清理
const xss = require('xss');

function sanitizeUserContent(content) {
  return xss(content, {
    whiteList: {
      b: [],
      i: [],
      em: [],
      strong: [],
      p: [],
      br: [],
      h1: [],
      h2: [],
      h3: [],
      a: ['href', 'title'],
      img: ['src', 'alt', 'width', 'height']
    },
    onTag: (tag, html, options) => {
      // 额外的检查
      if (tag === 'a') {
        // 仅允许 http 和 https
        const href = html.match(/href="([^"]*)/);
        if (href && !href[1].startsWith('http')) {
          return '';
        }
      }
      return html;
    }
  });
}
```

**优先级**: 高

---

### 2.4 CSRF 防护

**当前状态**: ⚠️ 需要实现

**改进方案**:

```javascript
// backend/src/middleware/csrf.js
const csrf = require('csurf');
const session = require('express-session');

// CSRF 中间件配置
const csrfProtection = csrf({ cookie: false });

// 仅保护非幂等操作 (POST, PUT, DELETE)
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  csrfProtection(req, res, next);
});

// API 返回 CSRF token
app.get('/api/v1/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```

**前端使用**:

```typescript
// admin/src/services/api.ts
const apiClient = axios.create({
  baseURL: API_BASE_URL
});

// 从页面加载时获取 CSRF token
async function initCSRFProtection() {
  const response = await apiClient.get('/csrf-token');
  apiClient.defaults.headers.post['X-CSRF-Token'] = response.data.csrfToken;
}

initCSRFProtection();
```

**优先级**: 中

---

## 📁 3. 文件上传安全

### 3.1 文件类型验证

**当前实现**: ✅ 在 multer 中间件中实现

**审计结果**:

```javascript
// ✅ 好的做法：白名单验证
const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|xls|xlsx|mp4|webm/;

// ⚠️ 改进：使用 mime-type 库而非扩展名
const mime = require('mime-types');

function validateMimeType(file) {
  const mimeType = mime.lookup(file.originalname);
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword'
  ];
  return allowedMimes.includes(mimeType);
}
```

**优先级**: 中

---

### 3.2 文件大小限制

**当前实现**: ✅ 50MB 限制

**改进建议**:

```javascript
// backend/src/routes/upload.routes.js

// 按文件类型限制大小
const upload = multer({
  storage,
  limits: {
    fileSize: function (req, file) {
      if (file.mimetype.startsWith('image/')) {
        return 10 * 1024 * 1024; // 图片 10MB
      } else if (file.mimetype === 'application/pdf') {
        return 20 * 1024 * 1024; // PDF 20MB
      } else {
        return 50 * 1024 * 1024; // 其他 50MB
      }
    }
  }
});
```

**优先级**: 低

---

### 3.3 路径遍历防护

**当前实现**: ✅ 已检查

```javascript
// ✅ 安全检查
if (filePath.includes('..') || !filePath.startsWith(uploadDir)) {
  return res.status(400).json(errors.badRequest('无效的文件路径'));
}
```

**优先级**: 低

---

### 3.4 文件执行防护

**当前状态**: ⚠️ 需要改进

**改进方案**:

```javascript
// 不在 uploads 目录启用脚本执行
// nginx 配置
location /uploads/ {
  # 禁止执行脚本
  location ~ \.php$ { deny all; }
  location ~ \.sh$ { deny all; }
  location ~ \.py$ { deny all; }
  # 允许以下类型的静态资源
  types {
    image/jpeg jpg;
    image/png png;
    application/pdf pdf;
    video/mp4 mp4;
  }
}
```

**优先级**: 高

---

## 🔒 4. API 安全

### 4.1 速率限制

**当前状态**: ❌ 未实现

**改进方案**:

```javascript
// backend/src/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

// 通用限制：每小时 100 个请求
const generalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false
});

// 严格限制：登录端点每小时 5 个请求
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  skipFailedRequests: false
});

// 使用
app.use('/api/v1/', generalLimiter);
app.post('/api/v1/auth/admin/login', loginLimiter, loginHandler);
```

**优先级**: 高

---

### 4.2 CORS 安全

**当前实现**:

```javascript
// ✅ CORS 中间件已配置
app.use(cors());
```

**改进方案** (更严格):

```javascript
const cors = require('cors');

const corsOptions = {
  // 仅允许特定域名
  origin: [
    'https://morningreading.com',
    'https://admin.morningreading.com',
    'https://localhost:3000' // 开发环境
  ],
  credentials: true, // 允许发送 credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 预检请求缓存 24 小时
};

app.use(cors(corsOptions));
```

**优先级**: 中

---

### 4.3 API 密钥管理

**当前状态**: ✅ 使用 JWT Token

**改进建议**:

```javascript
// .env 文件应包含
JWT_SECRET=<随机生成的密钥>
JWT_REFRESH_SECRET=<另一个随机密钥>
MONGODB_URI=<完整的连接字符串>
API_PORT=3000
NODE_ENV=production

// 验证
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET 未正确配置');
}
```

**优先级**: 高

---

## 💾 5. 数据库安全

### 5.1 连接安全

**改进**:

```javascript
// ✅ 使用 MONGODB_ATLAS 的 TLS 连接
const mongoUri = process.env.MONGODB_URI;

// 确保包含 SSL 参数
if (!mongoUri.includes('ssl=true')) {
  throw new Error('MongoDB 连接必须使用 TLS');
}

mongoose.connect(mongoUri, {
  ssl: true,
  replicaSet: 'rs0', // 如果使用副本集
  retryWrites: true
});
```

**优先级**: 高

---

### 5.2 数据加密

**敏感数据加密**:

```javascript
// 密码字段：自动加密（已实现）
const crypto = require('crypto');

// 其他敏感信息：加密存储
function encryptSensitiveData(data) {
  const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptSensitiveData(encrypted) {
  const decipher = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

**优先级**: 中

---

## 🔍 6. 环境和配置安全

### 6.1 环境变量

**检查清单**:

- [ ] `.env` 文件在 `.gitignore` 中
- [ ] 生产环境使用强密码
- [ ] 不同环境使用不同的 secrets
- [ ] secrets 定期轮换

**验证**:

```bash
# 检查敏感文件是否被 git 追踪
git ls-files | grep -E '\.env|secret|password'

# 应该返回空结果
```

**优先级**: 高

---

### 6.2 依赖安全

**定期检查**:

```bash
# 检查漏洞
npm audit

# 修复已知漏洞
npm audit fix

# 在 CI/CD 中集成
npm ci --audit-level=moderate
```

**优先级**: 高

---

## 📊 安全检查清单

### 部署前必须检查

- [ ] 所有依赖都是最新版本
- [ ] 没有已知的安全漏洞 (`npm audit`)
- [ ] HTTPS/TLS 配置正确
- [ ] 密钥和秘钥不在源代码中
- [ ] 文件上传有安全检查
- [ ] 输入数据有验证
- [ ] 错误消息不泄露敏感信息
- [ ] 日志不记录密码和 Token
- [ ] 数据库备份和恢复流程测试
- [ ] 员工访问控制配置

### 定期检查 (每月)

- [ ] 更新依赖包
- [ ] 运行安全审计
- [ ] 检查日志是否有异常
- [ ] 验证备份完整性
- [ ] 测试灾难恢复程序

---

## 🚨 已发现的问题

| 问题                | 优先级 | 状态   | 修复人 |
| ------------------- | ------ | ------ | ------ |
| 缺少 CSRF 防护      | 高     | 待修复 |        |
| 缺少 Rate Limiting  | 高     | 待修复 |        |
| 缺少 Token 刷新机制 | 高     | 待修复 |        |
| 文件执行风险        | 高     | 待修复 |        |
| CORS 配置过宽       | 中     | 待修复 |        |
| 缺少审计日志        | 中     | 待修复 |        |
| 缺少 XSS 清理       | 中     | 待修复 |        |
| 依赖包可能过时      | 中     | 待检查 |        |

---

## 📋 修复进度

### 高优先级 (立即修复)

```markdown
- [ ] 实现 CSRF 防护中间件
- [ ] 添加 Rate Limiting 中间件
- [ ] 实现 Token 刷新机制
- [ ] 配置文件执行防护（nginx）
```

### 中优先级 (1 周内修复)

```markdown
- [ ] 严格化 CORS 配置
- [ ] 添加审计日志
- [ ] 实现 XSS 内容清理
- [ ] 更新所有依赖包
```

### 低优先级 (2 周内修复)

```markdown
- [ ] 实现更细粒度的 RBAC
- [ ] 添加安全标头 (CSP, X-Frame-Options)
- [ ] 实现入侵检测
```

---

## 🔐 安全最佳实践

1. **最小权限原则**: 用户只获得完成任务所需的最小权限
2. **深度防御**: 多层安全防护，不依赖单一防线
3. **定期审计**: 至少每月进行一次安全审计
4. **及时补丁**: 发现漏洞立即修复，依赖包及时更新
5. **安全日志**: 记录所有安全相关事件，便于审查
6. **员工培训**: 定期进行安全意识培训

---

**审计完成日期**: 待执行
**下次审计**: 3 个月后
**审计负责人**: Security Team
