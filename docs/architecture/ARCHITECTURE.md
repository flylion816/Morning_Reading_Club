# 晨读营系统 - 数据存储架构图

## 系统整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           微信小程序 + 管理后台                               │
│                    (Frontend / Vue Admin / Mini Program)                     │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
            ┌───────▼────────┐       ┌───────▼────────┐
            │  HTTP Request  │       │  WebSocket     │
            │  (REST API)    │       │  (Real-time)   │
            └───────┬────────┘       └───────┬────────┘
                    │                         │
┌───────────────────▼─────────────────────────▼─────────────────────────────────┐
│                         Express.js Backend Server                             │
│                          (Node.js + 业务逻辑)                                  │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │  Controllers: auth / user / period / section / checkin /            │     │
│  │  enrollment / payment / insight / comment / notification / admin    │     │
│  └──────────────┬──────────────────────────────────────────────────────┘     │
│                 │                                                            │
│                 ├─────────────────────┬──────────────────────┐               │
│                 │                     │                      │               │
│      ┌──────────▼────────┐  ┌────────▼──────────┐  ┌────────▼──────────┐   │
│      │ mysqlBackupService│  │ MongoDB Driver    │  │  Redis Client    │   │
│      │                   │  │                   │  │                  │   │
│      │ (异步非阻塞备份)    │  │ (Mongoose ODM)    │  │ (缓存 + 限流)      │   │
│      └──────────┬────────┘  └────────┬──────────┘  └────────┬──────────┘   │
│                 │                     │                      │               │
└─────────────────┼─────────────────────┼──────────────────────┼───────────────┘
                  │                     │                      │
        ┌─────────▼──────────┐  ┌──────▼────────────┐  ┌──────▼────────────┐
        │                    │  │                   │  │                   │
        │      MySQL         │  │    MongoDB        │  │     Redis         │
        │   (热备份库)        │  │   (主数据库)      │  │   (缓存层)        │
        │                    │  │                   │  │                   │
        │  ┌──────────────┐  │  │ ┌───────────────┐ │  │ ┌───────────────┐ │
        │  │ users        │  │  │ │ users         │ │  │ │ session_*     │ │
        │  │ admins       │  │  │ │ admins        │ │  │ │ rate_limit_* │ │
        │  │ periods      │  │  │ │ periods       │ │  │ │ cache_*      │ │
        │  │ sections     │  │  │ │ sections      │ │  │ │ ws_*         │ │
        │  │ checkins     │  │  │ │ checkins      │ │  │ └───────────────┘ │
        │  │ enrollments  │  │  │ │ enrollments   │ │  │                   │
        │  │ payments     │  │  │ │ payments      │ │  │ ⏱️ TTL: 分钟/小时  │
        │  │ insights     │  │  │ │ insights      │ │  │ 💾 大小: MB级别    │
        │  │ insight_*    │  │  │ │ (with arrays) │ │  │ ⚡ 超快访问速度    │
        │  │ comments     │  │  │ │ comments      │ │  │                   │
        │  │ comment_*    │  │  │ │ (with arrays) │ │  │                   │
        │  │ notifications│  │  │ │ notifications │ │  │                   │
        │  └──────────────┘  │  │ └───────────────┘ │  └───────────────────┘
        │                    │  │                   │
        │ 📊 总行数: 0-1M    │  │ 📄 总文档数: 变动 │
        │ 💾 数据量: GB级别  │  │ 💾 数据量: GB级别 │
        │ 🔄 实时同步的     │  │ ✨ 实时更新      │
        │                    │  │                   │
        └────────────────────┘  └───────────────────┘
```

---

## 详细数据流向

### 1️⃣ **写入流程** (同步)
```
用户操作 (登录/打卡/报名/评论)
     │
     ▼
Express Controller
     │
     ├─→ MongoDB 保存 ✅ (立即返回给用户)
     │
     └─→ mysqlBackupService.sync()
          (异步，不阻塞)
          │
          ▼
        MySQL 保存 ⏳ (后台执行，失败只记日志)
```

### 2️⃣ **读取流程** (小程序端)
```
小程序请求数据
     │
     ▼
Express Controller
     │
     ├─→ Redis 检查缓存 (存在则返回)
     │
     └─→ MongoDB 查询 (缓存未命中)
          │
          ▼
        数据存入 Redis (设置 TTL)
          │
          ▼
        返回给小程序
```

### 3️⃣ **管理后台查询流程**
```
管理员查看数据一致性
     │
     ├─→ GET /api/v1/backup/mongodb/stats
     │   └─→ 遍历 MongoDB 14 个 Collection，返回统计
     │
     ├─→ GET /api/v1/backup/mysql/stats
     │   └─→ SELECT COUNT(*) FROM 14 个 Table，返回统计
     │
     └─→ GET /api/v1/backup/compare
         └─→ 对比两边数据，显示一致性
```

---

## 数据库职责划分

### MongoDB（主数据库）
```
✅ 所有业务数据的唯一真实来源
✅ 支持复杂查询和 populate
✅ 灵活的 Schema 和数组字段
❌ 单点故障 (需要备份)
❌ 查询性能在大数据量下一般
```

**存储的 12 个 Collection：**
- users, admins
- periods, sections
- checkins, enrollments, payments
- insights, insight_requests, comments, notifications

---

### MySQL（热备份库）
```
✅ MongoDB 数据的完整备份副本
✅ 数据持久化在磁盘上
✅ 支持 SQL 统计和报表查询
✅ 异步写入，不影响主业务
❌ 可能存在数据延迟（秒级）
❌ 不作为实时查询源
```

**对应的 14 张 Table：**
- users, admins, periods, sections
- checkins, enrollments, payments
- insights, insight_likes (拆分数组)
- insight_requests, insight_request_audit_logs (拆分数组)
- comments, comment_replies (拆分数组)
- notifications

**同步策略：**
- INSERT 模式：使用 `INSERT ... ON DUPLICATE KEY UPDATE`
- 幂等性：重复同步不会出错
- 失败处理：只记日志，不影响主业务

---

### Redis（缓存层）
```
✅ 极快的访问速度 (微秒级)
✅ 支持 TTL 自动过期
✅ 支持复杂数据结构 (String/Hash/ZSet)
❌ 内存存储，重启会丢失
❌ 单机存储大小有限制
```

**存储场景：**
1. **会话缓存**：用户登录状态、Token
2. **数据缓存**：热点数据如期次列表、用户信息
3. **速率限制**：使用 ZSet 实现滑动窗口限流
4. **WebSocket 管理**：在线用户列表、连接状态
5. **临时数据**：OTP、验证码等一次性数据

---

## 同步机制详解

### 同步流程图
```
┌──────────────────────────────────────────────────────────────────────┐
│                     MongoDB 写入完成                                  │
│                    (create/update/delete)                            │
└─────────────────────────────┬──────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  立即返回给用户    │ ✅ 响应迅速
                    └─────────┬─────────┘
                              │
                    ┌─────────▼──────────────────────┐
                    │ mysqlBackupService.sync(record)│
                    │    (异步，非阻塞，失败补偿)      │
                    └─────────┬──────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
         ┌──────▼──────┐  ┌───▼────────┐  ┌──▼───────────┐
         │ 数据转换     │  │ MySQL 写入  │  │ 失败处理     │
         │ 数据清理     │  │ UPSERT     │  │ 记日志       │
         │ JSON 序列化  │  │            │  │ 不影响用户   │
         └──────────────┘  └────────────┘  └──────────────┘
```

### 同步特点
- ⚡ **非阻塞**：不等待 MySQL 响应，立即返回
- 🛡️ **容错**：MySQL 失败只记日志，业务继续
- 🔄 **幂等**：重复同步同一条记录不会出错
- 🎯 **覆盖全面**：11 个 Controller 中 60+ 个写入操作都有同步
- 📊 **可追踪**：所有备份操作都有详细日志

---

## 与 Docker 的关系

```
┌─────────────────────────────────────────────────────────┐
│                    docker-compose.yml                   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Service: morning-reading-backend (Node.js)       │   │
│  │  - Port: 3000                                    │   │
│  │  - Depends On: mongodb (healthy), mysql (healthy)│   │
│  └──────────┬───────────────────────────────────────┘   │
│             │                                            │
│  ┌──────────▼───────────────────────────────────────┐   │
│  │ Service: mongodb                                 │   │
│  │  - Port: 27017                                   │   │
│  │  - Volume: mongodb_data (持久化)                 │   │
│  │  - Health Check: mongosh ping                    │   │
│  └──────────────────────────────────────────────────┘   │
│             │                                            │
│  ┌──────────▼───────────────────────────────────────┐   │
│  │ Service: mysql                                   │   │
│  │  - Port: 3306                                    │   │
│  │  - Volume: mysql_data (持久化)                   │   │
│  │  - Init Script: mysql-schema.sql                 │   │
│  │  - Health Check: mysqladmin ping                 │   │
│  └──────────────────────────────────────────────────┘   │
│             │                                            │
│  ┌──────────▼───────────────────────────────────────┐   │
│  │ Service: redis                                   │   │
│  │  - Port: 6379                                    │   │
│  │  - Volume: redis_data (持久化)                   │   │
│  │  - Health Check: redis-cli ping                 │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Network: morning-reading-network (内网通信)             │
└─────────────────────────────────────────────────────────┘
```

---

## 数据量预估

### MongoDB
| Collection | 日活用户数 | 日增记录 | 预估总量 |
|-----------|---------|-------|--------|
| users | 100 | 10 | 10,000 |
| periods | - | 0-1 | 50 |
| sections | - | 0-5 | 500 |
| checkins | 100 | 100 | 1,000,000 |
| enrollments | 100 | 5 | 50,000 |
| payments | 50 | 5 | 10,000 |
| insights | 100 | 200 | 500,000 |
| comments | 100 | 50 | 100,000 |
| notifications | 100 | 500 | 500,000+ |

**预估 MongoDB 总大小**：1-2 GB

### MySQL
同 MongoDB，但数组字段拆分成独立表，总行数约为 MongoDB 的 1.2-1.5 倍

**预估 MySQL 总大小**：2-3 GB

### Redis
- 会话数据：100 个用户 × 1KB = 100 KB
- 缓存数据：热点数据约 10-50 MB
- 限流数据：实时生成，约 5-10 MB

**预估 Redis 总大小**：50-100 MB

---

## 备份和恢复流程

### 全量同步（Full Sync）
```
POST /api/v1/backup/sync/full

1. 遍历 MongoDB 的 12 个 Collection
2. 逐条读取每个文档
3. 通过 UPSERT 写入 MySQL
4. 返回同步结果统计

⏱️ 耗时：1分钟左右 (取决于数据量)
```

### 差量同步（Delta Sync）
```
POST /api/v1/backup/sync/delta

1. 获取 MySQL 中所有已有的 ID
2. 对比 MongoDB 中的 ID
3. 只同步新增的文档
4. 返回同步结果统计

⏱️ 耗时：秒级 (只同步新增)
🎯 用途：MongoDB 故障恢复后的快速追数
```

---

## 一致性保证

### 最终一致性
```
时间线：
T0: 用户在小程序完成操作 (比如打卡)
    ↓
T1: MongoDB 立即保存 ✅
    返回成功给用户
    ↓
T2-T10: 后台异步同步到 MySQL
    (可能失败，只记日志)
    ↓
T10+: MySQL 最终保存成功 ✅
    (或显示在同步日志中失败)
```

### 一致性监控
```
GET /api/v1/backup/compare

响应示例：
{
  "comparison": {
    "users": { "mongodb": 100, "mysql": 100, "difference": 0, "status": "✅ 一致" },
    "checkins": { "mongodb": 50000, "mysql": 49999, "difference": 1, "status": "⚠️ 不一致" },
    ...
  },
  "summary": {
    "totalMongo": 651550,
    "totalMysql": 651549,
    "inconsistentTables": 1
  }
}
```

---

## 生产部署建议

### 监控指标
- [ ] MongoDB 连接池健康
- [ ] MySQL 连接池健康
- [ ] Redis 连接状态
- [ ] 备份同步延迟 (应 < 1秒)
- [ ] MySQL-MongoDB 数据一致性 (应 > 99%)

### 故障恢复
1. **MongoDB 故障** → 使用 MySQL 做恢复源，执行 `delta sync`
2. **MySQL 故障** → 业务继续，失败日志累积，恢复后重新全量同步
3. **Redis 故障** → 业务继续，重新连接自动重建缓存

### 定期维护
- 每天凌晨执行一次全量对比 (consistency check)
- 每周备份一次 MySQL 数据到备用盘
- 每月审视一次同步日志，优化性能瓶颈

