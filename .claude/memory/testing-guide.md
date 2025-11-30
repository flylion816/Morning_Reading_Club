# 测试用户信息和环境配置

## 🧪 测试用户

**统一使用以下用户进行测试，避免每次都创建新用户：**

### 主测试用户 - 阿泰
- **用户ID**: `6915e741c4fbb40316417089`
- **昵称**: 阿泰
- **头像**: 🦁
- **OpenID**: `o2ouaYkGy2puoKyjwxmjrIHBzU_L5d8YRXTNOyM6_P8a`
- **用途**: 所有开发和功能测试

### 测试数据
- **当前期次**: 平衡之道 (2025-11-19 ~ 2025-12-11)
  - 期次ID: `6916c27f2a43d9be12944348`
  - 状态: `not_started`
  - 已有小凡看见数据: 1条

---

## 🔧 登录逻辑修改需求

### 当前问题
- 每次微信登录都会创建一个新的用户账号
- 导致测试数据混乱，难以复现问题

### 修复方案 ✅ 已完成
在后端登录接口中，修改逻辑为：
1. **开发环境** - 使用固定用户 (阿泰)
2. **生产环境** - 正常的 openid 匹配逻辑

**修改位置**: `backend/src/controllers/auth.controller.js` (Lines 6-64)

**实现内容**:
```javascript
// 开发环境：统一使用"阿泰"用户进行测试，避免每次都创建新用户
if (process.env.NODE_ENV === 'development') {
  user = await User.findOne({ nickname: '阿泰' });

  if (!user) {
    console.error('❌ 开发环境错误：测试用户"阿泰"不存在，请先初始化数据库');
    return res.status(500).json(errors.internal('测试用户未初始化'));
  }

  console.log('✅ 开发环境：使用测试用户"阿泰"登录');
} else {
  // 生产环境：根据code获取openid
  // [继续原始逻辑...]
}
```

**验证方式**:
1. 小程序清除缓存 (开发工具 → 工具 → 清除缓存)
2. 点击微信登录
3. 查看 Console: 应该输出 "✅ 开发环境：使用测试用户"阿泰"登录"
4. 登录后用户信息应该是 "阿泰"
5. 每次登录都使用同一个用户，不会创建新用户

---

## 🎨 头像显示问题

### 当前问题（已解决） ✅
- ~~用户列表页面头像显示为椭圆而非圆形~~
- ~~应该用 "小程序底色 + 最后一个字符"~~

### 修复完成 ✅
文件: `admin/src/views/UsersView.vue`

**实现内容**:
- ✅ 头像已为圆形 (CSS: `border-radius: 50%`)
- ✅ 实现颜色逻辑: 根据用户ID生成稳定的背景色 (`getAvatarColor()` 函数)
- ✅ 显示用户昵称的第一个字符 (`.charAt(0)`)
- ✅ 在用户列表中添加"用户ID"列，显示完整的 `_id`
- ✅ 在用户详情对话框中也显示用户ID

**CSS样式** (Line 337-348):
```css
.avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;  /* ← 圆形 */
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 18px;
  flex-shrink: 0;
}
```

**颜色生成函数** (Line 290-299):
```javascript
function getAvatarColor(userId: string): string {
  const colors = ['#4a90e2', '#7ed321', '#f5a623', '#bd10e0', '#50e3c2', '#b8e986', '#ff6b6b', '#4ecdc4']
  if (!userId) return colors[0]

  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
  }
  return colors[Math.abs(hash) % colors.length]
}
```

---

## 📋 API 端点快速参考

### 登录
- **地址**: POST `/api/v1/auth/login`
- **参数**: `{ openid, unionid }`
- **测试**: 使用阿泰的 openid

### 期次列表
- **地址**: GET `/api/v1/periods`
- **认证**: 需要

### 小凡看见
- **地址**: GET `/api/v1/insights/period/:periodId`
- **认证**: 需要
- **示例**: `/api/v1/insights/period/6916c27f2a43d9be12944348`

---

**最后更新**: 2025-11-30
**相关问题**: 用户管理界面、登录流程、头像显示
