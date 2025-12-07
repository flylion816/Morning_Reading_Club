# 前端问题：首页返回后报名状态未刷新

---

## 问题34：小程序首页返回后显示已报名的期次仍需要报名 (2025-12-01)

**问题现象**：
- 用户在首页点击"平衡之道"，进入报名页面并完成报名
- 报名成功后返回首页
- 期次卡片仍然显示"填写报名信息"，需要重新点击报名页面

**根本原因**：
`miniprogram/pages/index/index.js` 中的 `onShow()` 生命周期只检查登录状态，没有重新检查期次的报名状态
- 第一次加载首页时，`loadPeriods()` 会调用 `checkEnrollmentStatus()`
- 从报名页面返回时，`onShow()` 被触发，但只调用了 `checkLoginStatus()`
- 前端的 `periodEnrollmentStatus` 仍保持初始状态（未报名）

**代码位置**：`miniprogram/pages/index/index.js` 第32-35行

```javascript
// ❌ 错误：onShow 没有重新检查报名状态
onShow() {
  const app = getApp();
  const isLogin = app.globalData.isLogin;
  const userInfo = app.globalData.userInfo;

  this.setData({
    isLogin,
    userInfo
  });

  if (isLogin && !userInfo) {
    this.loadUserInfo();
  }
}
```

**解决方案**：在 `onShow()` 中添加报名状态检查

```javascript
// ✅ 正确：onShow 重新检查报名状态
onShow() {
  // 每次显示时检查登录状态
  this.checkLoginStatus();
  // 重新检查报名状态（用户可能在报名页面新增了报名）
  if (this.data.isLogin && this.data.periods.length > 0) {
    this.checkEnrollmentStatus(this.data.periods);
  }
}
```

**验证步骤**：

```bash
# 1. 打开小程序首页
# 2. 查看 Console，应该输出 "期次 平衡之道: 未报名"

# 3. 点击平衡之道卡片，进入报名页面

# 4. 完成报名流程（需要填写完整表单或使用简化报名）

# 5. 报名成功后自动返回首页

# 6. 查看 Console，应该输出 "期次 平衡之道: 已报名"

# 7. 点击平衡之道卡片，应该直接进入课程列表，而不是报名页面
```

**关键检查清单**：

- [x] `onShow()` 中添加 `checkEnrollmentStatus()` 调用
- [x] 添加条件判断（已登录且期次列表已加载）
- [x] 前端的 `periodEnrollmentStatus` 状态被更新
- [x] 测试完整的报名流程
- [x] 用户返回首页时自动刷新报名状态

**相关代码位置**：
- 前端：`miniprogram/pages/index/index.js`
  - onShow()：第32-39行
  - checkEnrollmentStatus()：第116-146行
  - loadPeriods()：第85-114行

- 后端：`backend/src/routes/enrollment.routes.js` 第83行
  - checkEnrollment 路由已正确定义

- 后端：`backend/src/controllers/enrollment.controller.js` 第277-314行
  - checkEnrollment 控制器已正确实现

**相关提交**：7a962b5

**经验教训**：

- ⚠️ **页面显示时要刷新列表状态**：用户从其他页面返回时，需要重新检查状态而不是依赖缓存
- ⚠️ **onShow() 和 onLoad() 的职责不同**：
  - onLoad()：初始化，加载列表数据
  - onShow()：每次显示时，刷新动态数据（用户状态、报名状态等）
- ✅ **对于可变的用户状态，应该在 onShow() 中刷新**：报名状态、登录状态、支付状态等
- ✅ **用下拉刷新测试状态刷新**：确保 onPullDownRefresh() 也能正确刷新报名状态
- ✅ **前端使用 console.log 记录每次状态检查**：帮助快速定位问题

**类似的问题**：

这个问题的根本原因是**前端生命周期管理不完善**，类似的问题可能出现在：
- 用户发布小凡看见后，insights 列表不刷新
- 用户完成打卡后，首页的打卡状态不更新
- 用户修改个人信息后，档案页面不更新

**防止再次发生**：

建立规范：
1. 所有依赖用户操作结果的数据都应该在 `onShow()` 中刷新
2. 为关键的 API 调用添加日志，便于问题追踪
3. 编写测试用例验证多页面跳转的状态一致性

---

**来源**：小程序报名后返回首页仍需要报名 (2025-12-01)
**最后更新**：2025-12-01
**状态**：已解决
