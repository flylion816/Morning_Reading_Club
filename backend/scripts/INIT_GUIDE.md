# 课程内容导入指南

## 📖 通用脚本说明

`init-course-content.js` 是一个通用的课程内容导入脚本，支持导入任意期次、任意日期的课程内容。

### ✨ 主要特性

1. **通用性**：支持任意期次和日期
2. **灵活性**：支持内置配置或外部JSON文件
3. **INSERT模式**：仅插入新记录，不删除或更新旧记录
4. **智能验证**：自动验证内容点数和空行数
5. **友好输出**：详细的导入结果报告

## 🚀 使用方法

### 方式1：基础用法（使用默认配置）

```bash
cd backend
export MONGODB_URL='mongodb://admin:admin123@localhost:27017/morning_reading?authSource=admin'
node scripts/init-course-content.js
```

**说明**：使用脚本内置的"平衡之道"期次、Day 0、完整的22点内容

### 方式2：指定期次和日期

```bash
node scripts/init-course-content.js "平衡之道" 1
```

**参数**：
- 第1个参数：期次名称（如"平衡之道"、"智慧之光"等）
- 第2个参数：课程日期（0表示开场，1-23表示各天）

### 方式3：使用外部JSON文件

```bash
node scripts/init-course-content.js "平衡之道" 1 day1-content.json
```

**说明**：从JSON文件加载课程内容，文件格式见下一节

## 📋 JSON文件格式

创建 `day1-content.json`：

```json
{
  "title": "课程标题",
  "subtitle": "副标题",
  "icon": "⚖️",
  "meditation": "静一静的内容",
  "question": "问一问的内容",
  "content": "读一读的HTML富文本内容",
  "reflection": "想一想的内容",
  "action": "记一记的内容",
  "extract": "摘一摘的内容",
  "say": "说一说的内容",
  "learn": "学一学的内容",
  "duration": 23,
  "isPublished": true,
  "sortOrder": 0
}
```

### 读一读内容的HTML格式规范

使用富文本HTML格式，每个点之间用 `<p></p>` 分隔：

```html
<p><strong style="color: #d32f2f;">每天晨读内容</strong></p>
<p></p>
<p><strong>标题</strong></p>
<p></p>
<p><strong>1.</strong> 第一个点的完整内容...</p>
<p></p>
<p><strong>2.</strong> 第二个点的完整内容...</p>
<p></p>
...
<p><strong>22.</strong> 第二十二个点的完整内容...</p>
```

**格式要点**：
- 每个点都以 `<p><strong>N.</strong> 内容</p>` 开头
- 点之间用 `<p></p>` 空行分隔
- 引用等可用 `<p style="margin-left: 2em;">...</p>` 缩进
- 使用 `<strong>` 标签加粗重要文本

## 🔍 导入结果验证

脚本执行成功后会输出详细报告：

```
✅ 课程创建成功!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 课程ID: 69218c3f453c00868caca62b
📚 期次: 平衡之道
📅 日期: 第 0 天
📖 标题: 品德成功论
✓ 发布状态: 已发布
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   内容字段详情:
   ✓ meditation (静一静): 32 字
   ✓ question (问一问): 16 字
   ✓ content (读一读): 2876 字
   ✓ reflection (想一想): 23 字
   ✓ action (记一记): 35 字
   ✓ extract (摘一摘): 25 字
   ✓ say (说一说): 54 字
   ✓ learn (学一学): 50 字

   📌 内容点数: 22 个点
   📌 空行数: 23 个 <p></p>
```

**验证项**：
- ✅ 课程ID：确认课程已创建
- ✅ 内容点数：应为22个
- ✅ 空行数：应为23个（22个点之间 + 标题后）
- ✅ 所有字段长度：确认内容已完整导入

## 💡 常见问题

### Q1：导入时报错"找不到期次"
```
❌ 找不到期次: "平衡之道"
📌 可用期次列表:
   - 智慧之光
   - 勇敢的心
   ...
```

**解决**：检查期次名称是否正确，使用列出的期次名称

### Q2：导入了多条重复的记录
**说明**：这是正常的INSERT行为。脚本会插入新记录，不会删除旧记录。如果需要替换，请手动删除旧记录：

```javascript
// 在mongosh中执行
db.sections.deleteMany({ periodId: ObjectId("..."), day: 0 })
```

### Q3：内容中的HTML格式显示不对
**检查**：
- 富文本是否用 `<rich-text>` 组件渲染
- HTML是否是有效的XML格式（特殊字符需转义）
- 图片路径是否正确

## 📚 相关文件

| 文件 | 用途 |
|------|------|
| `init-course-content.js` | 通用导入脚本（新） |
| `init-balance-day1-content.js` | 平衡之道Day1专用脚本（旧，保留） |
| `check-balance-period.js` | 期次验证脚本 |

## 🔄 迁移指南

如果有其他期次需要导入，使用此脚本而不是创建新的专用脚本：

```bash
# ❌ 旧方式（不推荐）
node init-balance-day1-content.js

# ✅ 新方式（推荐）
node init-course-content.js "期次名称" 日期 [JSON文件]
```

## 🎯 最佳实践

1. **使用外部JSON文件管理内容**
   - 便于版本控制和内容编辑
   - 避免脚本中的硬编码

2. **验证导入结果**
   - 检查点数和空行数
   - 查看字段长度是否合理

3. **备份重要数据**
   - 大批量导入前备份数据库
   - 保存JSON源文件

4. **统一导入流程**
   - 所有期次使用同一脚本
   - 遵循统一的JSON格式

---

**最后更新**: 2025-11-22
