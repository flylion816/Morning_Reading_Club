# 前端问题：API集成和响应解包

> 小程序在处理接口响应、分页对象、列表数据时的常见问题。

---

## 问题35：课程详情页加载失败，`dbCheckins.map is not a function`

**问题现象**：课程详情页进入后直接报错，内容区无法完整渲染，控制台显示：

```text
TypeError: dbCheckins.map is not a function
```

**发生位置**：`miniprogram/pages/course-detail/course-detail.js`

**根本原因**：

1. `courseService.getSectionCheckins()` 调用了 `preserveResponse: true`
2. `request.js` 在这个模式下返回的是完整响应包装对象
3. 后端真实结构类似：

```javascript
{
  code: 0,
  message: 'success',
  data: Array(1),
  timestamp: 1778024308799,
  pagination: { ... }
}
```

4. 页面代码原来写成：

```javascript
dbCheckins = checkinRes.list || checkinRes.items || checkinRes || [];
```

5. 因为 `checkinRes` 本身是对象，不是数组，最后 `dbCheckins.map(...)` 直接抛错

**解决方案**：

先把列表从响应包装里解出来，再进入 `.map()`。

```javascript
function normalizeCheckinListResponse(response) {
  if (!response) return [];

  const candidates = [
    response.data,
    response.list,
    response.items,
    response.docs,
    response.rows,
    response
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

const checkinRes = await courseService.getSectionCheckins(periodId, sectionId, {
  limit: 500
});
const dbCheckins = normalizeCheckinListResponse(checkinRes);
```

**经验教训**：

- `preserveResponse: true` 返回的是完整包装对象，不要直接当数组用
- `list || items || res` 这种兜底写法，在对象存在时会误判
- 只要要调用 `.map()`，就先做 `Array.isArray()` 校验
- 如果接口既返回列表又返回分页元数据，要把两者分开处理

**相关文件**：

- `miniprogram/utils/request.js`
- `miniprogram/services/course.service.js`
- `miniprogram/pages/course-detail/course-detail.js`

**相关提交**：`1b36d09`

