# 前端问题：页面显示和样式（WXML/WXSS）

> 小程序中关于样式加载、页面显示的常见问题

---

## 问题1：页面空白，样式不显示

**问题现象**：首页完全空白，不显示任何内容

**根本原因**：`app.wxss` 使用了微信小程序不支持的复杂CSS变量语法

**解决方案**：简化CSS，使用基础语法
```css
/* ❌ 错误：微信小程序不完全支持CSS变量 */
page {
  --color-primary: #4a90e2;
  --color-primary-light: #e8f4ff;
}
.btn {
  background: var(--color-primary);
}

/* ✅ 正确：使用基础CSS */
page {
  background-color: #f5f5f5;
  font-size: 28rpx;
}
.btn {
  background: #4a90e2;
}
```

**经验教训**：
- ⚠️ 微信小程序对CSS支持有限，避免使用复杂特性
- ⚠️ WXSS编译错误会导致整个页面不渲染
- ✅ 优先使用WeUI提供的样式类
- ✅ 出现空白页第一时间检查Console的WXSS编译错误

---

## 问题2：CSS权重问题

**问题现象**：自定义的CSS样式没有生效，被其他样式覆盖

**根本原因**：CSS权重不足，被WeUI或其他全局样式覆盖

**解决方案**：
```css
/* ❌ 不推荐：权重太低 */
.btn {
  color: red;
}

/* ✅ 推荐：增加权重 */
.page .btn {
  color: red;
}

/* ✅ 或使用!important（最后的手段） */
.btn {
  color: red !important;
}
```

**调试步骤**：
1. 打开开发者工具的Inspector
2. 选中元素查看应用的样式
3. 找出优先级更高的规则
4. 增加选择器权重或使用更具体的路径

**经验教训**：
- ⚠️ WeUI默认样式权重较高
- ⚠️ 避免使用!important（会导致难以维护）
- ✅ 增加选择器层级来提高权重：`.page .btn` > `.btn`
- ✅ 在WXSS中定义全局变量时使用明确的类名

---

## 问题3：布局错乱

**问题现象**：页面元素排列不对，间距异常

**根本原因**：
1. Box-sizing不一致
2. 外边距/内边距设置错误
3. 浮动元素未清除

**解决方案**：
```wxss
/* ✅ 全局设置box-sizing */
* {
  box-sizing: border-box;
}

page {
  padding: 0;
  margin: 0;
}

/* ✅ 正确的间距设置 */
.container {
  padding: 20rpx;  /* 使用rpx单位便于适配 */
  margin-bottom: 20rpx;
}

/* ✅ 清除浮动 */
.clearfix::after {
  content: "";
  display: table;
  clear: both;
}
```

**经验教训**：
- ⚠️ 小程序默认box-sizing可能不同
- ⚠️ 混合使用px和rpx会导致适配问题
- ✅ 统一使用rpx作为单位（根据设备宽度缩放）
- ✅ 在app.wxss中设置全局reset样式

---

## 常见样式问题速查

| 问题 | 原因 | 解决方案 |
|------|------|--------|
| 页面空白 | WXSS编译错误 | 检查Console，修复CSS语法 |
| 样式不生效 | 权重不足 | 增加选择器层级 |
| 不同手机显示不同 | 单位混乱 | 统一使用rpx |
| 元素重叠 | z-index设置 | 检查position和z-index |

---

**来源：BUG_FIXES.md 问题1-3**
