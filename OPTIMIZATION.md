# 晨读营项目 - 性能优化指南

**版本**: 1.0.0
**日期**: 2025-11-21

---

## 📊 性能优化目标

| 指标 | 目标 | 当前 | 优化方案 |
|------|------|------|---------|
| FCP (首次内容绘制) | < 1.5s | - | 代码分割 |
| LCP (最大内容绘制) | < 2.5s | - | 图片优化 |
| CLS (累积布局偏移) | < 0.1 | - | 骨架屏 |
| API 响应时间 | < 200ms | - | 数据库索引 |
| 页面加载时间 | < 2s | - | 资源优化 |

---

## 🎯 前端优化策略

### 1. 代码分割 (Code Splitting)

**当前状态**: 已部分实现（Vue Router lazy loading）

**优化项**:
```typescript
// ✅ 好的做法：已实现
const PeriodsView = () => import('../views/PeriodsView.vue')
const AnalyticsView = () => import('../views/AnalyticsView.vue')

// 考虑进一步优化
// 分割大型组件
const RichTextEditor = () => import('../components/RichTextEditor.vue')
```

**预期收益**: 减少初始 bundle 大小 30-40%

---

### 2. 图片优化

**当前问题**:
- 用户头像可能是大图片
- 上传的图片没有压缩
- 没有使用 WebP 格式

**优化方案**:

```javascript
// 后端图片处理 (backend/src/utils/imageOptimization.js)
const sharp = require('sharp');

async function optimizeImage(inputPath, outputPath) {
  await sharp(inputPath)
    .resize(1920, 1080, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 80 })
    .toFile(outputPath.replace(/\.\w+$/, '.webp'));

  // 同时保留原格式的压缩版本
  await sharp(inputPath)
    .resize(1920, 1080, { fit: 'inside' })
    .jpeg({ quality: 80 })
    .toFile(outputPath);
}

// 前端使用 picture 标签
// <picture>
//   <source srcset="/uploads/image.webp" type="image/webp">
//   <img src="/uploads/image.jpg" alt="">
// </picture>
```

**实现步骤**:
1. 安装 `sharp` 包：`npm install sharp`
2. 在上传处理中调用 `optimizeImage()`
3. 前端使用 `<picture>` 标签
4. 添加 CDN 缓存头

**预期收益**: 图片大小减少 50-70%

---

### 3. 缓存策略

**HTTP 缓存**:
```javascript
// backend/src/middleware/cacheControl.js
module.exports = {
  // 静态资源：1 年
  statics: 'public, max-age=31536000, immutable',

  // API 数据：5 分钟
  api: 'public, max-age=300',

  // HTML：不缓存
  html: 'no-cache, no-store, must-revalidate'
};
```

**浏览器本地缓存**:
```typescript
// admin/src/services/cache.ts
class CacheService {
  private cache = new Map<string, any>();
  private ttl = new Map<string, number>();

  set(key: string, value: any, minutes = 5) {
    this.cache.set(key, value);
    this.ttl.set(key, Date.now() + minutes * 60 * 1000);
  }

  get(key: string) {
    const expiry = this.ttl.get(key);
    if (expiry && Date.now() > expiry) {
      this.cache.delete(key);
      return null;
    }
    return this.cache.get(key);
  }
}

export default new CacheService();
```

**预期收益**: 减少 60% API 请求

---

### 4. 虚拟滚动 (Virtual Scrolling)

对于大列表（如报名列表、用户列表），使用虚拟滚动：

```vue
<!-- admin/src/components/VirtualList.vue -->
<template>
  <div class="virtual-list" :style="{ height: height }">
    <div :style="{ height: totalHeight + 'px', position: 'relative' }">
      <div
        v-for="item in visibleItems"
        :key="item.id"
        :style="{ transform: `translateY(${item.offset}px)` }"
        class="list-item"
      >
        <slot :item="item" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const props = defineProps<{
  items: any[];
  itemHeight: number;
  height: string; // e.g. '600px'
}>();

const scrollTop = ref(0);
const containerHeight = ref(0);

const visibleCount = computed(() =>
  Math.ceil(containerHeight.value / props.itemHeight) + 1
);

const startIndex = computed(() =>
  Math.floor(scrollTop.value / props.itemHeight)
);

const visibleItems = computed(() => {
  const start = Math.max(0, startIndex.value - 1);
  const end = Math.min(props.items.length, start + visibleCount.value + 1);

  return props.items.slice(start, end).map((item, i) => ({
    ...item,
    offset: (start + i) * props.itemHeight
  }));
});

const totalHeight = computed(() => props.items.length * props.itemHeight);

function handleScroll(e: Event) {
  scrollTop.value = (e.target as HTMLElement).scrollTop;
}

onMounted(() => {
  const element = document.querySelector('.virtual-list') as HTMLElement;
  containerHeight.value = element?.offsetHeight || 0;
});
</script>
```

**使用场景**:
- EnrollmentsView：可能有数百条记录
- PaymentsView：支付历史可能很多
- UsersView：用户列表较大

**预期收益**: 减少 DOM 节点 90%，提升滚动性能

---

### 5. 防抖和节流

**优化 API 调用**:
```typescript
// admin/src/utils/debounce.ts
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 使用在搜索中
const handleSearch = debounce((keyword: string) => {
  // 调用 API 搜索
  searchUsers(keyword);
}, 300);
```

**预期收益**: 减少 80% 不必要的 API 调用

---

## 🗄️ 后端优化策略

### 1. 数据库索引优化

**当前状态**: 基本索引存在

**优化建议**:
```javascript
// backend/src/models/Enrollment.js
const enrollmentSchema = new Schema({
  userId: { type: String, index: true },           // 单字段索引
  periodId: { type: String, index: true },
  status: { type: String, index: true },
  createdAt: { type: Date, index: true }
});

// 创建复合索引 (提高查询速度)
enrollmentSchema.index({ userId: 1, periodId: 1 });
enrollmentSchema.index({ periodId: 1, status: 1 });
enrollmentSchema.index({ createdAt: -1 });  // 排序用

module.exports = model('Enrollment', enrollmentSchema);
```

**创建索引脚本**:
```javascript
// backend/scripts/create-indexes.js
const mongoose = require('mongoose');
require('dotenv').config();

async function createIndexes() {
  await mongoose.connect(process.env.MONGODB_URI);

  const models = [
    require('../src/models/Enrollment'),
    require('../src/models/Payment'),
    require('../src/models/User'),
    require('../src/models/Period')
  ];

  for (const model of models) {
    await model.collection.createIndexes();
    console.log(`✓ Created indexes for ${model.collection.name}`);
  }

  console.log('All indexes created successfully');
  process.exit(0);
}

createIndexes().catch(console.error);
```

**预期收益**: 查询速度提升 10-100 倍

---

### 2. 数据库查询优化

**优化示例**:
```javascript
// ❌ N+1 问题：多次数据库查询
const enrollments = await Enrollment.find({ periodId });
const users = [];
for (const enrollment of enrollments) {
  const user = await User.findById(enrollment.userId);
  users.push(user);
}

// ✅ 使用 populate：一次查询
const enrollments = await Enrollment.find({ periodId })
  .populate('userId', 'name avatar email');

// ✅ 使用 select 限制字段
const enrollments = await Enrollment.find(
  { status: 'approved' },
  'userId periodId status createdAt'  // 只查询需要的字段
).limit(100);
```

**聚合管道优化**:
```javascript
// 统计期次报名数
db.enrollments.aggregate([
  { $match: { periodId: ObjectId("...") } },
  { $group: {
      _id: '$status',
      count: { $sum: 1 }
    }
  }
]);

// 而不是：
db.enrollments.find({ periodId: ObjectId("...") }).length;  // 慢！
```

**预期收益**: 减少 50-80% 数据库查询时间

---

### 3. 响应压缩

**已实现**: `compression` 中间件

**验证**:
```bash
curl -i http://localhost:3000/api/v1/periods
# 检查 Response Headers 中是否有：
# Content-Encoding: gzip
```

**可进一步优化**:
```javascript
// backend/src/app.js
const compression = require('compression');

app.use(compression({
  level: 6,  // 压缩级别 1-9，默认 6
  threshold: 1024  // 只压缩 > 1KB 的响应
}));
```

**预期收益**: 减少 60-80% 网络传输

---

### 4. 查询结果缓存

```javascript
// backend/src/middleware/queryCache.js
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

function cacheMiddleware(duration = CACHE_TTL) {
  return (req, res, next) => {
    // 只缓存 GET 请求
    if (req.method !== 'GET') return next();

    const key = `${req.originalUrl}`;
    const cached = cache.get(key);

    if (cached && Date.now() - cached.time < duration) {
      return res.json(cached.data);
    }

    const originalJson = res.json;
    res.json = function(data) {
      cache.set(key, { data, time: Date.now() });
      return originalJson.call(this, data);
    };

    next();
  };
}

module.exports = cacheMiddleware;

// 使用
app.get('/api/v1/periods', cacheMiddleware(10 * 60 * 1000), periodController.getPeriods);
```

**预期收益**: 热查询速度提升 100 倍

---

## 🔍 监控和分析

### 1. 性能监控

```javascript
// backend/src/middleware/performanceMonitor.js
module.exports = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`;

    if (duration > 1000) {
      console.warn(`⚠️ 慢请求: ${log}`);
    } else {
      console.log(`✓ ${log}`);
    }
  });

  next();
};
```

### 2. 前端性能指标

```typescript
// admin/src/utils/performance.ts
export function measurePerformance() {
  if (!window.performance) return;

  const navigation = performance.getEntriesByType('navigation')[0];
  const paint = performance.getEntriesByType('paint');

  const metrics = {
    // 总页面加载时间
    pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
    // 首字节时间
    TTFB: navigation.responseStart - navigation.fetchStart,
    // DOM 内容加载
    DOMContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
    // 首绘
    FP: paint.find(p => p.name === 'first-paint')?.startTime,
    // 首内容绘制
    FCP: paint.find(p => p.name === 'first-contentful-paint')?.startTime
  };

  console.table(metrics);

  // 上报到分析服务
  reportMetrics(metrics);
}

// 页面加载完成后调用
window.addEventListener('load', () => {
  setTimeout(measurePerformance, 0);
});
```

---

## 📋 优化执行计划

### Phase 1: 高优先级 (第 1 周)
- [ ] 添加数据库索引
- [ ] 实现虚拟滚动（大列表）
- [ ] 添加 HTTP 缓存头
- [ ] 优化图片（压缩和格式转换）

### Phase 2: 中优先级 (第 2 周)
- [ ] 实现浏览器缓存服务
- [ ] 添加防抖/节流
- [ ] 优化数据库查询
- [ ] 添加查询缓存

### Phase 3: 低优先级 (第 3 周)
- [ ] 进一步代码分割
- [ ] 实现服务工作线程
- [ ] 添加性能监控面板
- [ ] 数据库查询分析

---

## 🧪 性能测试

### 使用 Lighthouse
```bash
# 分析 admin dashboard
# 在 Chrome 开发者工具 → Lighthouse 标签页
# 或命令行
npm install -g lighthouse
lighthouse http://localhost:5173/admin --view
```

### 使用 WebPageTest
访问 https://www.webpagetest.org/
- 输入 URL
- 分析详细的性能报告

### 数据库查询分析
```bash
# MongoDB 查询分析
db.enrollments.find({ status: 'approved' }).explain('executionStats')
# 查看 executionStats 中的 totalDocsExamined vs totalKeys
# 如果差距大，说明需要优化索引
```

---

## ✅ 优化检查清单

部署前必须完成：

- [ ] 页面加载时间 < 2 秒
- [ ] API 响应时间 < 200ms
- [ ] Lighthouse 评分 > 90
- [ ] 没有 JavaScript 错误
- [ ] 没有 CSS 警告
- [ ] 图片经过优化
- [ ] 数据库查询有索引
- [ ] 缓存策略配置完成
- [ ] 性能监控已启用

---

**最后更新**: 2025-11-21
**下次审查**: 每月一次
