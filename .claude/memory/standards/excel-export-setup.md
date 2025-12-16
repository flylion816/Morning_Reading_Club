# Excel 导出功能安装和使用指南

## 📋 概述

Excel 导出功能已在管理后台实现，支持三种格式：

- **Excel (.xlsx)** - 包含样式、冻结表头、自动列宽
- **CSV (.csv)** - 轻量级逗号分隔格式
- **JSON (.json)** - 结构化数据格式

## 🔧 安装依赖

### 步骤1：安装 xlsx 库（可选）

Excel 导出为可选功能，如果要使用 Excel 导出，需要安装 `xlsx` 库：

```bash
cd admin
npm install xlsx
# 或
yarn add xlsx
```

### 步骤2：验证安装

```bash
npm list xlsx
```

## 📁 文件结构

```
admin/src/
├── utils/
│   └── exportUtils.ts          # 导出工具库
└── views/
    └── InsightRequestsManagementView.vue  # 使用导出功能的页面
```

## 🎯 使用方法

### 在组件中使用

```typescript
import { exportToCSV, exportToExcel, exportToJSON, generateFilename } from '../utils/exportUtils';

// 准备数据
const headers = ['列1', '列2', '列3'];
const rows = [
  ['值1', '值2', '值3'],
  ['值4', '值5', '值6']
];

// 生成文件名（包含日期和时间戳）
const filename = generateFilename('my-export');

// 导出为 Excel
await exportToExcel(filename, headers, rows, {
  sheetName: '我的工作表',
  frozenHeader: true, // 冻结表头行
  columnWidths: [15, 20, 25], // 列宽
  headerBackgroundColor: 'FF4472C4', // 表头背景色
  headerTextColor: 'FFFFFFFF' // 表头文本色
});

// 导出为 CSV
exportToCSV(filename, headers, rows);

// 导出为 JSON
exportToJSON(filename, headers, rows);
```

## 🎨 Excel 导出选项

```typescript
interface ExcelExportOptions {
  sheetName?: string; // 工作表名称，默认 'Sheet1'
  frozenHeader?: boolean; // 冻结表头（第1行），默认 true
  columnWidths?: number[]; // 列宽数组，默认自动计算
  headerBackgroundColor?: string; // 表头背景色（RGB），默认 'FF4472C4' (蓝色)
  headerTextColor?: string; // 表头文本色（RGB），默认 'FFFFFFFF' (白色)
}
```

### 颜色格式说明

RGB 颜色格式：`FF` + 十六进制RGB值

- `FF4472C4` - 蓝色
- `FF70AD47` - 绿色
- `FFC5504A` - 红色
- `FFFFC000` - 橙色

## 📊 当前实现的导出功能

### 在 InsightRequestsManagementView.vue 中

**导出按钮** - 下拉菜单选择格式：

- 📊 导出为 Excel
- 📋 导出为 CSV
- 📄 导出为 JSON

**导出内容** - 查看申请列表，包括：

- 申请者
- 被申请者
- 申请原因
- 申请时间
- 申请状态
- 处理时间

**文件名格式**：`insight-requests-export-{日期}-{时间戳}.xlsx`

## 🔍 常见问题

### Q: xlsx 库没有安装会怎样？

A: Excel 导出会失败，但系统会自动降级到 CSV 格式，用户会看到提示：

```
"Excel 导出失败，自动使用 CSV 格式"
```

### Q: 如何自定义表头颜色？

A: 在调用 `exportToExcel` 时传入自定义颜色：

```typescript
await exportToExcel(filename, headers, rows, {
  headerBackgroundColor: 'FF70AD47', // 绿色
  headerTextColor: 'FFFFFFFF'
});
```

### Q: 如何设置自定义列宽？

A: 传入 `columnWidths` 数组，每个数字代表一列的宽度：

```typescript
await exportToExcel(filename, headers, rows, {
  columnWidths: [10, 20, 30, 25, 15, 20]
});
```

### Q: 如何修改工作表名称？

A: 传入 `sheetName` 参数：

```typescript
await exportToExcel(filename, headers, rows, {
  sheetName: '我的工作表名称'
});
```

## 🚀 高级用法

### 多工作表导出

要导出多个工作表，需要调整 `exportToExcel` 函数。目前支持单工作表。

### 自动列宽计算

默认根据列标题长度自动计算列宽。如需自定义，参见上述示例。

### 数据格式化

通过 `generateExportData` 工具函数将复杂数据转换为导出格式：

```typescript
import { generateExportData } from '../utils/exportUtils';

const data = [
  { name: '张三', age: 28, email: 'zhangsan@example.com' },
  { name: '李四', age: 32, email: 'lisi@example.com' }
];

const exportData = generateExportData(data, [
  { key: 'name', label: '姓名' },
  { key: 'age', label: '年龄' },
  { key: 'email', label: '邮箱', formatter: v => v.toLowerCase() }
]);
```

## 📈 性能考虑

- **CSV 导出**：适合大数据集（10000+ 行），因为格式简单
- **Excel 导出**：适合中等数据集（<5000 行），因为需要处理样式
- **JSON 导出**：适合后续数据处理或备份

## ✅ 测试清单

- [ ] CSV 导出正常工作
- [ ] Excel 导出正常工作（需安装 xlsx）
- [ ] JSON 导出正常工作
- [ ] 文件名包含日期和时间戳
- [ ] 表头样式正确应用（Excel）
- [ ] 列宽适配内容（Excel）
- [ ] 多行数据导出成功
- [ ] 特殊字符（逗号、引号、换行）处理正确（CSV）

## 🔗 相关文件

- 导出工具库：`admin/src/utils/exportUtils.ts`
- 使用示例：`admin/src/views/InsightRequestsManagementView.vue`

---

**最后更新**: 2025-12-04
**维护者**: Claude Code
