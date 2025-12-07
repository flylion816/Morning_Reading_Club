# 后端问题：认证和中间件

---

## 问题31：路由认证中间件缺失

**问题现象**：虽然API逻辑正确，但用户查询时返回空数据或权限错误

**根本原因**：路由定义时没有应用 `authMiddleware`，导致 `req.user` 永远是 `undefined`

```javascript
// ❌ 错误：路由没有认证中间件
router.get('/insights/:id', getInsights);
// 在控制器中 req.user 为 undefined
```

**解决方案**：为需要用户身份的路由应用认证中间件

```javascript
// ✅ 正确：应用authMiddleware
router.get('/insights/:id', authMiddleware, getInsights);

// ✅ 对于多个需要认证的路由
router.use(authMiddleware);  // 所有后续路由都需要认证

// ✅ 或者为特定路由组应用
const authRoutes = express.Router();
authRoutes.use(authMiddleware);
authRoutes.get('/insights', getInsights);
authRoutes.get('/profile', getUserProfile);

router.use('/api/v1/user', authRoutes);
```

**关键检查清单**：

- [ ] 检查 `backend/src/routes/` 中所有路由文件
- [ ] 找出所有需要用户身份的路由
- [ ] 确保这些路由应用了 `authMiddleware`
- [ ] 测试：调用API时检查 `req.user` 是否存在
- [ ] 验证：使用 `console.log(req.user)` 查看用户信息

**相关代码位置**：
- 中间件：`backend/src/middleware/auth.js`
- 路由文件：`backend/src/routes/*.routes.js`

**相关提交**：83e2671

**经验教训**：
- ⚠️ **路由和控制器是分离的**：仅在函数中检查 `req.user` 不够，必须在路由层应用认证
- ⚠️ 认证中间件必须在业务逻辑前应用
- ✅ 所有需要登录的API都要明确应用认证中间件
- ✅ 使用 `app.use()` 为全局应用，使用 `router.use()` 为路由组应用
- ✅ 定期审查路由配置，确保没有遗漏认证

---

## 认证相关最佳实践

### ✅ 正确的认证流程

```javascript
// 1. 定义中间件
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    const user = jwt.verify(token, SECRET);
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// 2. 在路由中应用
router.get('/protected', authMiddleware, (req, res) => {
  // 这里 req.user 是可用的
  res.json({ user: req.user });
});

// 3. 在控制器中使用
function getInsights(req, res) {
  const userId = req.user._id;
  // 使用userId查询数据
}
```

### ❌ 常见错误

```javascript
// ❌ 错误1：忘记应用中间件
router.get('/insights', getInsights);  // req.user 为 undefined

// ❌ 错误2：中间件顺序错误
router.get('/insights', getInsights, authMiddleware);  // 太晚了

// ❌ 错误3：条件判断不完整
if (req.user) {
  // 查询用户数据
}
// 应该返回401，而不是继续执行
```

---

## 问题32：管理后台初始化密码不一致 (2025-12-01)

**问题现象**：管理后台登录页面提示使用邮箱 `admin@morningreading.com` 和密码 `admin123456`，但登录时返回"邮箱或密码错误"

**根本原因**：初始化超级管理员时使用的密码与文档/页面提示不一致
- 页面提示：`admin123456`
- 初始化代码：`password123`
- 两个密码不匹配导致登录失败

**发生位置**：`backend/src/controllers/admin.controller.js` 第281行

**解决方案**：更新初始化代码中的密码

```javascript
// ❌ 错误
const superAdmin = new Admin({
  name: 'SuperAdmin',
  email: 'admin@morningreading.com',
  password: 'password123',  // 与文档不一致
  role: 'superadmin',
  status: 'active'
});

// ✅ 正确
const superAdmin = new Admin({
  name: 'SuperAdmin',
  email: 'admin@morningreading.com',
  password: 'admin123456',  // 与文档/UI提示一致
  role: 'superadmin',
  status: 'active'
});
```

**验证步骤**：

```bash
# 1. 重新初始化管理员（如果已有旧的）
#    删除数据库中的 admins 集合，或者调用：
#    POST /api/v1/admin/auth/admin/init

# 2. 使用正确的凭证登录
curl -X POST http://localhost:3000/api/v1/admin/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@morningreading.com","password":"admin123456"}'

# 3. 应该返回 200 状态码和有效的 token
```

**相关提交**：be36026

**经验教训**：
- ⚠️ **初始化数据必须与文档一致**：密码、凭证等敏感信息必须统一
- ⚠️ 如果更改初始密码，需要同时更新所有文档（CLAUDE.md、快速参考等）
- ✅ 建议将初始凭证提取为环境变量或常量，而不是硬编码
- ✅ 测试初始化流程：验证创建的用户可以正确登录
- ✅ 定期检查文档和代码中的凭证是否一致

**防止再次发生**：

```javascript
// 更好的做法：从环境变量读取
const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123456';

const superAdmin = new Admin({
  name: 'SuperAdmin',
  email: process.env.ADMIN_EMAIL || 'admin@morningreading.com',
  password: defaultPassword,
  role: 'superadmin',
  status: 'active'
});
```

---

## 问题33：路由缺少根路径处理导致小程序API请求404 (2025-12-01)

**问题现象**：小程序调用 `POST /api/v1/enrollments` 时返回 404 错误，导致报名失败

**根本原因**：后端路由定义只有 `/submit` 和 `/simple` 子路由，缺少根路径的 POST 处理

**前端调用代码**：`miniprogram/services/enrollment.service.js`
```javascript
// 第115行
submitEnrollment(data) {
  return request.post('/enrollments', data);  // POST /api/v1/enrollments
}

// 第15行
enrollPeriod(periodId) {
  return request.request({
    url: `/enrollments/`,  // 也会走到根路由
    method: 'POST',
    data: { periodId }
  });
}
```

**后端路由定义**：`backend/src/routes/enrollment.routes.js`
```javascript
// ❌ 缺少这个路由，导致 POST / 返回404
router.post('/', authMiddleware, submitEnrollmentForm);

// ✅ 只有这些子路由
router.post('/submit', authMiddleware, submitEnrollmentForm);
router.post('/simple', authMiddleware, enrollPeriod);
```

**解决方案**：在路由文件中添加根路径的 POST 处理

```javascript
// 在用户路由部分最前面添加
router.post('/', authMiddleware, submitEnrollmentForm);  // 处理 POST /
```

**修复内容**：
- 在 `enrollment.routes.js` 第40行添加了 `router.post('/')`
- 使用 `submitEnrollmentForm` 控制器处理小程序的报名请求
- 现在 `POST /api/v1/enrollments` 可以正常工作

**相关提交**：d358a75

**经验教训**：
- ⚠️ **前后端接口定义必须一致**：小程序调用什么端点，后端就必须定义什么端点
- ⚠️ **根路由容易被遗漏**：特别是有多个子路由时，容易忘记处理根路径
- ⚠️ **末尾斜杠会被规范化**：`/enrollments/` 和 `/enrollments` 通常被当作同一个路由
- ✅ 后端路由应该优先考虑小程序等移动客户端的调用习惯
- ✅ 根路由应该放在子路由之前定义，避免被覆盖
- ✅ 为根路径提供一个默认的处理方式

**最佳实践**：

```javascript
// ✅ 推荐的路由组织方式
router.post('/', authMiddleware, defaultHandler);        // 根路由
router.post('/submit', authMiddleware, submitHandler);   // 子路由
router.post('/simple', authMiddleware, simpleHandler);   // 子路由

// 确保 GET 和 DELETE 等其他方法也有根路由处理
router.get('/', authMiddleware, listHandler);
router.delete('/:id', authMiddleware, deleteHandler);
```

---

**来源：小程序注册页面404错误 (2025-12-01)**
**最后更新：2025-12-01**
