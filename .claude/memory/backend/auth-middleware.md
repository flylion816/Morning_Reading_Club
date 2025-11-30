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

**来源：BUG_FIXES.md 问题31**
**最后更新：2025-11-30**
