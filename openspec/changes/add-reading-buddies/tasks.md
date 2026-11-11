## 1. 后端
- [x] 1.1 BuddyRequest、BuddyPair 模型与唯一索引
- [x] 1.2 配对、取消、结束、轻拍的服务层逻辑
- [x] 1.3 控制器与路由（authMiddleware + userTenantContext）
- [x] 1.4 单元测试（配对并发与边界、轻拍每日限制、结束后不再配到同一人）
- [x] 1.5 在 app.js 挂载 /api/v1/buddies（已由总控接线）

## 2. 小程序
- [x] 2.1 services/buddy.service.js 及测试
- [x] 2.2 pages/buddy/buddy 页面及测试（未加入、等待中、已配对、已结束）
- [x] 2.3 在 app.json 注册页面为分包（已完成）
- [x] 2.4 首页「营地角落」读伴状态入口（已接入）
