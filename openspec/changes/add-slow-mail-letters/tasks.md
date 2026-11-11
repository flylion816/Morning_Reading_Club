## 1. 后端
- [x] 1.1 Letter 模型（tenantPlugin，userId + periodId 唯一）
- [x] 1.2 letter 控制器与路由
- [x] 1.3 送达定时服务（幂等、跨租户）
- [x] 1.4 单元测试
- [x] 1.5 app.js 挂载 /api/v1/letters、server.js 启动定时送达（已由总控接线；非生产环境需设 ENABLE_LETTER_DELIVERY=true）

## 2. 小程序
- [x] 2.1 letter.service.js
- [x] 2.2 slow-mail 页面（写信、已封存、已送达、已拆、信箱已关）
- [x] 2.3 服务与页面测试
- [x] 2.4 首页「营地角落」入口、「我的」入口与 app.json 分包注册（已完成）
